/**
 * 超卖对比压测脚本（迭代 2）
 * =============================================================================
 * 实验目的：用同一把"并发 hammer"分别砸 naive 和 atomic 两种下单策略，
 * 用数据证明原子条件更新消除了超卖。
 *
 * 实验设计（控制变量法，面试讲实验思路时用得上）：
 *   - 每轮实验都新建一个全新的活动 + 票种（库存干净、无历史订单干扰）
 *   - 固定总请求数、并发连接数、每个请求买 1 张，两种策略参数完全一致
 *   - 唯一变量：x-order-strategy 请求头（请求级切换策略，服务不用重启）
 *
 * 判定指标：
 *   ordersCreated  实际创建的订单数
 *   soldByStock    按"库存变化"推算的真实售出数 = 初始库存 - 结束库存
 *   oversell       超卖数 = ordersCreated - soldByStock（>0 就是超卖！）
 *   为什么不能用"库存变负数"来判定超卖？
 *     naive 的丢失更新只会让账面库存"少扣"（看起来正常），但订单多建了 ——
 *     只有"订单数 vs 库存消耗数"对账才能抓住它。这正是迭代 5 对账任务的雏形。
 *
 * 运行方式（先启动 server）：
 *   npm run loadtest                     # 默认跑两种策略对比
 *   npm run loadtest -- --strategy atomic --stock 20 --requests 100
 * =============================================================================
 */
import autocannon from 'autocannon';
import { mkdirSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// 参数解析：支持命令行覆盖默认值（node scripts/oversell-test.mjs --strategy atomic）
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  return {
    strategy: get('strategy', 'both'), // both | naive | atomic
    stock: Number(get('stock', 20)), // 每轮实验的票种初始库存
    requests: Number(get('requests', 100)), // 总请求数（每个请求买 1 张）
    connections: Number(get('connections', 50)), // 并发连接数（决定瞬时竞争烈度）
  };
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// 造数据：建活动 -> 发布 -> 建票种（每轮全新，保证实验互不污染）
// ---------------------------------------------------------------------------
async function setupFixture(initialStock) {
  const post = (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) throw new Error(`${path} 失败: ${r.status} ${r.statusText}`);
      return r.json();
    });

  const activity = await post('/activities', {
    title: `压测-${Date.now()}`,
    venue: '线上',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 90000000).toISOString(),
  });
  await post(`/activities/${activity._id}/publish`, {});
  const ticket = await post(`/activities/${activity._id}/ticket-types`, {
    name: '压测票',
    price: 100,
    totalStock: initialStock,
  });
  return { activityId: activity._id, ticketId: ticket._id };
}

// ---------------------------------------------------------------------------
// 开砸：autocannon 以固定并发把 amount 个请求打向下单接口
// ---------------------------------------------------------------------------
async function hammer(strategy, ticketId, requests, connections) {
  const result = await autocannon({
    url: `${BASE}/orders`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-order-strategy': strategy,
    },
    // 所有请求买同一个票种、每个 1 张 —— 让它们竞争同一份库存，制造冲突
    body: JSON.stringify({ ticketTypeId: ticketId, quantity: 1 }),
    connections, // 同时保持的 TCP 连接数 = 瞬时并发度
    amount: requests, // 发满这个数量就停（而不是按时间跑）
    // 关闭 pipelining 和 keepalive 之外的杂项，结果更纯粹
    pipelining: 1,
  });
  return result;
}

// ---------------------------------------------------------------------------
// 对账：数订单 + 查库存，算超卖
// ---------------------------------------------------------------------------
async function audit(strategy, fixture, initialStock, canResult) {
  const ticket = await fetch(`${BASE}/ticket-types/${fixture.ticketId}`).then((r) => r.json());
  const orders = await fetch(`${BASE}/orders?activityId=${fixture.activityId}`).then((r) => r.json());

  const ordersCreated = orders.length;
  const soldByStock = initialStock - ticket.stock; // 库存视角的真实售出数
  const oversell = ordersCreated - soldByStock;

  return {
    strategy,
    initialStock,
    requests: canResult.requests.total,
    ok2xx: canResult['2xx'],
    failed4xx: canResult['4xx'],
    errors: canResult.errors,
    ordersCreated,
    finalStock: ticket.stock,
    soldByStock,
    oversell,
    // autocannon 的延迟统计单位是毫秒；p50 字段在不同版本里叫 p50 或 p50_9，做兜底
    p50LatencyMs: canResult.latency.p50 ?? canResult.latency.p50_9,
    p99LatencyMs: canResult.latency.p99_9,
  };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function runOne(strategy, opts) {
  console.log(`\n=== 策略: ${strategy} | 库存 ${opts.stock} | 请求 ${opts.requests} | 并发 ${opts.connections} ===`);
  const fixture = await setupFixture(opts.stock);
  const can = await hammer(strategy, fixture.ticketId, opts.requests, opts.connections);
  const report = await audit(strategy, fixture, opts.stock, can);

  console.table({
    总请求: report.requests,
    '2xx成功': report.ok2xx,
    '4xx失败': report.failed4xx,
    创建订单数: report.ordersCreated,
    初始库存: report.initialStock,
    结束库存: report.finalStock,
    库存售出数: report.soldByStock,
    '超卖数(⚠️)': report.oversell,
    'P50延迟(ms)': report.p50LatencyMs,
    'P99延迟(ms)': report.p99LatencyMs,
  });
  return report;
}

const opts = parseArgs();
const strategies = opts.strategy === 'both' ? ['naive', 'atomic'] : [opts.strategy];
const reports = [];
for (const s of strategies) {
  reports.push(await runOne(s, opts));
}

if (reports.length === 2) {
  console.log('\n=== 结论 ===');
  const [naive, atomic] = reports;
  console.log(
    `naive    超卖 ${naive.oversell} 张（订单 ${naive.ordersCreated} / 库存 ${naive.initialStock}），P99 ${naive.p99LatencyMs}ms`,
  );
  console.log(
    `atomic   超卖 ${atomic.oversell} 张（订单 ${atomic.ordersCreated} / 库存 ${atomic.initialStock}），P99 ${atomic.p99LatencyMs}ms`,
  );
}

// 结果落盘：迭代 5 写压测报告时直接引用这些 JSON
mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
const outFile = new URL(
  `./results/oversell-${Date.now()}.json`,
  import.meta.url,
);
writeFileSync(outFile, JSON.stringify({ opts, reports }, null, 2));
console.log(`\n结果已保存: ${outFile.pathname}`);
