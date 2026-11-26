/**
 * 票种路由：RESTful 子资源设计
 *   POST   /activities/:activityId/ticket-types  创建票种
 *   GET    /activities/:activityId/ticket-types  活动下的票种列表
 *   GET    /ticket-types/:id                     票种详情
 *   PATCH  /ticket-types/:id                     更新
 *   DELETE /ticket-types/:id                     删除
 * （与 Nest 版 @Controller('activities') / @Controller() 的路由完全一致）
 */
import { Router } from 'express'
import {
  handleCreateTicketType,
  handleListTicketTypes,
  handleFindTicketType,
  handleUpdateTicketType,
  handleRemoveTicketType,
} from '../controllers/ticketType.controller.js'

export const ticketTypeRouter = Router()

ticketTypeRouter.post('/activities/:activityId/ticket-types', handleCreateTicketType)
ticketTypeRouter.get('/activities/:activityId/ticket-types', handleListTicketTypes)
ticketTypeRouter.get('/ticket-types/:id', handleFindTicketType)
ticketTypeRouter.patch('/ticket-types/:id', handleUpdateTicketType)
ticketTypeRouter.delete('/ticket-types/:id', handleRemoveTicketType)
