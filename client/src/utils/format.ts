/**
 * 展示层格式化工具
 * -----------------------------------------------------------------------------
 * 为什么"分 -> 元"只在展示层做？
 * - 数据链路（API、state、传参）全程用分（整数），无浮点精度问题
 * - 只有渲染给用户看的那一刻才除以 100 —— 精度问题被隔离在最后一公里，
 *   万一某处漏转换，排查面也非常小
 */

/** 分 -> 元字符串：68000 -> "680.00" */
export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** ISO 时间 -> 本地可读格式："2026年12月31日 19:00" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 把 datetime-local 输入框的值转成 ISO 字符串（提交给后端用） */
export function toIso(localDateTime: string): string {
  return new Date(localDateTime).toISOString()
}
