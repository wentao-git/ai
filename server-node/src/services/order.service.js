/**
 * 订单服务 —— 原生 Node 版的防超卖核心
 * =============================================================================
 * 与 server/src/orders/orders.service.ts（Nest 版）功能完全一致：
 * 三种下单策略，通过 x-order-strategy 请求头切换（默认 atomic）。
 * 这里的注释侧重"用 SQL 怎么表达同样的并发思想"，Nest 版侧重"Mongoose 怎么表达"，
 * 两边对照读，防超卖这个知识点就立体了。
 *
 * 三种策略的 SQL 版本：
 *   naive      SELECT stock -> JS 判断 -> UPDATE stock = <内存算的绝对值>   （超卖！）
 *   atomic     UPDATE ... SET stock = stock - ? WHERE id = ? AND stock >= ?  （推荐）
 *   optimistic UPDATE ... WHERE id = ? AND version = ? AND stock >= ?，失败重试
 * =============================================================================
 */
import { query } from '../config/db.js'
import { notFound, badRequest } from '../middleware/errorHandler.js'
import { ActivityStatus, OrderStatus, TicketTypeStatus } from '../common/enums.js'

/** 支付有效期（分钟） */
const PAY_EXPIRE_MINUTES = 15
/** 乐观锁最大重试次数 */
const OPTIMISTIC_MAX_RETRIES = 5

/** 生成对外订单号：时间戳 + 4 位随机数（unique 索引兜底碰撞，见 schema.sql 注释） */
function generateOrderNo() {
  return `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
}

/** 订单数据库行 -> API 输出（驼峰映射，字段名与 Nest 版对齐） */
function toDto(row) {
  return {
    orderNo: row.order_no,
    activityId: String(row.activity_id),
    ticketTypeId: String(row.ticket_type_id),
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    status: row.status,
    payExpireAt: row.pay_expire_at,
    createdAt: row.created_at,
  }
}

/**
 * 下单入口（策略分发器）
 * @param {object} dto      { ticketTypeId, quantity }
 * @param {string} strategy 请求头覆盖的策略，不传用默认 atomic
 */
export async function createOrder(dto, strategy) {
  const useStrategy = strategy ?? 'atomic'

  // 通用参数校验：quantity 必须正整数（小数会让 stock 出现小数，污染库存模型）
  if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
    throw badRequest('quantity 必须是正整数')
  }

  // ---- 阶段一：读票种 + 校验售卖资格（读操作永远安全，超卖只发生在写路径）----
  const tickets = await query(`SELECT * FROM ticket_types WHERE id = ?`, [dto.ticketTypeId])
  if (tickets.length === 0) {
    throw notFound(`票种不存在: ${dto.ticketTypeId}`)
  }
  const ticket = tickets[0]

  if (ticket.status !== TicketTypeStatus.ON_SALE) {
    throw badRequest('该票种已下架')
  }

  const activities = await query(`SELECT * FROM activities WHERE id = ?`, [ticket.activity_id])
  if (activities.length === 0) {
    throw notFound(`活动不存在: ${ticket.activity_id}`)
  }
  if (activities[0].status !== ActivityStatus.PUBLISHED) {
    throw badRequest('活动未发布，无法下单')
  }

  // ---- 阶段二：按策略扣库存（每种策略返回扣减后的最新剩余库存）----
  let remainingStock
  if (useStrategy === 'naive') {
    remainingStock = await deductStockNaive(ticket, dto.quantity)
  } else if (useStrategy === 'atomic') {
    remainingStock = await deductStockAtomic(ticket, dto.quantity)
  } else if (useStrategy === 'optimistic') {
    remainingStock = await deductStockOptimistic(ticket, dto.quantity)
  } else {
    throw badRequest(`未知下单策略: ${useStrategy}`)
  }

  // ---- 阶段三：创建订单（价格快照：以下单那一刻的票价为准）----
  const result = await query(
    `INSERT INTO orders
       (order_no, activity_id, ticket_type_id, quantity, unit_price, total_amount, status, pay_expire_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateOrderNo(),
      ticket.activity_id,
      ticket.id,
      dto.quantity,
      ticket.price,
      ticket.price * dto.quantity,
      OrderStatus.PENDING_PAYMENT,
      // MySQL 的 DATETIME 接受 'YYYY-MM-DD HH:mm:ss' 格式字符串
      new Date(Date.now() + PAY_EXPIRE_MINUTES * 60 * 1000),
    ],
  )

  // 按自增 id 回查订单行（拿数据库默认生成的 created_at）
  const rows = await query(`SELECT * FROM orders WHERE id = ?`, [result.insertId])
  return { ...toDto(rows[0]), remainingStock }
}

