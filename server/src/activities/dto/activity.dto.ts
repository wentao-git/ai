/**
 * 活动模块的 DTO（Data Transfer Object，数据传输对象）
 * -----------------------------------------------------------------------------
 * 为什么不直接用 entity 接收请求体？
 * - entity 是数据库的完整模型，直接暴露会让客户端可以伪造 status 等不该由它控制的字段
 * - DTO 明确定义"客户端允许传什么"，是 API 边界的契约
 *
 * 为什么没有用 class-validator 做装饰器校验？
 * - 迭代 1 先用服务层的手工校验，保持依赖最小
 * - 迭代 3 引入幂等键时一起升级为 class-validator + ValidationPipe（会保留 TODO 标记）
 */
import { ActivityStatus } from '../../common/enums.js';

/** 创建活动 */
export class CreateActivityDto {
  title: string;
  description?: string;
  venue: string;
  /** ISO 8601 字符串，如 2026-12-31T19:00:00+08:00 */
  startTime: string;
  endTime: string;
}

/** 更新活动（所有字段可选，只更新传入的部分） */
export class UpdateActivityDto {
  title?: string;
  description?: string;
  venue?: string;
  startTime?: string;
  endTime?: string;
  status?: ActivityStatus;
}
