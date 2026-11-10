/**
 * 活动详情页：票种管理 + 下单
 * -----------------------------------------------------------------------------
 * 数据流设计（理解这页就理解了 React 页面的标准数据流）：
 *
 *   useAsyncData 同时拉活动详情和票种列表（Promise.all 并行）
 *        │
 *        ├── 活动信息 -> 纯展示
 *        ├── 票种列表 -> 表格展示
 *        ├── 票种列表 -> 传给 AddTicketTypeForm / OrderForm 做选项
 *        └── reload   -> 传给子组件，子组件操作成功后通知页面重新取数
 *
 * 关键原则："数据所有权在页面，子组件只发事件"。
 * 表单不自己维护票种列表的副本 —— 单一数据源，才不会出现
 * "表单刚加的票种和表格显示的不一致"这类经典 bug
 */
import { useParams } from 'react-router-dom'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import { getActivity } from '../../api/activityApi.js'
import { listTicketTypes } from '../../api/ticketTypeApi.js'
import { formatTime, formatPrice } from '../../utils/format.js'
import { TICKET_TYPE_STATUS_LABEL } from '../../constants/status.js'
import { Loading } from '../../components/Loading.js'
import { ErrorAlert } from '../../components/ErrorAlert.js'
import { AddTicketTypeForm } from './components/AddTicketTypeForm.js'
import { OrderForm } from './components/OrderForm.js'

export function ActivityDetailPage() {
  // useParams 从路由取动态参数：对应路由表里的 activities/:id
  // 之所以是 string | undefined，是因为理论上可以直接访问 /activities/（无 id）
  const { id = '' } = useParams()

  // 两个请求没有相互依赖，用 Promise.all 并行 —— 首屏时间取决于慢的那个而非两者之和
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [activity, tickets] = await Promise.all([
      getActivity(id),
      listTicketTypes(id),
    ])
    return { activity, tickets }
  })

  // 加载判定细节（真实项目里最常见的 UX bug 之一）：
  // 只在"还没有任何数据"时才整页显示 Loading。如果已有数据（比如下单后 reload 刷新），
  // 就地保留旧内容等待新数据 —— 否则每次 reload 都会把整个页面替换成 Loading，
  // 下单表单被卸载重建，用户刚看到的"下单成功"提示会凭空消失
  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorAlert message={error} />
  if (!data) return null // 理论不可达（loading/error 必有一个为真），类型收窄用

  const { activity, tickets } = data

  return (
    <div className="page">
      <button className="link" onClick={() => window.history.back()}>
        ← 返回
      </button>

      <section className="card">
        <h2>{activity.title}</h2>
        <p className="muted">
          {formatTime(activity.startTime)} — {formatTime(activity.endTime)}
        </p>
        <p className="muted">地点：{activity.venue}</p>
        {activity.description && <p>{activity.description}</p>}
      </section>

      <section className="card">
        <h3>票种</h3>
        {tickets.length === 0 ? (
          <p className="muted">该活动还没有票种</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>价格</th>
                <th>剩余 / 总量</th>
                <th>限购</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t._id}>
                  <td>{t.name}</td>
                  <td>¥{formatPrice(t.price)}</td>
                  <td>
                    {t.stock} / {t.totalStock}
                  </td>
                  <td>{t.limitPerUser > 0 ? `${t.limitPerUser} 张` : '不限'}</td>
                  <td>{TICKET_TYPE_STATUS_LABEL[t.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <AddTicketTypeForm activityId={id} onCreated={reload} />
      </section>

      <section className="card">
        <h3>下单</h3>
        <OrderForm tickets={tickets} onOrdered={reload} />
      </section>
    </div>
  )
}
