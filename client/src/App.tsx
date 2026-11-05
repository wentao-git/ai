/**
 * 应用根组件
 * -----------------------------------------------------------------------------
 * 迭代 1 先用最简单的"状态切换视图"实现两个页面（列表 / 详情）。
 * 不引入 react-router 的原因：页面只有两级，路由库是纯开销；
 * 迭代 5 做订单列表/支付页时页面多了，再引入路由（会留下演进注释）。
 */
import { useState } from 'react'
import { ActivityList } from './pages/ActivityList'
import { ActivityDetail } from './pages/ActivityDetail'
import './App.css'

function App() {
  /** 当前打开的活动 id；为 null 时显示列表页 */
  const [openActivityId, setOpenActivityId] = useState<string | null>(null)

  return (
    <main className="app">
      <header className="header">
        <h1>🎟 TicketFlow 票务预订系统</h1>
        <p className="muted">
          活动 · 票种 · 下单锁库存 · 模拟支付 · 超时释放（迭代 1：基础链路已打通）
        </p>
      </header>

      {openActivityId ? (
        <ActivityDetail activityId={openActivityId} onBack={() => setOpenActivityId(null)} />
      ) : (
        <ActivityList onOpenActivity={setOpenActivityId} />
      )}
    </main>
  )
}

export default App
