/**
 * 活动详情页：票种管理 + 下单
 * -----------------------------------------------------------------------------
 * 这是把"后端下单接口"串到界面上的一页：
 * 1. 主办方可以给已发布活动添加票种
 * 2. 用户选择票种和数量，点击"下单"调用 POST /api/orders
 * 3. 下单成功后展示订单号，并刷新剩余库存（让用户亲眼看到库存被扣减）
 */
import { useEffect, useState } from 'react'
import { createOrder, createTicketType, getActivity, listTicketTypes } from '../api'
import type { Activity, Order, TicketType } from '../types'
import { formatPrice, formatTime } from '../utils'

interface Props {
  activityId: string
  /** 返回列表页 */
  onBack: () => void
}

export function ActivityDetail({ activityId, onBack }: Props) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // 新增票种表单。价格输入用"元"（用户习惯），提交时乘 100 转成"分"
  const [ticketForm, setTicketForm] = useState({ name: '', priceYuan: '', totalStock: '', limitPerUser: '0' })
  const [addingTicket, setAddingTicket] = useState(false)

  // 下单状态：选中哪个票种 + 数量
  const [selectedTicket, setSelectedTicket] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [ordering, setOrdering] = useState(false)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      // 两个请求没有依赖关系，用 Promise.all 并行发出，缩短首屏等待
      const [act, tts] = await Promise.all([getActivity(activityId), listTicketTypes(activityId)])
      setActivity(act)
      setTickets(tts)
      // 默认选中第一个在售票种
      const onSale = tts.find((t) => t.status === 'ON_SALE')
      setSelectedTicket((prev) => prev || onSale?._id || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId])

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault()
    setAddingTicket(true)
    setError('')
    try {
      await createTicketType(activityId, {
        name: ticketForm.name,
        // 元 -> 分：乘 100 取整，避免小数
        price: Math.round(Number(ticketForm.priceYuan) * 100),
        totalStock: Number(ticketForm.totalStock),
        limitPerUser: Number(ticketForm.limitPerUser) || 0,
      })
      setTicketForm({ name: '', priceYuan: '', totalStock: '', limitPerUser: '0' })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建票种失败')
    } finally {
      setAddingTicket(false)
    }
  }

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicket) return
    setOrdering(true)
    setError('')
    try {
      const order = await createOrder({ ticketTypeId: selectedTicket, quantity })
      setLastOrder(order)
      // 下单成功后立刻刷新票种列表，让剩余库存的变化立即可见
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '下单失败')
    } finally {
      setOrdering(false)
    }
  }

  if (loading) return <div className="page muted">加载中…</div>
  if (!activity) return <div className="page error">{error || '活动不存在'}</div>

  const selected = tickets.find((t) => t._id === selectedTicket)

  return (
    <div className="page">
      <button className="link" onClick={onBack}>
        ← 返回活动列表
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
                  <td>{t.status === 'ON_SALE' ? '在售' : '已下架'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form className="form" onSubmit={handleAddTicket}>
          <h4>新增票种</h4>
          <div className="form-row">
            <input
              required
              placeholder="票种名称，如 内场票"
              value={ticketForm.name}
              onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })}
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="价格（元）"
              value={ticketForm.priceYuan}
              onChange={(e) => setTicketForm({ ...ticketForm, priceYuan: e.target.value })}
            />
            <input
              required
              type="number"
              min="0"
              placeholder="总库存"
              value={ticketForm.totalStock}
              onChange={(e) => setTicketForm({ ...ticketForm, totalStock: e.target.value })}
            />
            <input
              type="number"
              min="0"
              placeholder="限购(0不限)"
              value={ticketForm.limitPerUser}
              onChange={(e) => setTicketForm({ ...ticketForm, limitPerUser: e.target.value })}
            />
          </div>
          <button type="submit" disabled={addingTicket}>
            {addingTicket ? '提交中…' : '添加票种'}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>下单</h3>
        <form className="form" onSubmit={handleOrder}>
          <div className="form-row">
            <select
              value={selectedTicket}
              onChange={(e) => setSelectedTicket(e.target.value)}
              required
            >
              <option value="" disabled>
                选择票种
              </option>
              {tickets
                .filter((t) => t.status === 'ON_SALE')
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ¥{formatPrice(t.price)}（剩 {t.stock}）
                  </option>
                ))}
            </select>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
            <button type="submit" className="primary" disabled={ordering || !selectedTicket}>
              {ordering ? '下单中…' : '立即下单'}
            </button>
          </div>
          {selected && quantity > 1 && selected.limitPerUser > 0 && quantity > selected.limitPerUser && (
            <p className="muted">注意：该票种每人限购 {selected.limitPerUser} 张（迭代 1 后端暂未强校验）</p>
          )}
        </form>

        {lastOrder && (
          <div className="order-result">
            下单成功！订单号 <strong>{lastOrder.orderNo}</strong>，应付金额 ¥
            {formatPrice(lastOrder.totalAmount)}，状态：待支付（模拟支付在迭代 3 接入）
          </div>
        )}
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
