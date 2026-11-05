/**
 * 活动列表页
 * -----------------------------------------------------------------------------
 * 兼顾"观众视角"（浏览售票中的活动）和"主办方视角"（创建活动、发布活动），
 * 方便在演示时一页完成整个链路：创建 -> 发布 -> 进详情页下单。
 */
import { useEffect, useState } from 'react'
import { createActivity, listActivities, publishActivity } from '../api'
import type { Activity } from '../types'
import { ACTIVITY_STATUS_LABEL, formatTime } from '../utils'

interface Props {
  /** 点击某个活动时通知父组件切换到详情视图 */
  onOpenActivity: (id: string) => void
}

export function ActivityList({ onOpenActivity }: Props) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // 新建活动的表单状态（受控组件：输入框的值和 React state 双向同步）
  const [form, setForm] = useState({ title: '', venue: '', startTime: '', endTime: '' })

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      // 列表页展示所有状态的活动，方便主办方看到自己的草稿
      setActivities(await listActivities())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // useEffect 的依赖数组为空 = 只在组件首次挂载时执行一次
  useEffect(() => {
    void refresh()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault() // 阻止表单默认的整页刷新行为
    setCreating(true)
    setError('')
    try {
      await createActivity(form)
      setForm({ title: '', venue: '', startTime: '', endTime: '' })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  async function handlePublish(id: string) {
    setError('')
    try {
      await publishActivity(id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败')
    }
  }

  return (
    <div className="page">
      <section className="card">
        <h2>创建活动</h2>
        <form className="form" onSubmit={handleCreate}>
          <input
            required
            placeholder="活动标题"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            required
            placeholder="活动地点"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
          <div className="form-row">
            <label>
              开始
              <input
                required
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </label>
            <label>
              结束
              <input
                required
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
          </div>
          <button type="submit" disabled={creating}>
            {creating ? '创建中…' : '创建活动（草稿）'}
          </button>
        </form>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>全部活动</h2>
        {loading ? (
          <p className="muted">加载中…</p>
        ) : activities.length === 0 ? (
          <p className="muted">还没有活动，先在上面创建一个吧</p>
        ) : (
          <ul className="activity-list">
            {activities.map((a) => (
              <li key={a._id} className="activity-item">
                <div className="activity-main">
                  <span className={`badge badge-${a.status.toLowerCase()}`}>
                    {ACTIVITY_STATUS_LABEL[a.status]}
                  </span>
                  <strong className="activity-title">{a.title}</strong>
                  <span className="muted">
                    {formatTime(a.startTime)} · {a.venue}
                  </span>
                </div>
                <div className="activity-actions">
                  {a.status === 'DRAFT' && (
                    <button onClick={() => handlePublish(a._id)}>发布</button>
                  )}
                  <button className="primary" onClick={() => onOpenActivity(a._id)}>
                    进入详情
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="muted hint">
        提示：活动发布后才能在详情页配置票种和下单（后端会校验活动状态）。价格单位为分，展示时才换算成元。
      </p>
    </div>
  )
}