// =============================================================================
// 策略一：naive（反面教材，压测对照用）
// =============================================================================
/**
 * 超卖时序（stock=1，请求 A/B 并发）：
 *   t1 A: SELECT 读到 stock=1
 *   t2 B: SELECT 读到 stock=1（A 的写还没发生！）
 *   t3 A: JS 判断 1>=1 通过
 *   t4 B: JS 判断 1>=1 通过（两家都以为有票）
 *   t5 A: UPDATE SET stock=0（内存算出的绝对值）
 *   t6 B: UPDATE SET stock=0（B 也是基于自己读到的 1 算出 0，直接覆盖 A 的结果）
 *   t7 两条订单都创建 -> 卖 2 张、账面只扣 1 -> 超卖
 * 【对比学习】和 Mongo 版的死法一模一样 —— 丢失更新是并发模型问题，
 * 换数据库不会自愈，必须用"原子条件更新"来解。
 */
async function deductStockNaive(ticket, quantity) {
  if (ticket.stock < quantity) {
    throw badRequest('库存不足')
  }
  // 注意是"绝对值赋值"：UPDATE SET stock = <Node 内存里算出来的数>
  // 这是超卖的根源 —— 写的是过期快照算出的值，不是数据库当前值
  const newStock = ticket.stock - quantity
  await query(`UPDATE ticket_types SET stock = ? WHERE id = ?`, [newStock, ticket.id])
  return newStock
}

// =============================================================================
// 策略二：atomic（生产推荐）
// =============================================================================
/**
 * 把"判断库存够不够"下沉进 SQL 的 WHERE 条件，让判断和扣减一次原子完成：
 *
 *   UPDATE ticket_types
 *      SET stock = stock - ?       -- 相对减：基于数据库当前最新值算（不覆盖别人）
 *      WHERE id = ?
 *        AND stock >= ?            -- 库存够的判断在这里！
 *
 * 为什么这就安全了？（MySQL 单条 UPDATE 的执行是原子的）
 * - InnoDB 对这条 UPDATE 会给匹配的行加行锁，并发请求在行锁上排队串行执行
 * - 先来的把 stock 扣到不满足条件，后来的 WHERE 匹配不到行，
 *   affectedRows = 0 —— 它连"看到旧值"的机会都没有
 * 【对比学习】Mongo 用 findOneAndUpdate({stock: {$gte}}, {$inc}) 表达同一思想；
 * MySQL 的行锁模型还额外给了我们"悲观锁"能力（SELECT ... FOR UPDATE，迭代可加讲），
 * 这是 Mongo 单机版做不到的。
 */
async function deductStockAtomic(ticket, quantity) {
  const result = await query(
    `UPDATE ticket_types SET stock = stock - ? WHERE id = ? AND stock >= ?`,
    [quantity, ticket.id, quantity],
  )
  // affectedRows = 0：WHERE 没匹配到行 = 库存已被并发请求扣穿
  if (result.affectedRows === 0) {
    throw badRequest('库存不足')
  }
  return ticket.stock - quantity
}

// =============================================================================
// 策略三：optimistic（乐观锁，教学对照）
// =============================================================================
/**
 * 版本号乐观锁：WHERE 里多一个 version = 我读到的版本（"没人和我抢"的断言），
 * 同时 SET version = version + 1。断言失败（affectedRows = 0）说明有人抢先改过，
 * 重新读最新状态重试，最多 OPTIMISTIC_MAX_RETRIES 次。
 *
 * 为什么高并发下它不如 atomic？1000 人抢最后 1 张票：atomic 下 999 人立即失败；
 * optimistic 下 999 人全部冲突、全部重试、再冲突…… 系统在重试风暴里空转。
 */
async function deductStockOptimistic(ticket, quantity) {
  let current = ticket // 第一次尝试用调用方传入的行；重试时重新读

  for (let attempt = 1; attempt <= OPTIMISTIC_MAX_RETRIES; attempt++) {
    if (current.stock < quantity) {
      throw badRequest('库存不足') // 真没票：重试也不会变多，直接失败
    }

    const result = await query(
      `UPDATE ticket_types
          SET stock = stock - ?, version = version + 1
        WHERE id = ? AND version = ? AND stock >= ?`,
      [quantity, current.id, current.version, quantity],
    )

    if (result.affectedRows > 0) {
      return current.stock - quantity // 断言成立，扣减成功
    }

    // 断言失败：version 被别人动了。重读最新行，进入下一轮
    const rows = await query(`SELECT * FROM ticket_types WHERE id = ?`, [ticket.id])
    current = rows[0]
  }

  // 重试耗尽：不是没票，是冲突太激烈 —— 语义上和"库存不足"区分开
  throw badRequest('当前下单人数过多，请稍后重试')
}

// =============================================================================
// 查询
// =============================================================================

/** 按业务订单号查订单（对外用 order_no，不用自增 id —— 原因见 schema.sql 注释） */
export async function findOrderByOrderNo(orderNo) {
  const rows = await query(`SELECT * FROM orders WHERE order_no = ?`, [orderNo])
  if (rows.length === 0) {
    throw notFound(`订单不存在: ${orderNo}`)
  }
  return toDto(rows[0])
}

/** 按活动查订单列表（压测脚本用它数订单量做超卖对账） */
export async function listOrdersByActivity(activityId) {
  const rows = await query(
    `SELECT * FROM orders WHERE activity_id = ? ORDER BY created_at DESC`,
    [activityId],
  )
  return rows.map(toDto)
}
