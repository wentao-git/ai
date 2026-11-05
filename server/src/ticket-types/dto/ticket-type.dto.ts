/** 票种模块 DTO */
import { TicketTypeStatus } from '../../common/enums.js';

/** 在指定活动下创建票种 */
export class CreateTicketTypeDto {
  name: string;
  /** 单位：分（整数） */
  price: number;
  totalStock: number;
  /** 每人限购，0 表示不限 */
  limitPerUser?: number;
}

/** 更新票种 */
export class UpdateTicketTypeDto {
  name?: string;
  price?: number;
  totalStock?: number;
  limitPerUser?: number;
  status?: TicketTypeStatus;
}
