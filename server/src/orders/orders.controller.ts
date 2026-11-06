/**
 * 订单控制器
 * -----------------------------------------------------------------------------
 * 迭代 2 新增：x-order-strategy 请求头可以临时覆盖下单策略。
 *
 * 为什么要这个头？（面试可讲：实验可控性设计）
 * - 压测脚本要在"同一个运行中的服务"上对比 naive / atomic 两种策略，
 *   如果靠重启服务改环境变量，两次压测之间进程缓存、连接池状态都不同，
 *   对比结果就不纯了 —— 请求级切换保证除了策略本身，其余条件完全一致
 * - 生产上这个头不应该暴露（策略是实现细节，不是 API 契约），
 *   更严谨的做法是只在非生产环境启用，这里为了演示简便直接开放
 */
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
// 注意 import type：isolatedModules + emitDecoratorMetadata 组合下，
// 出现在装饰器参数里的类型必须用类型导入（否则 emit 的元数据引用运行时不存在的东西）
import type { OrderStrategy } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** POST /api/orders 下单（策略由 x-order-strategy 头或服务默认值决定） */
  @Post('orders')
  createOrder(
    @Body() dto: CreateOrderDto,
    // Headers 装饰器取指定请求头；没传就是 undefined，Service 会回退到默认策略
    @Headers('x-order-strategy') strategy?: OrderStrategy,
  ) {
    return this.ordersService.createOrder(dto, strategy);
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
