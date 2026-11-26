/**
 * 活动路由 —— URL 和处理函数的映射表
 * =============================================================================
 * Router 是 Express 的"迷你应用"：可以注册中间件、挂子路径，最后被 app.use 挂载。
 * 【对比学习】@Controller('activities') + @Get(':id') 装饰器组合做的事，
 * 就是下面 router.get('/activities/:id', ...) 这一行 —— 装饰器是"声明式"的路由映射。
 *
 * 挂载约定：app.js 里 app.use('/api', router)，所以这里的路径不带 /api 前缀。
 * =============================================================================
 */
import { Router } from 'express'
import {
  handleCreateActivity,
  handleListActivities,
  handleFindActivity,
  handleUpdateActivity,
  handlePublishActivity,
  handleRemoveActivity,
} from '../controllers/activity.controller.js'

export const activityRouter = Router()

// 路由顺序很重要：Express 按注册顺序匹配，先命中先执行。
// GET /activities/:id 会匹配任何一段路径，所以如果有更具体的 GET 路由
// （如 /activities/statistics），必须注册在 :id 之前，否则会被 :id 抢先截胡。

activityRouter.post('/activities', handleCreateActivity)
activityRouter.get('/activities', handleListActivities)
activityRouter.get('/activities/:id', handleFindActivity)
// PATCH 语义是"部分更新"（PUT 是"整体替换"），部分更新字段时用 PATCH 更准确
activityRouter.patch('/activities/:id', handleUpdateActivity)
activityRouter.post('/activities/:id/publish', handlePublishActivity)
activityRouter.delete('/activities/:id', handleRemoveActivity)
