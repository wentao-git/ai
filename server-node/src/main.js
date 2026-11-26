/**
 * 启动入口
 * -----------------------------------------------------------------------------
 * createApp() 组装中间件管道（app.js），main.js 负责"让它跑起来"：
 * 监听端口 + 验证数据库连通。两件事分开，app 的逻辑才能被测试工具直接 import。
 *
 * 运行：npm run dev（node --watch 会监听文件变动自动重启，等价于 nodemon，
 * Node 18.11+ 内置，省一个依赖 —— 对比：Nest 版的 nest start --watch）
 */
// dotenv 必须第一个 import：先加载 .env 到 process.env，后面的 db 配置才读得到值
import 'dotenv/config'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { pool } from './config/db.js'

async function bootstrap() {
  const app = createApp()

  // 启动前先 ping 一下数据库：连不上的话立刻失败退出，
  // 而不是等第一个业务请求来了才报错（快速失败原则）
  try {
    await pool.query('SELECT 1')
    console.log(`MySQL 已连接: ${env.db.host}:${env.db.port}/${env.db.database}`)
  } catch (err) {
    console.error('MySQL 连接失败，请检查 .env 配置和服务是否启动:', err.message)
    process.exit(1)
  }

  app.listen(env.port, () => {
    console.log(`server-node 运行在 http://localhost:${env.port}/api`)
    console.log(`（Nest 版同时在 3000 端口跑的话，两边可以对照请求）`)
  })
}

await bootstrap()
