/**
 * 应用布局：顶栏 + 内容区
 * -----------------------------------------------------------------------------
 * <Outlet/> 是 react-router 的"插槽"：子路由匹配到的页面组件会渲染在这里。
 * 顶栏只在布局里写一次，所有页面自动共享 —— 加新页面零成本获得一致的外观。
 *
 * 后续扩展位（先占坑不实现，避免过度设计）：
 * - 用户登录态（迭代 5+ 加"我的订单"入口时顶栏加右侧导航）
 * - 全局消息 Toast（放进布局意味着所有页面自动可用）
 */
import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Loading } from '../components/Loading.js'

export function AppLayout() {
  return (
    <main className="app">
      <header className="header">
        <h1>🎟 TicketFlow 票务预订系统</h1>
        <p className="muted">活动 · 票种 · 下单锁库存 · 模拟支付 · 超时释放</p>
      </header>

      {/*
        Suspense 包住 Outlet：子路由的页面组件都是 lazy 懒加载的，
        chunk 下载期间显示 Loading —— 这是 React 官方推荐的懒加载配套写法
      */}
      <Suspense fallback={<Loading text="页面加载中…" />}>
        <Outlet />
      </Suspense>
    </main>
  )
}
