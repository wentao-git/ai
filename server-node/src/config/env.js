/**
 * 环境变量加载与集中管理
 * -----------------------------------------------------------------------------
 * 【对比学习】NestJS 怎么做：@nestjs/config 的 ConfigModule.forRoot() 读取 .env，
 * 然后在任意类里通过构造函数注入 ConfigService 拿值。
 * 原生 Node 怎么做：一行 dotenv/config 加载 .env 文件到 process.env，
 * 之后所有模块直接读 process.env —— 没有容器和注入，就是普通全局变量。
 *
 * 注意加载时机：dotenv 必须在其他模块读 process.env 之前执行，
 * 所以它被放在 main.js 的第一行 import。
 */
import 'dotenv/config'

/** 集中导出配置对象：其他模块从这里拿配置，而不是散落地读 process.env
 *  （好处：字段名集中一处，拼写错误在重构时一处可查；也给 IDE 提供了类型提示入口） */
export const env = {
  port: Number(process.env.PORT ?? 3001),
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'ticket_booking',
  },
}
