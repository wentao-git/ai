import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'

/**
 * 应用挂载入口
 * StrictMode：开发期故意把组件渲染两遍、把 effect 执行两遍，
 * 用来提前暴露"不纯净的渲染逻辑"和"缺失清理的副作用"。
 * 它只在开发环境生效，生产构建不受影响 —— 主动拥抱它而不是绕过它
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
