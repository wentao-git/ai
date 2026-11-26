/**
 * 票种控制器（HTTP 层，职责说明见 activity.controller.js 头注释）
 */
import { badRequest } from '../middleware/errorHandler.js'
import {
  createTicketType,
  listTicketTypes,
  findTicketType,
  updateTicketType,
  removeTicketType,
} from '../services/ticketType.service.js'

export async function handleCreateTicketType(req, res) {
  const { name, price, totalStock, limitPerUser } = req.body
  if (!name || price === undefined || totalStock === undefined) {
    throw badRequest('name/price/totalStock 都是必填项')
  }
  // 路径参数 activityId 是字符串，MySQL 按 BIGINT 比较时会自动转数字；
  // 但"123abc"这种值交给数据库会报错，先在这里拦掉并给出 400
  if (!Number.isInteger(Number(req.params.activityId))) {
    throw badRequest(`无效的活动 id: ${req.params.activityId}`)
  }
  const ticket = await createTicketType(Number(req.params.activityId), {
    name,
    price,
    totalStock,
    limitPerUser,
  })
  res.status(201).json(ticket)
}

export async function handleListTicketTypes(req, res) {
  const tickets = await listTicketTypes(Number(req.params.activityId))
  res.json(tickets)
}

export async function handleFindTicketType(req, res) {
  const ticket = await findTicketType(Number(req.params.id))
  res.json(ticket)
}

export async function handleUpdateTicketType(req, res) {
  const ticket = await updateTicketType(Number(req.params.id), req.body)
  res.json(ticket)
}

export async function handleRemoveTicketType(req, res) {
  const result = await removeTicketType(Number(req.params.id))
  res.json(result)
}
