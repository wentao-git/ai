/**
 * 活动相关类型定义（与后端 server/src/activities 的 Schema 一一对应）
 * -----------------------------------------------------------------------------
 * 分层说明：types/ 目录集中存放"数据契约"。
 * 正规项目的惯例是按领域（domain）拆文件而不是塞一个大 index：
 * - 字段多了以后单文件爆炸，按领域拆才能并行开发不冲突
 * - 后端如果改了字段，能一眼定位到对应的类型文件去同步
 */

/** 活动状态枚举值（字符串字面量联合类型，和后端 enum 的值保持一致） */
export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

/** 活动实体（API 返回的 JSON 结构） */
export interface Activity {
  _id: string
  title: string
  description: string
  venue: string
  /** ISO 8601 时间字符串 */
  startTime: string
  endTime: string
  status: ActivityStatus
  createdAt: string
  updatedAt: string
}

/** 创建活动请求体（后端 CreateActivityDto） */
export interface CreateActivityRequest {
  title: string
  venue: string
  startTime: string
  endTime: string
  description?: string
}
