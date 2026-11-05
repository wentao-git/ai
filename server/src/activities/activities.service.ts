/**
 * 活动服务：承载活动相关的业务逻辑
 * -----------------------------------------------------------------------------
 * NestJS 分层约定：Controller 只做"协议层"（解析请求、组织响应），
 * 业务规则全部放 Service。好处：Service 可被复用（比如定时任务、其他模块调用）、
 * 可被单独单测，不依赖 HTTP 上下文。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument } from './schemas/activity.schema.js';
import { ActivityStatus } from '../common/enums.js';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(
    // InjectModel：把 Mongoose 的 Model 注入进来，构造函数参数名必须和
    // 模块里 MongooseModule.forFeature 注册的名字一致
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
  ) {}

  /** 校验 id 是否为合法的 MongoDB ObjectId，避免非法 id 直接抛底层驱动错误 */
  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`无效的活动 id: ${id}`);
    }
  }

  /** 创建活动，默认草稿状态（创建即发布是危险设计，显式发布更安全） */
  async create(dto: CreateActivityDto) {
    // 边界校验：日期字符串非法时 new Date() 会得到 Invalid Date，
    // 不拦住的话会一路穿透到数据库层抛 500，对用户不友好（应为 400）
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException('startTime/endTime 必须是合法的日期时间字符串');
    }
    if (endTime <= startTime) {
      throw new BadRequestException('endTime 必须晚于 startTime');
    }

    const doc = await this.activityModel.create({
      title: dto.title,
      description: dto.description ?? '',
      venue: dto.venue,
      startTime,
      endTime,
    });
    return doc.toObject();
  }

  /** 活动列表；支持按状态过滤（前端"进行中/草稿"标签页） */
  async findAll(status?: ActivityStatus) {
    const filter = status ? { status } : {};
    // sort: 开始时间倒序，越近开场越靠前
    return this.activityModel.find(filter).sort({ startTime: -1 }).lean().exec();
  }

  async findOne(id: string) {
    this.assertObjectId(id);
    const doc = await this.activityModel.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`活动不存在: ${id}`);
    }
    return doc;
  }

  /** 部分更新：只覆盖 DTO 中显式传入的字段 */
  async update(id: string, dto: UpdateActivityDto) {
    this.assertObjectId(id);
    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.venue !== undefined) patch.venue = dto.venue;
    if (dto.startTime !== undefined) patch.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined) patch.endTime = new Date(dto.endTime);
    if (dto.status !== undefined) patch.status = dto.status;

    const doc = await this.activityModel.findByIdAndUpdate(id, patch, { new: true }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`活动不存在: ${id}`);
    }
    return doc;
  }

  /**
   * 发布活动：草稿 -> 已发布
   * 单独一个接口而不是走通用 update：状态流转是业务动作，语义化接口更清晰，
   * 也为迭代 3 的"状态机校验"预留位置（比如要求至少有一个在售票种才能发布）
   */
  async publish(id: string) {
    this.assertObjectId(id);
    const doc = await this.activityModel
      .findByIdAndUpdate(id, { status: ActivityStatus.PUBLISHED }, { new: true })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException(`活动不存在: ${id}`);
    }
    return doc;
  }

  async remove(id: string) {
    this.assertObjectId(id);
    // TODO(迭代2)：删除前应校验是否存在未完结订单，防止数据悬空
    const doc = await this.activityModel.findByIdAndDelete(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`活动不存在: ${id}`);
    }
    return { deleted: true };
  }
}
