/**
 * 票种服务层
 * -----------------------------------------------------------------------------
 * 库存"扣减/释放"不在这里 —— 扣库存是"下单"动作的一部分，逻辑归 orders.service。
 * （拆开会导致订单流程跨两个服务跳来跳去，事务边界反而模糊）
 */
import { query } from '../config/db.js'
import { notFound, badRequest } from '../middleware/errorHandler.js'
import { findActivity } from './activity.service.js'

/** 票种数据库行 -> API 输出（驼峰映射，字段名和 Nest 版对齐） */
function toDto(row) {
  return {
    _id: String(row.id),
    activityId: String(row.activity_id),
    name: row.name,
    price: row.price,
    totalStock: row.total_stock,
    stock: row.stock,
    limitPerUser: row.limit_per_user,
    status: row.status,
    version: row.version,
  }
}

/** 在指定活动下创建票种 */
export async function createTicketType(activityId, dto) {
  // 前置校验：活动必须存在（外键也能兜底，但应用层先校验能返回更友好的 404）
  await findActivity(activityId)

  if (!Number.isInteger(dto.price) || dto.price < 0) {
    throw badRequest('price 必须是非负整数（单位：分）')
  }
  if (!Number.isInteger(dto.totalStock) || dto.totalStock < 0) {
    throw badRequest('totalStock 必须是非负整数')
  }

  const result = await query(
    `INSERT INTO ticket_types (activity_id, name, price, total_stock, stock, limit_per_user)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [activityId, dto.name, dto.price, dto.totalStock, dto.totalStock, dto.limitPerUser ?? 0],
    // 创建时剩余库存 stock = 总库存 totalStock，所以 totalStock 传了两次
  )
  return findTicketType(result.insertId)
}

/** 查询某活动下的所有票种（按价格升序） */
export async function listTicketTypes(activityId) {
  await findActivity(activityId)
  const rows = await query(
    `SELECT * FROM ticket_types WHERE activity_id = ? ORDER BY price ASC`,
    [activityId],
  )
  return rows.map(toDto)
}

export async function findTicketType(id) {
  const rows = await query(`SELECT * FROM ticket_types WHERE id = ?`, [id])
  if (rows.length === 0) {
    throw notFound(`票种不存在: ${id}`)
  }
  return toDto(rows[0])
}

/** 部分更新（字段白名单防批量赋值漏洞，原理见 activity.service 的注释） */
export async function updateTicketType(id, dto) {
  const allowed = ['name', 'price', 'totalStock', 'limitPerUser', 'status']
  const columnMap = {
    name: 'name',
    price: 'price',
    totalStock: 'total_stock',
    limitPerUser: 'limit_per_user',
    status: 'status',
  }
  const sets = []
  const params = []
  for (const key of allowed) {
    if (dto[key] !== undefined) {
      sets.push(`${columnMap[key]} = ?`)
      params.push(dto[key])
    }
  }
  if (sets.length === 0) {
    throw badRequest('没有提供任何可更新的字段')
  }

  // 先查存在性（404 优先），再更新
  await findTicketType(id)
  // TODO(迭代2)：调整 totalStock 时要保证不小于已售数量，否则出现"负库存"逻辑矛盾
  params.push(id)
  await query(`UPDATE ticket_types SET ${sets.join(', ')} WHERE id = ?`, params)
  return findTicketType(id)
}

export async function removeTicketType(id) {
  await findTicketType(id)
  // TODO(迭代2)：有未完结订单的票种不允许删除
  await query(`DELETE FROM ticket_types WHERE id = ?`, [id])
  return { deleted: true }
}
