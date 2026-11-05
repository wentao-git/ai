/**
 * 票种服务：票种的增删改查
 * -----------------------------------------------------------------------------
 * 注意：库存"扣减/释放"逻辑不放在这里，而是放在 orders.service.ts。
 * 因为扣库存是"下单"这个业务动作的一部分，拆到票种服务里会让订单流程
 * 在两个服务之间跳来跳去，事务边界反而更模糊（迭代 3 引入事务时尤其重要）。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TicketType, TicketTypeDocument } from './schemas/ticket-type.schema.js';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/ticket-type.dto.js';
import { ActivitiesService } from '../activities/activities.service.js';

@Injectable()
export class TicketTypesService {
  constructor(
    @InjectModel(TicketType.name) private readonly ticketTypeModel: Model<TicketTypeDocument>,
    // 跨模块依赖：创建票种前要确认活动存在（通过 ActivitiesModule 导出）
    private readonly activitiesService: ActivitiesService,
  ) {}

  /** 在指定活动下创建票种 */
  async create(activityId: string, dto: CreateTicketTypeDto) {
    // 前置校验：活动必须存在且已发布（草稿活动也可以配置票种，这里放宽为存在即可）
    await this.activitiesService.findOne(activityId);

    if (!Number.isInteger(dto.price) || dto.price < 0) {
      throw new BadRequestException('price 必须是非负整数（单位：分）');
    }
    if (!Number.isInteger(dto.totalStock) || dto.totalStock < 0) {
      throw new BadRequestException('totalStock 必须是非负整数');
    }

    const doc = await this.ticketTypeModel.create({
      activityId,
      name: dto.name,
      price: dto.price,
      totalStock: dto.totalStock,
      // 创建时剩余库存 = 总库存
      stock: dto.totalStock,
      limitPerUser: dto.limitPerUser ?? 0,
    });
    return doc.toObject();
  }

  /** 查询某活动下的所有票种（活动详情页的主查询） */
  async findByActivity(activityId: string) {
    await this.activitiesService.findOne(activityId);
    return this.ticketTypeModel.find({ activityId }).sort({ price: 1 }).lean().exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`无效的票种 id: ${id}`);
    }
    const doc = await this.ticketTypeModel.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`票种不存在: ${id}`);
    }
    return doc;
  }

  async update(id: string, dto: UpdateTicketTypeDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`无效的票种 id: ${id}`);
    }
    const patch: Record<string, unknown> = {};
    for (const key of ['name', 'price', 'totalStock', 'limitPerUser', 'status'] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key];
    }
    // TODO(迭代2)：调整 totalStock 时要保证不小于已售数量，否则会出现"负库存"逻辑矛盾
    const doc = await this.ticketTypeModel.findByIdAndUpdate(id, patch, { new: true }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`票种不存在: ${id}`);
    }
    return doc;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`无效的票种 id: ${id}`);
    }
    // TODO(迭代2)：有未完结订单的票种不允许删除
    const doc = await this.ticketTypeModel.findByIdAndDelete(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`票种不存在: ${id}`);
    }
    return { deleted: true };
  }
}
