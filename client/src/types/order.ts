/** 订单相关类型定义（对应后端 server/src/orders） */

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'EXPIRED'

/** 订单实体 */
export interface Order {
  /** 业务订单号（对外标识，不是 Mongo 的 _id） */
  orderNo: string
  activityId: string
  ticketTypeId: string
  quantity: number
  /** 下单时刻票价快照，单位：分 */
  unitPrice: number
  totalAmount: number
  status: OrderStatus
  /** 支付截止时间（迭代 4 超时释放用） */
  payExpireAt: string
  /** 迭代 2 起下单接口附带返回的剩余库存（方便前端即时刷新展示） */
  remainingStock?: number
}

/** 下单请求体 */
export interface CreateOrderRequest {
  ticketTypeId: string
  quantity: number
}
