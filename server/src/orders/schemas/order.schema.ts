/**
 * 订单实体（MongoDB 集合：orders）
 * -----------------------------------------------------------------------------
 * 订单设计的两个关键点（面试高频）：
 *
 * 1. 价格快照（unitPrice）：
 *    订单创建时把票价"拍快照"存下来，而不是每次实时去票种表查。
 *    原因：票价可能调价，历史订单金额不能跟着变 —— 这是电商系统通用做法。
 *
 * 2. 订单号（orderNo）：
 *    - 对外暴露的业务单号，不用 MongoDB 的 _id（_id 泄露创建时间等信息，且无业务语义）
 *    - 本迭代用"时间戳+随机数"的简单实现，够用但有碰撞概率
 *    - 迭代 3 会结合幂等键重新设计，面试时可以聊雪花算法（Snowflake）
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OrderStatus } from '../../common/enums.js';

@Schema({ timestamps: true })
export class Order {
  /** 对外的业务订单号，全局唯一（见文件头注释） */
  @Prop({ required: true, unique: true, index: true })
  orderNo: string;

  /** 冗余存活动 id：订单列表展示时避免多次关联查询（空间换时间的常见取舍） */
  @Prop({ required: true, index: true })
  activityId: string;

  /** 购买的票种 id */
  @Prop({ required: true, index: true })
  ticketTypeId: string;

  /** 购买数量（>0 的整数） */
  @Prop({ required: true, min: 1 })
  quantity: number;

  /** 下单时刻的票价快照，单位：分 */
  @Prop({ required: true, min: 0 })
  unitPrice: number;

  /** 订单总金额 = unitPrice * quantity，单位：分 */
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  /** 订单状态，流转见 common/enums.ts 中的注释图 */
  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status: OrderStatus;

  /**
   * 支付截止时间：超过这个时间未支付，订单将被判定为 EXPIRED 并释放库存
   * 迭代 4 的定时任务就是扫描 payExpireAt < now 且 status = PENDING_PAYMENT 的订单
   * 这里先在创建时写入（15 分钟），让数据结构提前就位
   */
  @Prop({ required: true, type: Date })
  payExpireAt: Date;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
