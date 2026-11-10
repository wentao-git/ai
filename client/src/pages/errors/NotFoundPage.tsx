/**
 * 404 页面：路由表里 * 路由的兜底页
 * 有兜底页的目的是把手输错误地址的用户"接住"，而不是白屏或裸报错
 */
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page">
      <section className="card">
        <h2>404 · 页面不存在</h2>
        <p className="muted">你要找的页面不存在，或者已被移除。</p>
        <Link to="/activities">
          <button className="primary">回到活动列表</button>
        </Link>
      </section>
    </div>
  )
}
