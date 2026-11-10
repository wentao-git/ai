/** 订单领域接口 */
import { http } from './http.js'
import type { Order, CreateOrderRequest } from '../types/order.js'

/**
 * POST /api/orders 下单
 * 说明：下单策略（naive/atomic/optimistic）是服务端实现细节，正常业务不感知；
 * 压测脚本（server/scripts/oversell-test.mjs）通过 x-order-strategy 头切换策略，
 * 页面一律走服务端默认的 atomic 策略
 */
export function createOrder(dto: CreateOrderRequest): Promise<Order> {
  return http<Order>('/orders', { method: 'POST', body: dto })
}

/** GET /api/orders/:orderNo 按业务订单号查订单 */
export function getOrder(orderNo: string): Promise<Order> {
  return http<Order>(`/orders/${orderNo}`)
}
