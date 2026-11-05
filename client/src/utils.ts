/**
 * 展示层工具函数
 * -----------------------------------------------------------------------------
 * 金额在数据库和 API 里统一用"分"（整数），只在展示层转成"元"。
 * 这样精度问题被隔离在最后一公里，核心链路全程整数运算。
 */

/** 分 -> 元字符串，如 68000 -> "680.00" */
export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** ISO 时间 -> 本地可读格式，如 "2026年12月31日 19:00" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 活动状态 -> 中文标签 */
export const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '售票中',
  OFFLINE: '已下线',
}
