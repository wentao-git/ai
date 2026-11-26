/**
 * 订单控制器
 * -----------------------------------------------------------------------------
 * 本文件最重要的点是 x-order-strategy 请求头的读取方式 ——
 * 压测脚本靠它在"同一个运行中的服务"上切换三种扣库存策略做对比，
 * 保证除策略外其余条件（进程、连接池、数据）完全一致。
 */
import { badRequest } from '../middleware/errorHandler.js'
import {
  createOrder,
  findOrderByOrderNo,
  listOrdersByActivity,
} from '../services/order.service.js'

export async function handleCreateOrder(req, res) {
  const { ticketTypeId, quantity } = req.body
  if (!ticketTypeId) {
    throw badRequest('ticketTypeId 是必填项')
  }
  // 请求头名称不区分大小写；没传就是 undefined，service 会回退默认策略 atomic
  const strategy = req.headers['x-order-strategy']

  const order = await createOrder({ ticketTypeId, quantity }, strategy)
  res.status(201).json(order)
}

export async function handleFindOrder(req, res) {
  const order = await findOrderByOrderNo(req.params.orderNo)
  res.json(order)
}

export async function handleListOrders(req, res) {
  // 查询串参数一律是字符串：?activityId=3 拿到的是 "3"，要转成数字再用
  const activityId = Number(req.query.activityId)
  if (!Number.isInteger(activityId)) {
    throw badRequest('activityId 必须是数字')
  }
  const orders = await listOrdersByActivity(activityId)
  res.json(orders)
}
