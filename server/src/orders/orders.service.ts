/**
 * 订单服务 —— 本项目最核心的业务所在
 * =============================================================================
 * 【迭代 1：朴素下单 v1（故意保留超卖隐患）】
 *
 * 下单流程（当前实现，三步串行）：
 *   1. 查票种，读出 stock
 *   2. 在 Node.js 内存里判断 stock >= quantity，然后 stock -= quantity，save 写回
 *   3. 创建订单文档
 *
 * 为什么说它有超卖隐患？（面试必问，务必理解到代码行级别）
 *   步骤 2 的"读-判断-写"不是原子操作。假设 stock=1，两个请求几乎同时到达：
 *     请求A: 读到 stock=1  ──┐
 *     请求B: 读到 stock=1  ──┤  两个请求都通过了 stock>=1 的检查！
 *     请求A: 写回 stock=0  ──┤
 *     请求B: 写回 stock=0  ──┘  B 把 A 的扣减覆盖了，但两张订单都创建成功
 *   结果：库存只扣了 1，却卖出去 2 张票 —— 这就是"超卖"（oversell）。
 *
 *   根本原因：Node.js 虽然单线程，但 await 之间会让出事件循环，
 *   其他请求可以在"读"和"写"之间插入执行。
 *
 * 迭代 2 会用 MongoDB 的原子条件更新修复：
 *   findOneAndUpdate({ _id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } })
 *   把"判断 + 扣减"压缩成数据库端的一个原子操作，问题根治。
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

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(TicketType.name) private readonly ticketTypeModel: Model<TicketTypeDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
  ) {}

  /**
   * 生成对外订单号：时间戳(毫秒) + 4位随机数
   * 简单够用，但高并发下同毫秒内有 1/10000 碰撞概率；
   * 数据层有 unique 索引兜底，碰撞时会抛错让用户重试 —— 可接受的临时方案
   */
  private generateOrderNo(): string {
    return `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  /**
   * 朴素下单 v1
   * 注意：这个方法的每一行"为什么这样写/为什么有隐患"都值得读一遍注释
   */
  async createOrder(dto: CreateOrderDto) {
    // ---- 参数校验（系统边界必须校验外部输入）----
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BadRequestException('quantity 必须是正整数');
    }

    // ---- 步骤 1：查票种（读库存）----
    const ticket = await this.ticketTypeModel.findById(dto.ticketTypeId).exec();
    if (!ticket) {
      throw new NotFoundException(`票种不存在: ${dto.ticketTypeId}`);
    }
    if (ticket.status !== TicketTypeStatus.ON_SALE) {
      throw new BadRequestException('该票种已下架');
    }

    // 校验所属活动必须处于"已发布"状态
    const activity = await this.activityModel.findById(ticket.activityId).exec();
    if (!activity) {
      throw new NotFoundException(`活动不存在: ${ticket.activityId}`);
    }
    if (activity.status !== ActivityStatus.PUBLISHED) {
      throw new BadRequestException('活动未发布，无法下单');
    }

    // ---- 步骤 2：内存判断 + 扣减库存（非原子，超卖隐患就在这里）----
    if (ticket.stock < dto.quantity) {
      throw new BadRequestException('库存不足');
    }
    // 隐患点：先在内存对象上改，再 save 写回。并发时两个请求可能
    // 基于同一个旧值各自减一次，后写的会覆盖先写的（丢失更新）
    ticket.stock -= dto.quantity;
    await ticket.save();

    // ---- 步骤 3：创建订单 ----
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
    return order.toObject();
  }

  /** 按业务订单号查询（对外一律用 orderNo 而不是 _id） */
  async findByOrderNo(orderNo: string) {
    const doc = await this.orderModel.findOne({ orderNo }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`订单不存在: ${orderNo}`);
    }
    return doc;
  }

  /** 按活动查询订单列表（后续迭代给前端"我的订单"用） */
  async findByActivity(activityId: string) {
    return this.orderModel.find({ activityId }).sort({ createdAt: -1 }).lean().exec();
  }
}
