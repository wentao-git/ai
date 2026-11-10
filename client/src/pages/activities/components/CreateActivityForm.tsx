/**
 * 创建活动表单（活动列表页私有组件）
 * -----------------------------------------------------------------------------
 * 为什么表单单独拆文件而不写在页面里？
 * - 页面组件只做"取数 + 组装"，表单有自己独立的状态和校验逻辑，
 *   混在一起页面文件会快速膨胀（这正是老项目难以维护的第一原因）
 * - 受控组件模式：输入框值绑定 React state，提交时从 state 拿数据 ——
 *   数据流向单一（state -> UI），调试时可预期
 */
import { useState } from 'react'
import { createActivity } from '../../../api/activityApi.js'
import { toIso } from '../../../utils/format.js'
import { ErrorAlert } from '../../../components/ErrorAlert.js'

interface Props {
  /** 创建成功后通知页面刷新列表（数据所有权在页面，表单只发事件） */
  onCreated: () => void
}

/** 表单的初始值集中定义：新增字段时只改这一处 */
const EMPTY_FORM = { title: '', venue: '', startTime: '', endTime: '' }

export function CreateActivityForm({ onCreated }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 通用单字段更新器：免得每个输入框写一份 setForm({...form, xxx})
  // name 是字段名，value 是新值 —— 用计算属性名动态定位要更新的字段
  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault() // 阻止表单默认的整页刷新
    setSubmitting(true)
    setError('')
    try {
      await createActivity({
        title: form.title,
        venue: form.venue,
        // datetime-local 输入框给的是本地时间字符串，转成 ISO 再发给后端
        startTime: toIso(form.startTime),
        endTime: toIso(form.endTime),
      })
      setForm(EMPTY_FORM) // 成功后清空表单
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h2>创建活动</h2>
      <form className="form" onSubmit={handleSubmit}>
        <input
          required
          placeholder="活动标题"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
        <input
          required
          placeholder="活动地点"
          value={form.venue}
          onChange={(e) => update('venue', e.target.value)}
        />
        <div className="form-row">
          <label>
            开始
            <input
              required
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => update('startTime', e.target.value)}
            />
          </label>
          <label>
            结束
            <input
              required
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => update('endTime', e.target.value)}
            />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? '创建中…' : '创建活动（草稿）'}
        </button>
      </form>
      <ErrorAlert message={error} />
    </section>
  )
}
