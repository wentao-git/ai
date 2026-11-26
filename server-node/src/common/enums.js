/**
 * 全局共享的枚举定义（与 server/src/common/enums.ts 的值保持一致）
 * -----------------------------------------------------------------------------
 * JS 没有原生 enum（TS 才有），惯用做法是 Object.freeze 冻结的普通对象：
 * - freeze 后任何地方尝试改值都会静默失败（严格模式下直接报错），
 *   防止业务代码手滑把常量改了
 * 【对比学习】Mongoose 的 enum 校验在 Schema 定义里；MySQL 用的是
 * schema.sql 里的 ENUM 列类型 —— 数据库层直接拒绝非法值，更硬
 */

/** 活动状态 */
export const ActivityStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  OFFLINE: 'OFFLINE',
})

/** 票种状态 */
export const TicketTypeStatus = Object.freeze({
  ON_SALE: 'ON_SALE',
  OFF_SALE: 'OFF_SALE',
})

/** 订单状态（迭代 3/4 逐步启用全部流转） */
export const OrderStatus = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
})
