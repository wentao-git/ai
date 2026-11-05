/**
 * 与后端 API 契约对应的 TypeScript 类型
 * -----------------------------------------------------------------------------
 * 为什么手动维护一份而不是从 server 生成？
 * - client 和 server 是两个独立工程（用户要求），不共享 node_modules
 * - 简单项目手动维护即可；如果后续字段同步成本变高，
 *   可以考虑把类型抽成共享包或者用 OpenAPI 自动生成（面试可聊的演进方向）
 */

/** 活动状态：与 server/src/common/enums.ts 保持一致 */
export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

/** 票种状态 */
export type TicketTypeStatus = 'ON_SALE' | 'OFF_SALE'

/** 订单状态（迭代 1 只会用到 PENDING_PAYMENT） */
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'EXPIRED'

export interface Activity {
  _id: string
  title: string
  description: string
  venue: string
  startTime: string
  endTime: string
  status: ActivityStatus
  createdAt: string
  updatedAt: string
}

export interface TicketType {
  _id: string
  activityId: string
  name: string
  /** 单位：分 */
  price: number
  totalStock: number
  stock: number
  limitPerUser: number
  status: TicketTypeStatus
}

export interface Order {
  orderNo: string
  activityId: string
  ticketTypeId: string
  quantity: number
  /** 单位：分 */
  unitPrice: number
  /** 单位：分 */
  totalAmount: number
  status: OrderStatus
  payExpireAt: string
}

/** 后端业务报错时返回的结构（NestJS 默认异常响应格式） */
export interface ApiError {
  message: string
  error: string
  statusCode: number
}
