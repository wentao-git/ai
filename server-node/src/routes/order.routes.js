/** 订单路由：POST /orders 下单、GET /orders/:orderNo 查单、GET /orders?activityId= 列表 */
import { Router } from 'express'
import {
  handleCreateOrder,
  handleFindOrder,
  handleListOrders,
} from '../controllers/order.controller.js'

export const orderRouter = Router()

// 注意顺序：/orders/:orderNo 和 /orders（列表）不冲突，
// 但若将来加 GET /orders/statistics 这类静态路径，必须注册在 :orderNo 之前
orderRouter.post('/orders', handleCreateOrder)
orderRouter.get('/orders', handleListOrders)
orderRouter.get('/orders/:orderNo', handleFindOrder)
