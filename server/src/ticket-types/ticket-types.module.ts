/** 票种模块 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketType, TicketTypeSchema } from './schemas/ticket-type.schema.js';
import { TicketTypesController } from './ticket-types.controller.js';
import { TicketTypesService } from './ticket-types.service.js';
import { ActivitiesModule } from '../activities/activities.module.js';

@Module({
  imports: [
    // 活动校验依赖 ActivitiesService（已由 ActivitiesModule 提供）
    ActivitiesModule,
    MongooseModule.forFeature([{ name: TicketType.name, schema: TicketTypeSchema }]),
  ],
  controllers: [TicketTypesController],
  providers: [TicketTypesService],
})
export class TicketTypesModule {}
