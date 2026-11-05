/**
 * 活动模块：把活动相关的 controller/service/schema 组织在一起
 * MongooseModule.forFeature 负责把 Model 注册到本模块的注入容器
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from './schemas/activity.schema.js';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Activity.name, schema: ActivitySchema }])],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  // 导出 Service：票种模块创建票种前需要调用 ActivitiesService 校验活动
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
