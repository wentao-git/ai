/**
 * 新增票种表单（活动详情页私有组件）
 * -----------------------------------------------------------------------------
 * 单位换算的边界在这里：用户输入"元"（习惯），提交前转"分"（数据契约）。
 * 换算只发生在这一行 —— 搜索 "Math.round" 就能找到所有元转分的位置
 */
import { useState } from 'react'
import { createTicketType } from '../../../api/ticketTypeApi.js'
import { ErrorAlert } from '../../../components/ErrorAlert.js'

interface Props {
  activityId: string
  onCreated: () => void
}

const EMPTY_FORM = { name: '', priceYuan: '', totalStock: '', limitPerUser: '0' }

export function AddTicketTypeForm({ activityId, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createTicketType(activityId, {
        name: form.name,
        // 元 -> 分：乘 100 取整。Number("") 是 0，所以 totalStock 用 required 保证非空
        price: Math.round(Number(form.priceYuan) * 100),
        totalStock: Number(form.totalStock),
        // "0" 或空串都归一为 0（不限购）—— 输入边界在提交处统一清洗
        limitPerUser: Number(form.limitPerUser) || 0,
      })
      setForm(EMPTY_FORM)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建票种失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h4>新增票种</h4>
      <div className="form-row">
        <input
          required
          placeholder="票种名称，如 内场票"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <input
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="价格（元）"
          value={form.priceYuan}
          onChange={(e) => update('priceYuan', e.target.value)}
        />
        <input
          required
          type="number"
          min="0"
          placeholder="总库存"
          value={form.totalStock}
          onChange={(e) => update('totalStock', e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder="限购(0不限)"
          value={form.limitPerUser}
          onChange={(e) => update('limitPerUser', e.target.value)}
        />
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? '提交中…' : '添加票种'}
      </button>
      <ErrorAlert message={error} />
    </form>
  )
}
