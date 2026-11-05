/**
 * 活动实体（MongoDB 集合：activities）
 * -----------------------------------------------------------------------------
 * 面试要点 —— 为什么金额相关字段用"分"存储？
 * - JavaScript 的 Number 是 IEEE 754 双精度浮点数，0.1 + 0.2 !== 0.3
 * - 金额如果直接用元（小数）存储和计算，累计后会出现精度丢失导致对账失败
 * - 业界通用做法：数据库存整数"分"，只在展示层做格式化（/100）
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ActivityStatus } from '../../common/enums.js';

@Schema({ timestamps: true })
export class Activity {
  /** 活动标题 */
  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  /** 活动描述（富文本场景后续迭代再考虑，这里存纯文本） */
  @Prop({ default: '' })
  description: string;

  /** 活动地点 */
  @Prop({ required: true, trim: true, maxlength: 200 })
  venue: string;

  /** 活动开始时间（存 ISO 字符串，Mongo 里是 Date 类型） */
  @Prop({ required: true, type: Date })
  startTime: Date;

  /** 活动结束时间 */
  @Prop({ required: true, type: Date })
  endTime: Date;

  /**
   * 活动状态：DRAFT(草稿) / PUBLISHED(已发布) / OFFLINE(已下线)
   * 只有 PUBLISHED 状态的活动才能下单（下单时服务层会校验）
   */
  @Prop({ required: true, enum: ActivityStatus, default: ActivityStatus.DRAFT })
  status: ActivityStatus;
}

/** HydratedDocument：带完整 Mongoose 能力（save/ populated 等）的文档类型 */
export type ActivityDocument = HydratedDocument<Activity>;

/** 由类定义自动生成 Mongoose Schema，避免手写两遍字段定义 */
export const ActivitySchema = SchemaFactory.createForClass(Activity);
