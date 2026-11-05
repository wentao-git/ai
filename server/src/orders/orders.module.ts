/** 订单模块 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { TicketType, TicketTypeSchema } from '../ticket-types/schemas/ticket-type.schema.js';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema.js';

@Module({
  imports: [
    // 下单要同时操作票种和活动，所以直接注册三个 Model
    // （没有走 ActivitiesModule/TicketTypesModule 的 Service，因为下单只需要
    //  数据校验而不需要完整的 CRUD 能力，直接用 Model 更轻）
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: TicketType.name, schema: TicketTypeSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
