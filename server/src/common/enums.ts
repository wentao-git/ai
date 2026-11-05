/**
 * 全局共享的枚举定义
 * -----------------------------------------------------------------------------
 * 为什么单独放在 common/ 里？
 * - 活动状态、订单状态会被多个模块引用（比如订单模块要校验活动是否已发布），
 *   放在某个业务模块内部会导致跨模块的奇怪依赖关系
 * - 前端也需要同一套状态值，枚举值是"前后端契约"的一部分，独立存放便于对齐
 */

/** 活动状态机（迭代 3 之前先用简单的手工维护状态，后续迭代会加状态流转约束） */
export enum ActivityStatus {
  /** 草稿：创建后默认状态，尚未对外可见 */
  DRAFT = 'DRAFT',
  /** 已发布：对外可见，可以创建票种、接受下单 */
  PUBLISHED = 'PUBLISHED',
  /** 已下线：不再可见，已有的订单不受影响 */
  OFFLINE = 'OFFLINE',
}

/** 票种状态 */
export enum TicketTypeStatus {
  /** 在售：可以下单 */
  ON_SALE = 'ON_SALE',
  /** 已下架：不能下单（已生成的订单不受影响） */
  OFF_SALE = 'OFF_SALE',
}

/**
 * 订单状态机（本迭代只用到 PENDING_PAYMENT，其余状态在迭代 3/4 逐步启用）
 * PENDING_PAYMENT ──支付成功──> PAID
 *        │
 *        ├──用户取消──> CANCELLED
 *        └──超时未支付──> EXPIRED（迭代 4 实现，同时释放库存）
 */
export enum OrderStatus {
  /** 待支付：下单成功后的初始状态，库存已被锁定 */
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  /** 已支付：模拟支付成功（迭代 3 实现） */
  PAID = 'PAID',
  /** 已取消：用户主动取消，库存立即释放（迭代 3 实现） */
  CANCELLED = 'CANCELLED',
  /** 已过期：超时未支付，定时任务释放库存（迭代 4 实现） */
  EXPIRED = 'EXPIRED',
}
