/**
 * Express 应用组装 —— 中间件管道的搭建现场
 * =============================================================================
 * 【Express 的核心心智模型】
 * 一个请求进来，按注册顺序穿过一条"中间件管道"：
 *
 *   请求 ──> express.json() ──> 日志 ──> 路由 ──> (没匹配到？404) ──> errorHandler ──> 响应
 *
 * 每个中间件拿到 (req, res, next)：处理完自己的部分后调 next() 把控制权交给下一个；
 * 任何一步抛错/调用 next(err)，Express 就跳过剩余中间件直达错误处理器。
 * 【对比学习】Nest 里这条管道由框架自动搭建（中间件、守卫、拦截器、管道、过滤器
 * 五层机制各有各的位置）；原生版本每一步都是你自己 app.use 出来的 —— 这就是
 * "Nest 帮你做了什么"的最直观答案。
 * =============================================================================
 */
import express from 'express'
import { activityRouter } from './routes/activity.routes.js'
import { ticketTypeRouter } from './routes/ticketType.routes.js'
import { orderRouter } from './routes/order.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  // app 就是"中间件管道本体"。抽成工厂函数（而不是模块顶层直接建）：
  // 测试时可以创建干净的实例、互不干扰 —— 与 Nest 的 AppModule 可测试性同理
  const app = express()

  // 必须在路由之前注册：把请求体 JSON 解析成对象挂到 req.body 上。
  // 没有它，req.body 是 undefined（新手第一大坑）
  app.use(express.json())

  // 简易请求日志：开发期观察请求流向；生产会换成 morgan/pino 这类成熟日志库
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next() // 处理完日志，继续往管道后面走
  })

  // 健康检查（挂 /api 前缀，路径和 Nest 版一致）
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // 业务路由统一挂 /api 前缀：前端 vite/nginx 的代理规则两边通用
  app.use('/api', activityRouter)
  app.use('/api', ticketTypeRouter)
  app.use('/api', orderRouter)

  // 404 兜底：能走到这里说明没有任何路由匹配（错误中间件只接"抛错"的请求）
  app.use((_req, res) => {
    res.status(404).json({ statusCode: 404, message: '接口不存在', error: 'Not Found' })
  })

  // 错误处理器必须注册在最后：接住所有路由/中间件抛出的错误，统一转 JSON
  app.use(errorHandler)

  return app
}
