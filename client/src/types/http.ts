/** HTTP 层通用类型 */

/** 后端（NestJS）抛出 HttpException 时的统一错误响应结构 */
export interface ApiErrorBody {
  message: string
  error: string
  statusCode: number
}
