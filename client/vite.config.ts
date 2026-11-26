import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 开发服务器配置
 * -----------------------------------------------------------------------------
 * 前端代码里所有请求都走 /api 相对路径（见 src/api/http.ts 的注释），
 * 开发环境由这里的代理转发给真实后端 —— 所以"前端打哪个后端"只由这里决定。
 *
 * 两个后端（同一套接口、字段、错误格式完全对齐）：
 *   - server/      NestJS  + MongoDB，端口 3000（默认）
 *   - server-node/ Express + MySQL，   端口 3001
 *
 * 切换方式（npm scripts，见 package.json）：
 *   npm run dev        -> 代理到 3000（Nest 版）
 *   npm run dev:node   -> 代理到 3001（原生 Node 版）
 *
 * 原理：vite 的 --mode 参数会传进 defineConfig 的回调；我们借它当"开关"用。
 * 注意：切换后端需要重启 dev server（vite 配置只在启动时读取一次）。
 * 生产环境不经过这里 —— nginx 反代 /api 到哪个后端，是部署脚本的事。
 */

// 后端地址表：加第三个后端时在这里加一行
const API_TARGETS: Record<string, string> = {
  default: 'http://localhost:3000', // Nest 版
  'node-server': 'http://localhost:3001', // 原生 Node 版（npm run dev:node）
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // mode 不认识时回落到默认后端，保证配置写错也能跑
        target: API_TARGETS[mode] ?? API_TARGETS.default,
        changeOrigin: true,
      },
    },
  },
}))
