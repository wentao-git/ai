/** 票种相关类型定义（对应后端 server/src/ticket-types） */

/** 票种状态（和后端 enum 的值保持一致） */
export type TicketTypeStatus = 'ON_SALE' | 'OFF_SALE'

/** 票种实体 */
export interface TicketType {
  _id: string
  activityId: string
  name: string
  /** 票价，单位：分（后端统一存分，前端展示层才转元） */
  price: number
  totalStock: number
  /** 剩余可售库存 */
  stock: number
  /** 每人限购，0 表示不限 */
  limitPerUser: number
  status: TicketTypeStatus
}

/** 创建票种请求体 */
export interface CreateTicketTypeRequest {
  name: string
  price: number
  totalStock: number
  limitPerUser?: number
}
