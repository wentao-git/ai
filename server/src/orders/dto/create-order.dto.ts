/** 下单请求 DTO */
export class CreateOrderDto {
  /** 要购买的票种 id */
  ticketTypeId: string;
  /** 购买数量，正整数 */
  quantity: number;

  /**
   * 预留：幂等键（客户端生成的唯一标识，防止重复提交）
   * 迭代 3 实现支付回调幂等时启用，这里先在 DTO 里占位并写进注释
   */
  idempotencyKey?: string;
}
