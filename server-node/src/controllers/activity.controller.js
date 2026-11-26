/**
 * 活动控制器 —— HTTP 协议层的"翻译官"
 * =============================================================================
 * 职责（也解释了为什么要和 service 分开）：
 *   1. 从 req（请求对象）上取参数：req.params 路径参数 / req.query 查询串 / req.body 请求体
 *   2. 调用 service 完成业务
 *   3. 把结果 res.json() 回给客户端；抛错则交给全局错误中间件
 *
 * 【对比学习】Nest 的参数装饰器 vs Express 的手动取参：
 *   Nest：  findOne(@Param('id') id: string)     —— 参数从哪来由装饰器声明
 *   原生：  findOne(req, res) { const id = req.params.id }  —— 手动从 req 上取
 *   表达力差别不大，但 Nest 的写法让"函数签名"直接暴露依赖，可读性和可测试性更好。
 *
 * async 函数直接返回 Promise：Express 5 会自动把 reject 转交给错误中间件，
 * 所以这里看不到 try/catch（Express 4 必须手写）。
 * =============================================================================
 */

// 注意 import：service 是"值"（函数集合对象要用解构），不是类型
import { badRequest } from '../middleware/errorHandler.js'
import {
  createActivity,
  listActivities,
  findActivity,
  updateActivity,
  publishActivity,
  removeActivity,
} from '../services/activity.service.js'

export async function handleCreateActivity(req, res) {
  // req.body 是 express.json() 中间件解析出来的请求体对象；
  // 服务端永远不能相信请求体 —— 必填校验在边界做（此处最简版本，只查 title/venue）
  const { title, venue, startTime, endTime, description } = req.body
  if (!title || !venue || !startTime || !endTime) {
    // 抛 HttpError 而不是 res.status(400).json(...)：统一走错误中间件，响应格式全局一致
    // 【对比学习】Nest 里这一步可以交给 class-validator 的 @IsNotEmpty() 装饰器自动做
    throw badRequest('title/venue/startTime/endTime 都是必填项')
  }
  const activity = await createActivity({ title, venue, startTime, endTime, description })
  // REST 惯例：创建成功返回 201（Nest 的 @Post 默认也是 201）
  res.status(201).json(activity)
}

export async function handleListActivities(req, res) {
  // req.query 拿查询串：GET /api/activities?status=PUBLISHED 里的 status
  const activity = await listActivities(req.query.status)
  res.json(activity)
}

export async function handleFindActivity(req, res) {
  // req.params 拿路径参数：路由注册成 /activities/:id，:id 的值就在 req.params.id
  const activity = await findActivity(req.params.id)
  res.json(activity)
}

export async function handleUpdateActivity(req, res) {
  const activity = await updateActivity(req.params.id, req.body)
  res.json(activity)
}

export async function handlePublishActivity(req, res) {
  const activity = await publishActivity(req.params.id)
  res.json(activity)
}

export async function handleRemoveActivity(req, res) {
  const result = await removeActivity(req.params.id)
  res.json(result)
}
