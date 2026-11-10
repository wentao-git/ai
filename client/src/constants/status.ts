/**
 * 状态展示常量
 * -----------------------------------------------------------------------------
 * 为什么单独放 constants/ 而不是散在组件里？
 * - 状态 -> 中文标签/颜色的映射是"展示契约"，多个页面（列表、详情、将来的订单页）
 *   都要用，散落会导致改一处漏三处
 * - Record<K, V> + 索引访问：新增状态值时 TypeScript 会在漏配的地方报错，
 *   这是"编译期强迫对齐"的技巧 —— 类型系统当 checklist 用
 */
import type { ActivityStatus } from '../types/activity.js'
import type { TicketTypeStatus } from '../types/ticketType.js'
import type { OrderStatus } from '../types/order.js'

/** 活动状态 -> 中文标签 */
export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '售票中',
  OFFLINE: '已下线',
}

/** 活动状态 -> 徽标配色 class（配合 global.css 里的 .badge-* 规则） */
export const ACTIVITY_STATUS_BADGE: Record<ActivityStatus, string> = {
  DRAFT: 'badge-draft',
  PUBLISHED: 'badge-published',
  OFFLINE: 'badge-offline',
}

/** 票种状态 -> 中文标签 */
export const TICKET_TYPE_STATUS_LABEL: Record<TicketTypeStatus, string> = {
  ON_SALE: '在售',
  OFF_SALE: '已下架',
}

/** 订单状态 -> 中文标签（迭代 3 起逐步用到全部状态） */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
}
