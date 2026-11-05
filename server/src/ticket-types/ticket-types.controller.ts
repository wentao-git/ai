/**
 * 票种控制器
 * -----------------------------------------------------------------------------
 * REST 路径设计：票种是活动的子资源，创建/列表挂在活动下面（嵌套路由），
 * 而单个票种的更新/删除用票种自己的 id 直接寻址。
 * 这是很典型的 RESTful 子资源设计：/activities/:id/ticket-types + /ticket-types/:id
 */
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TicketTypesService } from './ticket-types.service.js';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/ticket-type.dto.js';

@Controller()
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  /** POST /api/activities/:activityId/ticket-types 创建票种 */
  @Post('activities/:activityId/ticket-types')
  create(@Param('activityId') activityId: string, @Body() dto: CreateTicketTypeDto) {
    return this.ticketTypesService.create(activityId, dto);
  }

  /** GET /api/activities/:activityId/ticket-types 活动下的票种列表 */
  @Get('activities/:activityId/ticket-types')
  findByActivity(@Param('activityId') activityId: string) {
    return this.ticketTypesService.findByActivity(activityId);
  }

  /** GET /api/ticket-types/:id 票种详情 */
  @Get('ticket-types/:id')
  findOne(@Param('id') id: string) {
    return this.ticketTypesService.findOne(id);
  }

  /** PATCH /api/ticket-types/:id 更新票种 */
  @Patch('ticket-types/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketTypeDto) {
    return this.ticketTypesService.update(id, dto);
  }

  /** DELETE /api/ticket-types/:id 删除票种 */
  @Delete('ticket-types/:id')
  remove(@Param('id') id: string) {
    return this.ticketTypesService.remove(id);
  }
}
