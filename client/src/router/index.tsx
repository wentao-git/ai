/**
 * 路由配置 —— 整个应用的"页面地图"
 * -----------------------------------------------------------------------------
 * 为什么用 createBrowserRouter + 集中配置，而不是在组件里到处写 <Route>？
 * 1. 集中可见：一个文件看完整个应用的页面结构，新同事/面试官 30 秒建立全局认知
 * 2. 懒加载天然支持：每个页面独立 chunk，进哪个页面才下载哪个页面的 JS
 *    （首屏体积优化，生产项目的标配）
 * 3. 后续加页面 = 在 children 里加一行，改动是"增量"的，不会碰到别的页面
 *
 * 路径设计（RESTful 风格，和后端 URL 体系对齐）：
 *   /                     -> 重定向到 /activities（列表页是默认首页）
 *   /activities           -> 活动列表
 *   /activities/:id       -> 活动详情（:id 是动态参数，useParams 取值）
 *   *                     -> 404 兜底（用户手输错误地址时不至于白屏）
 *
 * 布局说明：所有页面都渲染在 AppLayout 里（顶栏 + <Outlet/>），
 * 顶栏/侧栏这类"每页都一样"的 UI 只写一次 —— 这就是布局路由的意义
 */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import { AppLayout } from '../layouts/AppLayout.js'

// lazy() 把页面组件变成按需加载：路由匹配到时才拉取对应 chunk。
// 配套必须在父层级包 <Suspense>（AppLayout 里已包），否则懒加载时白屏
const ActivityListPage = lazy(() =>
  import('../pages/activities/ActivityListPage.js').then((m) => ({
    default: m.ActivityListPage,
  })),
)
const ActivityDetailPage = lazy(() =>
  import('../pages/activities/ActivityDetailPage.js').then((m) => ({
    default: m.ActivityDetailPage,
  })),
)
const NotFoundPage = lazy(() =>
  import('../pages/errors/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })),
)

export const router = createBrowserRouter([
  {
    path: '/',
    // 布局路由：它自己不渲染页面内容，渲染 <Outlet/>，由子路由决定展示哪个页面
    element: <AppLayout />,
    children: [
      // index: true 表示"父路径正是 / 时"的默认子路由
      { index: true, element: <Navigate to="/activities" replace /> },
      { path: 'activities', element: <ActivityListPage /> },
      { path: 'activities/:id', element: <ActivityDetailPage /> },
      // 没有匹配到任何路由时兜底 404（星号路由放最后）
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
