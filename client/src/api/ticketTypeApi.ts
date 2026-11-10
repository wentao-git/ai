/** 票种领域接口 */
import { http } from './http.js'
import type { TicketType, CreateTicketTypeRequest } from '../types/ticketType.js'

/** GET /api/activities/:activityId/ticket-types 活动下的票种列表 */
export function listTicketTypes(activityId: string): Promise<TicketType[]> {
  return http<TicketType[]>(`/activities/${activityId}/ticket-types`)
}

/** POST /api/activities/:activityId/ticket-types 创建票种 */
export function createTicketType(
  activityId: string,
  dto: CreateTicketTypeRequest,
): Promise<TicketType> {
  return http<TicketType>(`/activities/${activityId}/ticket-types`, {
    method: 'POST',
    body: dto,
  })
}
