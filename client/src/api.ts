/**
 * 统一的 API 请求封装
 * -----------------------------------------------------------------------------
 * 为什么所有请求都走 /api 开头的相对路径？
 * - 开发环境：vite.config.ts 里配置了代理，/api 会被转发到 http://localhost:3000，
 *   前端代码完全不用关心后端在哪个端口
 * - 生产环境：nginx 把 /api 反代到后端服务，前端代码一行不用改
 *   （这叫"同源抽象"，避免在代码里散落各种 http://localhost:3000）
 */
import type { Activity, ApiError, Order, TicketType } from './types'

/** 统一处理错误：把 NestJS 的错误响应转成友好文案抛给调用方 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    // NestJS 抛出的 HttpException 统一返回 { message, error, statusCode }
    let message = `请求失败 (${res.status})`
    try {
      const body = (await res.json()) as ApiError
      if (body?.message) message = body.message
    } catch {
      // 响应不是 JSON（比如网关错误 HTML），保留默认文案
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

// ---------------- 活动 ----------------

export const listActivities = (status?: string) =>
  request<Activity[]>(`/activities${status ? `?status=${status}` : ''}`)

export const getActivity = (id: string) => request<Activity>(`/activities/${id}`)

export const createActivity = (dto: Partial<Activity>) =>
  request<Activity>('/activities', { method: 'POST', body: JSON.stringify(dto) })

export const publishActivity = (id: string) =>
  request<Activity>(`/activities/${id}/publish`, { method: 'POST' })

// ---------------- 票种 ----------------

export const listTicketTypes = (activityId: string) =>
  request<TicketType[]>(`/activities/${activityId}/ticket-types`)

export const createTicketType = (
  activityId: string,
  dto: { name: string; price: number; totalStock: number; limitPerUser?: number },
) =>
  request<TicketType>(`/activities/${activityId}/ticket-types`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })

// ---------------- 订单 ----------------

export const createOrder = (dto: { ticketTypeId: string; quantity: number }) =>
  request<Order>('/orders', { method: 'POST', body: JSON.stringify(dto) })

export const getOrder = (orderNo: string) => request<Order>(`/orders/${orderNo}`)
