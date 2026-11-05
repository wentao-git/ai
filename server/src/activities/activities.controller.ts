/**
 * 活动控制器：REST 接口层
 * -----------------------------------------------------------------------------
 * 全局前缀是 /api（main.ts 里 setGlobalPrefix），所以这里 @Controller('activities')
 * 实际暴露的路径是 /api/activities，和 client/vite.config.ts 里的代理规则对上。
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service.js';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto.js';
import { ActivityStatus } from '../common/enums.js';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /** POST /api/activities 创建活动 */
  @Post()
  create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.create(dto);
  }

  /** GET /api/activities?status=PUBLISHED 活动列表 */
  @Get()
  findAll(@Query('status') status?: ActivityStatus) {
    return this.activitiesService.findAll(status);
  }

  /** GET /api/activities/:id 活动详情 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  /** PATCH /api/activities/:id 部分更新 */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activitiesService.update(id, dto);
  }

  /** POST /api/activities/:id/publish 发布活动（语义化状态流转接口） */
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.activitiesService.publish(id);
  }

  /** DELETE /api/activities/:id 删除活动 */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }
}
