/**
 * 票种实体（MongoDB 集合：ticket_types）
 * -----------------------------------------------------------------------------
 * 这是整个系统的"库存"载体，迭代 2 的防超卖战场就在 stock 字段上。
 *
 * 库存模型：
 * - totalStock：总库存，创建后一般不变（只增不减，卖完为止）
 * - stock：当前剩余可售库存，下单扣减、取消/超时释放回加
 *
 * 为什么不存 soldCount 再用 totalStock - soldCount 算剩余？
 * - 两种模型都可以，但"直接维护剩余数"只需一个字段的原子扣减，
 *   "累计已售"模型在做超卖防护时要同时约束 soldCount <= totalStock，
 *   条件更复杂。面试时两种都该能说出来。
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TicketTypeStatus } from '../../common/enums.js';

@Schema({ timestamps: true })
export class TicketType {
  /** 所属活动（弱关联：只存 activity 的 _id 字符串，不做 DBRef） */
  @Prop({ required: true, index: true })
  activityId: string;

  /** 票种名称，如"早鸟票"、"VIP票" */
  @Prop({ required: true, trim: true, maxlength: 50 })
  name: string;

  /** 票价，单位：分（整数）。见 activity.schema.ts 中关于金额精度的说明 */
  @Prop({ required: true, min: 0 })
  price: number;

  /** 总库存 */
  @Prop({ required: true, min: 0 })
  totalStock: number;

  /**
   * 剩余库存 —— 并发扣减的核心字段
   * 迭代 1 的朴素实现是"读出来减完写回去"，并发下会超卖；
   * 迭代 2 会改成原子条件更新，这里先埋下隐患
   */
  @Prop({ required: true, min: 0 })
  stock: number;

  /**
   * 每人限购数量（0 表示不限）
   * 真实票务系统的标配字段，迭代 3 做下单幂等时会用到
   */
  @Prop({ required: true, min: 0, default: 0 })
  limitPerUser: number;

  /** 票种状态：ON_SALE(在售) / OFF_SALE(已下架) */
  @Prop({ required: true, enum: TicketTypeStatus, default: TicketTypeStatus.ON_SALE })
  status: TicketTypeStatus;

  /**
   * 乐观锁版本号（迭代 2 引入）
   * -----------------------------------------------------------------------------
   * 它是干嘛的？每次成功修改库存，version 自增 1。
   * 乐观锁策略下单时，我们提交这样的条件更新：
   *   "当 version 还是我读到的那个值时，才允许扣库存 + version+1"
   * 如果在我读和写之间被别人改过（version 变了），条件匹配失败 -> 更新 0 行 -> 我就知道冲突了。
   *
   * 为什么叫"乐观"锁？
   * - 乐观：假设冲突很少发生，先干活，提交时才检查有没有冲突（检查失败就重试）
   * - 悲观（对照概念）：假设冲突经常发生，干活前先把资源锁住，别人必须等我
   * - 票务秒杀场景冲突极高，乐观锁会大量重试浪费 CPU，所以本项目最终方案是
   *   原子条件更新（连 version 都不需要），version 字段主要作为教学/对比实现保留
   *
   * 细节：Mongoose 默认自带 __v 字段，为什么还要自定义 version？
   * - __v 是 Mongoose 内部用的（主要处理数组下标一致性），语义不是给业务锁用的
   * - 显式定义 version 字段可以在 $inc 原子自增里精确控制它的变化时机，
   *   语义清晰、行为可预期，这是自己实现乐观锁的标准做法
   */
  @Prop({ required: true, default: 0 })
  version: number;
}

export type TicketTypeDocument = HydratedDocument<TicketType>;
export const TicketTypeSchema = SchemaFactory.createForClass(TicketType);

/** 复合索引：按活动查票种是最高频查询（活动详情页），activityId 在前符合最左前缀原则 */
TicketTypeSchema.index({ activityId: 1, status: 1 });
