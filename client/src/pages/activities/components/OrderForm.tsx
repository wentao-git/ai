/**
 * 下单表单（活动详情页私有组件）
 * -----------------------------------------------------------------------------
 * 下单是全站最敏感的操作，这里体现了三个防御性细节：
 * 1. 只允许选在售票种（列表在渲染前就过滤掉了 OFF_SALE）
 * 2. 提交中禁用按钮（disabled={ordering}），防止手快双击下两单
 * 3. 下单成功展示订单号 + 服务端返回的剩余库存，用户能立刻感知库存变化
 */
import { useState } from 'react'
import { createOrder } from '../../../api/orderApi.js'
import { formatPrice } from '../../../utils/format.js'
import { ORDER_STATUS_LABEL } from '../../../constants/status.js'
import { ErrorAlert } from '../../../components/ErrorAlert.js'
import type { Order } from '../../../types/order.js'
import type { TicketType } from '../../../types/ticketType.js'

interface Props {
  /** 父页面传入的票种列表（只读使用，不修改） */
  tickets: TicketType[]
  /** 下单成功后通知页面刷新（库存变了） */
  onOrdered: () => void
}

export function OrderForm({ tickets, onOrdered }: Props) {
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  const onSaleTickets = tickets.filter((t) => t.status === 'ON_SALE')
  const selected = tickets.find((t) => t._id === selectedTicketId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicketId) return
    setOrdering(true)
    setError('')
    try {
      const order = await createOrder({ ticketTypeId: selectedTicketId, quantity })
      setLastOrder(order)
      onOrdered() // 通知页面重新拉票种列表，表格里的"剩余"立即更新
    } catch (e) {
      setError(e instanceof Error ? e.message : '下单失败')
    } finally {
      setOrdering(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <select
          required
          value={selectedTicketId}
          onChange={(e) => setSelectedTicketId(e.target.value)}
        >
          {/* 禁用的占位 option：强迫用户显式选择，避免"默认买了第一个"的误操作 */}
          <option value="" disabled>
            选择票种
          </option>
          {onSaleTickets.map((t) => (
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
        <button type="submit" className="primary" disabled={ordering || !selectedTicketId}>
          {ordering ? '下单中…' : '立即下单'}
        </button>
      </div>

      {/* 前端提示限购：目前只是提示，强校验在迭代 3 的后端做 —— 永远不信任前端校验 */}
      {selected && selected.limitPerUser > 0 && quantity > selected.limitPerUser && (
        <p className="muted">注意：该票种每人限购 {selected.limitPerUser} 张</p>
      )}

      <ErrorAlert message={error} />

      {lastOrder && (
        <div className="order-result">
          下单成功！订单号 <strong>{lastOrder.orderNo}</strong>，应付金额 ¥
          {formatPrice(lastOrder.totalAmount)}，状态：
          {ORDER_STATUS_LABEL[lastOrder.status]}
          {lastOrder.remainingStock !== undefined && `（该票种剩余 ${lastOrder.remainingStock} 张）`}
          ，模拟支付将在迭代 3 接入
        </div>
      )}
    </form>
  )
}
