/**
 * MySQL 连接池 + 统一查询入口 —— 整个项目访问数据库的唯一通道
 * =============================================================================
 * 为什么用"连接池"而不是每次请求新建连接？
 * - 建立 TCP + TLS + 认证的完整握手要几十毫秒，每个请求都建一次的话，
 *   光握手就可能比业务 SQL 本身还慢
 * - 池子维持 N 条长连接，请求借走用完还回，复用成本趋近于零
 * - 还天然限流：池子满了请求排队，数据库不会被并发冲垮
 * 【对比学习】Mongoose 自己维护连接池（默认 5 条），Nest 里 MongooseModule.forRoot
 * 帮你管好了这一切；原生项目里这层"基础设施"就得自己写 —— 这正是 Nest 封装的价值。
 *
 * 为什么导出 query() 帮手函数？
 * - 统一"执行 -> 拿结果"的样板代码：查询要 rows，增删改要 affectedRows/insertId
 * - 统一参数化：所有 SQL 的动态值必须走 ? 占位符（防止 SQL 注入），
 *   把这条铁律固化在唯一入口里，业务代码想犯错了都难
 * =============================================================================
 */
import mysql from 'mysql2/promise'
import { env } from './env.js'

/**
 * 创建连接池
 * connectionLimit：池子里最多几条连接。开发环境 10 足够；
 * 生产要按"数据库 max_connections / 服务实例数"倒推（面试可聊的容量计算）
 */
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: 10,
  // charset 决定连接的字符集，和建库时的 utf8mb4 保持一致，否则中文/emoji 会变问号
  charset: 'utf8mb4',
})

/**
 * 执行一条 SQL，返回"对调用方最有用的结果"
 *
 * @param sql    SQL 语句，动态值一律用 ? 占位
 * @param params 占位符参数数组（按顺序对应每个 ?）
 * @returns      查询返回行数组；增删改返回受影响信息对象
 *
 * @example
 *   const rows = await query('SELECT * FROM activities WHERE id = ?', [id])
 *   const result = await query('UPDATE ...', [stock, id])
 *   // result.affectedRows: 改了几行；result.insertId: 新插入行的自增主键
 */
export async function query(sql, params = []) {
  // pool.execute 与 pool.query 的区别：execute 使用"预处理语句"（prepared statement），
  // SQL 结构和参数分开传输 —— 参数永远不会被拼进 SQL 文本，从机制上杜绝 SQL 注入，
  // 还能让服务端复用执行计划。业务代码统一用 execute。
  const [result] = await pool.execute(sql, params)
  return result
}

/**
 * 事务帮手函数
 * -----------------------------------------------------------------------------
 * 【为什么迭代 3/4 会用到】"扣库存 + 建订单"如果要求两条语句要么全成功要么全失败，
 * 就必须包在事务里（MySQL 的 InnoDB 引擎支持事务；MyISAM 不支持，所以建表时显式
 * 指定了 ENGINE = InnoDB）。
 *
 * 用法：把多条语句的执行逻辑传进来，回调内部拿到的 conn 上执行的所有语句
 * 要么一起提交，要么任何一条抛错就整体回滚：
 *
 *   await withTransaction(async (conn) => {
 *     await conn.execute('UPDATE ...', [...])
 *     await conn.execute('INSERT ...', [...])
 *   })
 */
export async function withTransaction(work) {
  // 从池里独占借出一条连接：事务里的所有语句必须在同一条连接上执行，
  // 换连接 = 换会话 = 事务失效（这是新手写 MySQL 事务最常见的错误）
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await work(conn)
    // 两条语句都成功：提交，变更对其他连接可见
    await conn.commit()
    return result
  } catch (err) {
    // 任何一步失败：回滚到事务开始前的状态，数据库像什么都没发生过
    await conn.rollback()
    throw err // 继续向上抛，让错误处理中间件统一响应
  } finally {
    // 无论成败，把连接还回池子（不还的话池子很快耗尽，应用假死）
    conn.release()
  }
}
