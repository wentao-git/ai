import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局 API 前缀：所有接口变成 /api/xxx
  // 好处：client 的 vite 代理只需匹配 /api 一条规则，生产环境 nginx 反代也同理
  app.setGlobalPrefix('api');

  // 允许跨域（开发阶段直连调试用；生产环境走 nginx 反代其实用不到，但开着无害）
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Server running at http://localhost:${process.env.PORT ?? 3000}/api`);
}
await bootstrap();
