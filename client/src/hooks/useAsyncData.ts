/**
 * 通用异步数据加载 Hook
 * -----------------------------------------------------------------------------
 * 为什么抽这个 hook？
 * - "挂载时请求 + loading/error 状态 + 失败提示"是每个列表页的固定套路，
 *   不抽的话每个页面都复制一遍 useState x3 + useEffect —— 复制粘贴是 bug 温床
 * - 返回 reload：详情页下单成功后要刷新票种列表，直接调 reload() 即可
 *
 * 泛型说明：T 是数据类型，hook 不关心 T 是活动列表还是票种列表 ——
 * "怎么加载"和"加载什么"分离，这是泛型 hook 的典型用法
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncDataResult<T> {
  data: T | null
  loading: boolean
  error: string
  /** 重新执行一次加载（下单后刷新库存就是用它） */
  reload: () => void
}

export function useAsyncData<T>(fetcher: () => Promise<T>): AsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 用 ref 包住 fetcher：useEffect 依赖数组里只放 reloadKey，
  // 否则调用方每次渲染传进来的新函数引用都会触发无限重渲染（React 经典坑）
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // reloadKey 变化 = 手动要求重新加载（reload 触发）
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false // 竞态防护：组件卸载/重新加载后，旧请求的结果不再落地
    setLoading(true)
    setError('')

    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败，请稍后重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // cleanup：在"请求还在路上时组件卸载或依赖变化"的场景置位取消标记，
    // 防止旧响应覆盖新状态（React 18 严格模式 + 快速切换页面时必现的竞态）
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return { data, loading, error, reload }
}
