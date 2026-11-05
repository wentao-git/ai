/**
 * 应用根模块：组装所有业务模块和基础设施（数据库连接）
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { TicketTypesModule } from './ticket-types/ticket-types.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [
    // MongoDB 连接配置
    // 连接串放环境变量，代码里给默认值：本地开发零配置即可跑起来，
    // 生产环境用 MONGODB_URI 覆盖（12-factor app 原则：配置与代码分离）
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/ticket_booking'),
    ActivitiesModule,
    TicketTypesModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
