/**
 * HTTP 错误体系：业务异常类 + 全局兜底中间件
 * =============================================================================
 * 【对比学习】NestJS 怎么做：service 里 throw new NotFoundException('xx')，
 * Nest 内置的异常过滤器自动把它变成 { statusCode, message, error } JSON 响应。
 * 原生 Express 没有这层"魔法"，需要自己做两件事：
 *   1. 定义 HttpError 类 —— 让业务代码能"抛出带状态码的错误"
 *   2. 定义兜底错误中间件 —— 把抛上来的错误统一变成 JSON 响应
 * 我们刻意把响应体格式做成和 Nest 一致（message/error/statusCode），
 * 这样前端切换后端时无需改错误处理逻辑。
 * =============================================================================
 */

/** 业务异常：service/controller 里抛，errorHandler 里接 */
export class HttpError extends Error {
  /**
   * @param {number} statusCode HTTP 状态码（400 参数错 / 404 不存在 / 409 冲突…）
   * @param {string} message    给用户看的错误描述（会出现在响应 JSON 里）
   * @param {string} errorType  Nest 风格的错误类型名（响应体里的 error 字段）
   */
  constructor(statusCode, message, errorType = 'Bad Request') {
    super(message)
    this.statusCode = statusCode
    this.errorType = errorType
  }
}

/** 常用快捷工厂：语义化抛错，等价于 Nest 的 NotFoundException 等 */
export const notFound = (message) => new HttpError(404, message, 'Not Found')
export const badRequest = (message) => new HttpError(400, message, 'Bad Request')

/**
 * 全局错误处理中间件
 * -----------------------------------------------------------------------------
 * Express 约定：4 个参数的中间件才是错误处理器（必须有 err 参数），
 * 且必须注册在所有路由之后 —— 路由里抛出的错误会顺着中间件链流到这里。
 *
 * Express 5 的贴心改进：async 路由函数里抛出的错误（或 await 的 Promise reject）
 * 会自动传给错误中间件，不需要像 Express 4 那样每个 handler 手写 try/catch +
 * next(err)。Express 4 时代忘记 next(err) 是"接口挂了却静默无响应"的头号原因。
 */
export function errorHandler(err, req, res, _next) {
  // HttpError = 业务主动抛的，用它的状态码和文案
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      error: err.errorType,
    })
  }

  // 未知错误（代码 bug、数据库断连…）：打完整堆栈方便排查，
  // 但对客户端只说 500 不暴露内部细节 —— 错误详情是服务器内部信息，不能外泄
  console.error('[未处理错误]', err)
  return res.status(500).json({
    statusCode: 500,
    message: '服务器内部错误',
    error: 'Internal Server Error',
  })
}
