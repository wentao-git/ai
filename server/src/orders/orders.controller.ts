/** 订单控制器 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** POST /api/orders 下单（朴素 v1，迭代 2 换原子扣减） */
  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  /** GET /api/orders/:orderNo 按业务订单号查订单 */
  @Get('orders/:orderNo')
  findByOrderNo(@Param('orderNo') orderNo: string) {
    return this.ordersService.findByOrderNo(orderNo);
  }

  /** GET /api/orders?activityId=xxx 按活动查订单列表 */
  @Get('orders')
  findByActivity(@Query('activityId') activityId: string) {
    return this.ordersService.findByActivity(activityId);
  }
}
