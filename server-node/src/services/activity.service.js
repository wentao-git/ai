/**
 * 活动服务层 —— 业务逻辑 + SQL 都在这里
 * =============================================================================
 * 分层思想（和 Nest 版一一对应，方便对照）：
 *   路由层 routes     -> 只做"URL/method 和函数的映射表"
 *   控制器 controller -> 解析 HTTP 请求（params/query/body），调用 service，回 JSON
 *   服务 service      -> 纯业务逻辑 + SQL，不知道 HTTP 的存在
 *
 * 为什么 service 不碰 req/res？
 * - 同一段业务逻辑将来可能被定时任务、CLI 脚本、消息队列复用，它们没有 req/res
 * - 单测时不需要 mock HTTP 对象，直接调函数传参数即可
 * 【对比学习】Nest 的 Service 类用 @Injectable() 标记、构造函数里依赖注入；
 * 原生版本里 service 就是普通函数集合，依赖（如 db 查询函数）直接 import ——
 * "依赖注入"本质就是把"用的东西"从"自己做"变成"外面给"，原生项目手动给。
 * =============================================================================
 */
import { query } from '../config/db.js'
import { notFound, badRequest } from '../middleware/errorHandler.js'
import { ActivityStatus } from '../common/enums.js'

/** 校验并转换日期参数：非法日期在 new Date() 时产生 NaN，不拦住会一路写进数据库 */
function parseDate(value, label) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${label} 必须是合法的日期时间字符串`)
  }
  return date
}

/** 把数据库行（snake_case 下划线字段）转成 API 输出（camelCase 驼峰字段）
 *  【对比学习】Mongoose 的 @Prop 装饰器直接声明驼峰字段名，映射自动完成；
 *  原生 MySQL 常见惯例是数据库用下划线命名，接口输出用驼峰，中间手动映射 */
function toDto(row) {
  return {
    _id: String(row.id), // 输出字段名也和 Nest 版对齐（_id），前端可以零改动切换后端
    title: row.title,
    description: row.description,
    venue: row.venue,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 创建活动（默认草稿状态：创建即发布是危险设计，显式发布更安全） */
export async function createActivity(dto) {
  const startTime = parseDate(dto.startTime, 'startTime')
  const endTime = parseDate(dto.endTime, 'endTime')
  if (endTime <= startTime) {
    throw badRequest('endTime 必须晚于 startTime')
  }

  // ? 占位符参数化：动态值永远不拼进 SQL 字符串（防 SQL 注入的铁律）
  // 【对比学习】这里就是 Nest 版 Mongoose 的 model.create(...) 对应物
  const result = await query(
    `INSERT INTO activities (title, description, venue, start_time, end_time)
     VALUES (?, ?, ?, ?, ?)`,
    [dto.title, dto.description ?? '', dto.venue, startTime, endTime],
  )

  // 插入成功后按主键回查完整行（拿 created_at 等数据库默认值）
  return findActivityOrThrow(result.insertId)
}

/** 活动列表；status 可选过滤。SQL 注释讲解这个查询怎么工作 */
export async function listActivities(status) {
  // 1 = 1 是个小技巧：让"有无 status 过滤"两个分支共用同一条 SQL 模板
  let sql = `SELECT * FROM activities WHERE 1 = 1`
  const params = []
  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  // ORDER BY：开始时间倒序，越近开场越靠前（对应 Mongo 的 .sort({ startTime: -1 })）
  sql += ` ORDER BY start_time DESC`

  const rows = await query(sql, params)
  return rows.map(toDto)
}

/** 内部帮手：按 id 查活动，查不到抛 404（service 内部复用，避免每处都写一遍判空） */
async function findActivityOrThrow(id) {
  const rows = await query(`SELECT * FROM activities WHERE id = ?`, [id])
  if (rows.length === 0) {
    throw notFound(`活动不存在: ${id}`)
  }
  return toDto(rows[0])
}

export async function findActivity(id) {
  return findActivityOrThrow(id)
}

/** 部分更新：只更新请求里显式传入的字段（动态拼 SET 子句） */
export async function updateActivity(id, dto) {
  await findActivityOrThrow(id) // 先确保存在，404 语义优先于 200 空更新

  // 动态构建 UPDATE 的 SET 部分：遍历 dto 里"客户端允许改的字段白名单"
  // 【安全要点】必须用白名单，不能直接把 req.body 丢进 SQL ——
  // 否则攻击者多传一个 status 字段就能把活动改成任意状态（批量赋值漏洞）
  const allowed = ['title', 'description', 'venue', 'startTime', 'endTime']
  const sets = []
  const params = []
  for (const key of allowed) {
    if (dto[key] !== undefined) {
      const column = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) // 驼峰转下划线
      sets.push(`${column} = ?`)
      params.push(key.endsWith('Time') ? parseDate(dto[key], key) : dto[key])
    }
  }
  if (dto.status !== undefined) {
    sets.push(`status = ?`)
    params.push(dto.status)
  }
  if (sets.length === 0) {
    throw badRequest('没有提供任何可更新的字段')
  }

  params.push(id) // WHERE 条件的参数放在最后（对应 SQL 里占位符的顺序）
  await query(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`, params)
  return findActivityOrThrow(id)
}

/** 发布活动：DRAFT -> PUBLISHED（语义化状态流转接口，为迭代 3 状态机预留） */
export async function publishActivity(id) {
  await findActivityOrThrow(id)
  await query(`UPDATE activities SET status = ? WHERE id = ?`, [ActivityStatus.PUBLISHED, id])
  return findActivityOrThrow(id)
}

export async function removeActivity(id) {
  await findActivityOrThrow(id)
  // TODO(迭代2)：删除前应校验是否存在未完结订单，防止数据悬空
  await query(`DELETE FROM activities WHERE id = ?`, [id])
  return { deleted: true }
}
