/**
 * HTTP 基础封装 —— 所有接口请求的唯一出口
 * -----------------------------------------------------------------------------
 * 为什么所有请求都走 /api 开头的相对路径？
 * - 开发环境：vite.config.ts 配置了代理，/api 转发到 http://localhost:3000
 * - 生产环境：nginx 把 /api 反代到后端服务
 * - 好处：前端代码里永远不出现后端地址，环境切换零改动（"同源抽象"）
 *
 * 为什么自己封一层而不直接用 fetch？
 * - 统一错误处理：非 2xx 时解析 NestJS 的错误体并抛出带友好文案的 Error，
 *   调用方永远不需要写 res.ok 判断
 * - 统一请求头：Content-Type 之类的样板代码只写一次
 * - 未来加 token 鉴权（迭代 5+）只需改这一个文件，所有页面自动生效 —— 这才是
 *   封装的真正意义：把"将来一定会变的东西"收敛到一个文件里
 */
import type { ApiErrorBody } from '../types/http.js'

/**
 * 业务错误：HTTP 层面成功但语义失败（4xx/5xx）时抛出
 * 单独建类而不是裸 Error：页面可以 instanceof 判断，也方便将来挂 code 等字段
 */
export class ApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

/** 请求选项：body 传对象会自动序列化（比原生 fetch 好用一点） */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

/** 泛型：调用处直接拿到带类型的返回值，不需要 as 断言 */
export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    // 尽力解析后端错误体（NestJS 统一返回 { message, error, statusCode }），
    // 解析失败（比如网关返回 HTML）则退回通用文案 —— 错误处理也要有兜底
    let message = `请求失败 (${res.status})`
    try {
      const body = (await res.json()) as ApiErrorBody
      if (body?.message) message = body.message
    } catch {
      /* 响应不是 JSON，保留默认文案 */
    }
    throw new ApiError(message, res.status)
  }

  return (await res.json()) as T
}
