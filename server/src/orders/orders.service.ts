/**
 * 订单服务 —— 本项目最核心的业务所在
 * =============================================================================
 * 【迭代 2：防超卖 —— 三种下单策略，可运行时切换对比】
 *
 * 什么是"超卖"（oversell）？
 *   卖出去的票数 > 实际库存。比如 100 张票卖出了 103 单，
 *   多出来的 3 张没票可给 —— 在真实业务里就是赔付/黑名单级事故。
 *
 * 超卖的根因（一切由此展开）：
 *   "检查库存"和"扣减库存"是两个动作，它们之间有时间窗口。
 *   两个请求都在窗口内检查通过，就会各自扣减成功 —— 库存被扣穿了。
 *
 * 三种策略对应三种思路（通过 x-order-strategy 请求头或 ORDER_STRATEGY 环境变量切换）：
 *
 *   1. naive      朴素版（迭代 1 遗留，仅作反面教材/压测对照）
 *                 读 stock -> 内存判断 -> 内存减 -> save 写回
 *                 ❌ 判断和扣减分离，窗口期大，并发必超卖
 *
 *   2. atomic     原子条件更新（生产推荐）
 *                 把"判断 + 扣减"压缩成数据库端的一条原子语句：
 *                 findOneAndUpdate({ stock: { $gte: n } }, { $inc: { stock: -n } })
 *                 ✅ 匹配这个条件的文档才会被更新，数据库内部对单文档更新是原子的，
 *                    不存在"检查完还没扣就被别人插队"的窗口
 *
 *   3. optimistic 乐观锁（教学对照实现）
 *                 读出 stock + version -> 提交"version 未变才扣减"的条件更新
 *                 ❌ 冲突时要重试，高并发下重试风暴，性能反而不如 atomic
 *                 保留它是为了和 atomic 对比，讲清楚"为什么 atomic 更优"
 *
 * 面试延伸：MySQL 里同样的故事怎么讲？
 *   naive   -> 对应"先 SELECT 再 UPDATE"（同样的丢失更新问题）
 *   atomic  -> 对应 UPDATE ... SET stock = stock - n WHERE stock >= n（同一条原子语句）
 *   乐观锁  -> 对应 UPDATE ... WHERE version = ? （或 JPA @Version）
 *   悲观锁  -> 对应 SELECT ... FOR UPDATE（MongoDB 单机没有等价的行锁接口，
 *              所以这里不实现悲观版，面试时讲清"为什么讲不了"也是加分项）
 * =============================================================================
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema.js';
import { TicketType, TicketTypeDocument } from '../ticket-types/schemas/ticket-type.schema.js';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema.js';
import { ActivityStatus, OrderStatus, TicketTypeStatus } from '../common/enums.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

/** 支付有效期（分钟）：超时未支付将被迭代 4 的定时任务过期释放 */
const PAY_EXPIRE_MINUTES = 15;

/** 乐观锁策略的最大重试次数。超过即判定系统过载，让用户稍后再试 */
const OPTIMISTIC_MAX_RETRIES = 5;

