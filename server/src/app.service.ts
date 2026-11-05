import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** 健康检查：部署/压测脚本用它确认服务存活 */
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
