/**
 * 全局通用组件目录
 * -----------------------------------------------------------------------------
 * 目录约定（公司项目的常见分层）：
 * - components/   跨页面复用的"哑组件"（不关心业务，只负责展示）
 * - pages/xx/components/  只属于某个页面的组件（页面私有，放页面目录里）
 * - 判断标准：第二个页面也要用时才上移到全局 components/，避免过早抽象
 */

/** 加载占位：所有页面的 loading 状态统一视觉 */
export function Loading({ text = '加载中…' }: { text?: string }) {
  return <p className="muted">{text}</p>
}