/** 下单扣库存策略类型（见文件头大注释） */
export type OrderStrategy = 'naive' | 'atomic' | 'optimistic';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(TicketType.name) private readonly ticketTypeModel: Model<TicketTypeDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
  ) {
    // 构造时打印当前默认策略，方便压测时确认服务配置
    console.log(`[orders] 默认下单策略: ${this.defaultStrategy}`);
  }

  /**
   * 默认策略：优先读环境变量（部署时可整体切换），本地默认 atomic（生产推荐版）
   * 注意：这里读一次存下来，而不是每次请求都读 process.env —— 既省开销，也避免
   * 运行中环境变量被改动导致行为漂移
   */
  readonly defaultStrategy: OrderStrategy =
    (process.env.ORDER_STRATEGY as OrderStrategy) ?? 'atomic';

  /** 生成对外订单号：时间戳(毫秒) + 4位随机数（简单实现，unique 索引兜底碰撞） */
  private generateOrderNo(): string {
    return `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  /**
   * 下单入口：策略分发器
   * -----------------------------------------------------------------------------
   * 为什么做成"策略分发"而不是写死一种？
   * - 压测对比需要同一份代码跑多种实现，切换方式必须可控
   * - 策略模式（Strategy Pattern）的标准应用：调用方选策略，业务流程（建单、快照）共享
   *
   * @param dto 下单参数
   * @param strategy 请求头覆盖的策略（压测脚本用），不传则用默认
   */
  async createOrder(dto: CreateOrderDto, strategy?: OrderStrategy) {
    const useStrategy = strategy ?? this.defaultStrategy;

    // ---- 通用参数校验（只和策略无关的部分放最前面，快速失败省资源）----
    // quantity 必须是正整数：小数/0/负数都会让"扣库存"的语义变成灾难
    // （比如 quantity=0.5，$inc 后 stock 出现小数，库存模型整个被污染）
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BadRequestException('quantity 必须是正整数');
    }

    // ---- 阶段一：读票种 + 校验售卖资格（三种策略共享）----
    // 注意：这里的"读"本身没有并发问题 —— 读永远不会超卖，
    // 超卖只发生在"写"的路径上。所以三种策略共用同一个读逻辑是安全的
    const ticket = await this.ticketTypeModel.findById(dto.ticketTypeId).exec();
    if (!ticket) {
      throw new NotFoundException(`票种不存在: ${dto.ticketTypeId}`);
    }
    if (ticket.status !== TicketTypeStatus.ON_SALE) {
      throw new BadRequestException('该票种已下架');
    }

    const activity = await this.activityModel.findById(ticket.activityId).exec();
    if (!activity) {
      throw new NotFoundException(`活动不存在: ${ticket.activityId}`);
    }
    if (activity.status !== ActivityStatus.PUBLISHED) {
      throw new BadRequestException('活动未发布，无法下单');
    }

    // ---- 阶段二：按策略扣库存 ----
    // 每个策略方法返回"扣减成功后的票种文档"（含扣减后的最新库存），失败则抛异常
    let updatedTicket: TicketTypeDocument;
    switch (useStrategy) {
      case 'naive':
        updatedTicket = await this.deductStockNaive(ticket, dto.quantity);
        break;
      case 'atomic':
        updatedTicket = await this.deductStockAtomic(ticket, dto.quantity);
        break;
      case 'optimistic':
        updatedTicket = await this.deductStockOptimistic(ticket, dto.quantity);
        break;
      default:
        // 兜底：前端/压测脚本传了未知策略头，直接拒绝而不是静默降级 —— 行为可预期很重要
        throw new BadRequestException(`未知下单策略: ${useStrategy}`);
    }

    // ---- 阶段三：创建订单（三种策略共享）----
    // 价格快照：金额以"下单那一刻"的票价为准，之后票价怎么变都不影响已有订单
    const order = await this.orderModel.create({
      orderNo: this.generateOrderNo(),
      activityId: ticket.activityId,
      ticketTypeId: ticket._id.toString(),
      quantity: dto.quantity,
      unitPrice: ticket.price,
      totalAmount: ticket.price * dto.quantity,
      status: OrderStatus.PENDING_PAYMENT,
      payExpireAt: new Date(Date.now() + PAY_EXPIRE_MINUTES * 60 * 1000),
    });
    return { ...order.toObject(), remainingStock: updatedTicket.stock };
  }

  // ===========================================================================
  // 策略一：朴素扣减（反面教材，保留用于压测对照）
  // ===========================================================================
  /**
   * 逐行拆解超卖是如何发生的（stock=1，请求 A/B 几乎同时到达）：
   *
   *   t1  请求A: findById -> 读到 stock=1            （A 挂起，等待下一次 DB 交互）
   *   t2  请求B: findById -> 读到 stock=1            （B 也读到旧值！）
   *   t3  请求A: if(1 >= 1) 通过                     （A 觉得有票）
   *   t4  请求B: if(1 >= 1) 通过                     （B 也觉得有票 ← 错误的根源）
   *   t5  请求A: 内存里 stock=0，save() 写回 0
   *   t6  请求B: 内存里 stock=0（B 是基于 t2 读到的 1 自己减的），save() 写回 0
   *   t7  两条订单都创建 → 库存账面 0，实际卖出 2 张
   *
   * 关键知识点：Node.js 是单线程的，为什么还会这样？
   * - 单线程指的是"同一时刻只执行一段同步 JS 代码"
   * - 每次 await 都是让出事件循环的断点，其他请求的处理代码可以插进来执行
   * - 所以"读"和"写"之间隔着至少两次 await（findById、save 的网络往返），
   *   这个窗口足够塞进任意多个并发请求
   *
   * 为什么不在 save 前重新检查一遍 stock？（常见的错误"修复"）
   * - 重新读到的值照样可能马上过期，只是把窗口缩小，没有消除 —— 竞态问题是
   *   靠"把检查和写入合并成一个不可分割的操作"根治的，不是靠缩小窗口
   */
  private async deductStockNaive(ticket: TicketTypeDocument, quantity: number) {
    // ① 内存判断：用的是刚才 findById 读到的旧值（此刻可能已经过期）
    if (ticket.stock < quantity) {
      throw new BadRequestException('库存不足');
    }

    // ② 内存扣减：只改了 Node 进程里的这个对象，数据库还不知道
    ticket.stock -= quantity;

    // ③ 写回：save() 生成 update { stock: <内存算出来的绝对值> }，
    //    这是"赋值"而不是"增减"—— t5/t6 里 B 的赋值会直接覆盖 A 的结果
    //    （教科书上叫"丢失更新"，lost update）
    await ticket.save();

    return ticket;
  }

  // ===========================================================================
  // 策略二：原子条件更新（生产推荐）
  // ===========================================================================
  /**
   * 核心思想：把"够不够"的判断下沉到数据库，让判断和扣减在同一条语句里发生。
   *
   *   findOneAndUpdate(
   *     { _id: 票种id, stock: { $gte: quantity } },   // 过滤条件：库存必须够
   *     { $inc:  { stock: -quantity } },              // 原子自减（相对值，不是赋值）
   *   )
   *
   * 为什么这样就安全了？（理解这句就理解了防超卖的全部本质）
   * - MongoDB 保证：任何一个文档的"按条件匹配 + 更新"是原子完成的，
   *   内部有写锁/乐观并发控制保护，两个并发更新必然一先一后串行执行
   * - 先执行的那个把 stock 扣到不满足条件的值，后执行的条件就匹配不上了，
   *   返回 null —— 它连"看到旧值"的机会都没有
   * - $inc 是相对增减（数据库端在最新值基础上算），不存在"赋值覆盖"问题
   *
   * 对比 naive 的三处本质变化：
   *   ① 判断位置：应用内存 -> 数据库引擎（消除了窗口）
   *   ② 写法：绝对赋值 stock -= n -> 相对自增 $inc: -n（消除覆盖）
   *   ③ 成功判定：无条件成功 -> 匹配到文档才算成功（失败有明确信号 null）
   */
  private async deductStockAtomic(ticket: TicketTypeDocument, quantity: number) {
    const updated = await this.ticketTypeModel
      .findOneAndUpdate(
        // 过滤条件：_id 精确锁定这一个文档；stock >= quantity 就是"库存够"的判断，
        // 它不再是应用层代码，而是这条原子语句的一部分
        { _id: ticket._id, stock: { $gte: quantity } },
        // $inc：在数据库当前最新值上做原子减法。哪怕一毫秒前别人刚扣过，
        // 也是在"别人扣完的最新值"上继续减 —— 永远不会用旧值覆盖新值
        { $inc: { stock: -quantity } },
        // new: true 返回更新后的文档（默认返回更新前的，那样拿不到扣减后的剩余库存）
        { new: true },
      )
      .exec();

    // 条件没匹配上（最常见原因：库存不足被别的请求扣穿了）返回 null
    if (!updated) {
      throw new BadRequestException('库存不足');
    }
    return updated;
  }

  // ===========================================================================
  // 策略三：乐观锁（教学对照实现）
  // ===========================================================================
  /**
   * 核心思想：不阻止冲突发生，而是检测冲突并重试。
   *
   *   读: { stock: 10, version: 3 }
   *   写: findOneAndUpdate({ _id, version: 3, stock >= n },
   *                        { $inc: { stock: -n, version: 1 } })
   *      └─ 如果有人在我读和写之间改过库存，version 已经变成 4，
   *         我的 version: 3 条件匹配失败 -> 返回 null -> 检测到冲突 -> 重读重试
   *
   * 和 atomic 的关键区别：
   * - atomic 的条件是"库存够不够"（业务条件），匹配失败 = 真没票，直接告诉用户
   * - optimistic 的条件多了"版本没变"（冲突检测），匹配失败可能只是"手气不好"，
   *   重读后库存也许还够 —— 所以必须重试，这就是"乐观"的含义
   *
   * 为什么高并发场景它不如 atomic？
   * - 1000 个请求抢最后 1 张票：atomic 下 999 个立即收到"库存不足"（干净利落）；
   * - optimistic 下这 999 个会全部冲突、全部重试、再冲突…… 每次重试都是一次
   *   完整的 DB 读+写，系统在冲突风暴里空转 —— 重试次数失控时近似 DoS 自己
   * - 所以限购重试次数（OPTIMISTIC_MAX_RETRIES），超限直接报"系统繁忙"
   */
  private async deductStockOptimistic(ticket: TicketTypeDocument, quantity: number) {
    // 第一次尝试用的票种文档由调用方传入，后续重试需要重新读
    let current = ticket;

    for (let attempt = 1; attempt <= OPTIMISTIC_MAX_RETRIES; attempt++) {
      // 业务判断：库存真的不够时，重试也没用（重读只会更少），直接失败
      if (current.stock < quantity) {
        throw new BadRequestException('库存不足');
      }

      // 条件里带 version = 我读到的版本：这是"没人和我抢"的断言
      const updated = await this.ticketTypeModel
        .findOneAndUpdate(
          { _id: current._id, version: current.version, stock: { $gte: quantity } },
          // 一次 $inc 同时做两件事：扣库存 + 版本号自增（两字段原子更新）
          { $inc: { stock: -quantity, version: 1 } },
          { new: true },
        )
        .exec();

      if (updated) {
        return updated; // 断言成立，扣减成功
      }

      // 断言失败 = version 已被别人改动。重新读取最新状态，进入下一轮尝试
      // 注意：这里不 sleep 让出 —— 秒杀场景重试就是要抢时间，
      // 但正因为如此才说 optimistic 不适合高并发（互不相让）
      current = (await this.ticketTypeModel.findById(ticket._id).exec())!;
    }

    // 重试次数耗尽：不是"没票"，而是"冲突太激烈"，语义上要和库存不足区分开
    throw new BadRequestException('当前下单人数过多，请稍后重试');
  }

  // ===========================================================================
  // 查询
  // ===========================================================================

  /** 按业务订单号查询（对外一律用 orderNo 而不是 _id） */
  async findByOrderNo(orderNo: string) {
    const doc = await this.orderModel.findOne({ orderNo }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`订单不存在: ${orderNo}`);
    }
    return doc;
  }

  /** 按活动查询订单列表（压测脚本用它数订单数，后续迭代给前端"我的订单"用） */
  async findByActivity(activityId: string) {
    return this.orderModel.find({ activityId }).sort({ createdAt: -1 }).lean().exec();
  }
}
