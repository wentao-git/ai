/**
 * 活动领域接口
 * -----------------------------------------------------------------------------
 * 按领域拆文件（而不是一个 api.ts 全塞下）的好处：
 * - 页面按需 import，一眼看出这个页面依赖了哪些后端能力
 * - 后端按领域改接口时，影响范围一目了然
 */
import { http } from './http.js'
import type { Activity, CreateActivityRequest } from '../types/activity.js'

/** GET /api/activities?status=xxx 活动列表（不传 status 查全部） */
export function listActivities(status?: string): Promise<Activity[]> {
  return http<Activity[]>(`/activities${status ? `?status=${status}` : ''}`)
}

/** GET /api/activities/:id 活动详情 */
export function getActivity(id: string): Promise<Activity> {
  return http<Activity>(`/activities/${id}`)
}

/** POST /api/activities 创建活动（草稿状态） */
export function createActivity(dto: CreateActivityRequest): Promise<Activity> {
  return http<Activity>('/activities', { method: 'POST', body: dto })
}

/** POST /api/activities/:id/publish 发布活动 */
export function publishActivity(id: string): Promise<Activity> {
  return http<Activity>(`/activities/${id}/publish`, { method: 'POST' })
}
