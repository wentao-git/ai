/**
 * 应用根组件
 * -----------------------------------------------------------------------------
 * App 只负责一件事：把路由器接到 React 树上。
 * 页面结构去 router/index.tsx 看，页面实现去 pages/ 看 ——
 * 根组件保持"薄"，是大型项目可维护性的基本要求
 */
import { RouterProvider } from 'react-router-dom'
import { router } from './router/index.js'

export default function App() {
  return <RouterProvider router={router} />
}
