/**
 * 活动列表页
 * -----------------------------------------------------------------------------
 * 页面组件的职责边界（公司项目的通用约定）：
 * - 页面组件（*Page.tsx）负责：取数、组装、路由跳转
 * - 具体表单/卡片拆到 pages/activities/components/ 下的私有子组件
 * - 页面文件保持"一屏能看完主干"的长度，细节下放子组件
 */
import { Link } from 'react-router-dom'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import { listActivities, publishActivity } from '../../api/activityApi.js'
import { ACTIVITY_STATUS_BADGE, ACTIVITY_STATUS_LABEL } from '../../constants/status.js'
import { formatTime } from '../../utils/format.js'
import { Loading } from '../../components/Loading.js'
import { ErrorAlert } from '../../components/ErrorAlert.js'
import { CreateActivityForm } from './components/CreateActivityForm.js'
import { useState } from 'react'
import type { Activity } from '../../types/activity.js'

export function ActivityListPage() {
  // hook 里传函数引用即可，取数逻辑（loading/error/竞态）全部由 useAsyncData 托管
  const { data: activities, loading, error, reload } = useAsyncData(() => listActivities())

  // 发布动作的独立状态：和页面级 loading 分开，避免点发布时整个列表闪加载态
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  async function handlePublish(id: string) {
    setPublishingId(id)
    setActionError('')
    try {
      await publishActivity(id)
      reload() // 发布成功后重新拉列表，徽标自动变成"售票中"
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '发布失败')
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <div className="page">
      <CreateActivityForm onCreated={reload} />

      <ErrorAlert message={actionError} />

      <section className="card">
        <h2>全部活动</h2>
        {loading ? (
          <Loading />
        ) : !activities || activities.length === 0 ? (
          <p className="muted">还没有活动，先在上面创建一个吧</p>
        ) : (
          <ul className="activity-list">
            {activities.map((a: Activity) => (
              <li key={a._id} className="activity-item">
                <div className="activity-main">
                  <span className={`badge ${ACTIVITY_STATUS_BADGE[a.status]}`}>
                    {ACTIVITY_STATUS_LABEL[a.status]}
                  </span>
                  <strong className="activity-title">{a.title}</strong>
                  <span className="muted">
                    {formatTime(a.startTime)} · {a.venue}
                  </span>
                </div>
                <div className="activity-actions">
                  {a.status === 'DRAFT' && (
                    <button disabled={publishingId === a._id} onClick={() => handlePublish(a._id)}>
                      {publishingId === a._id ? '发布中…' : '发布'}
                    </button>
                  )}
                  {/* Link 做页面内跳转（不整页刷新），路径和路由表里的 :id 参数对应 */}
                  <Link to={`/activities/${a._id}`}>
                    <button className="primary">进入详情</button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ErrorAlert message={error} />
    </div>
  )
}
