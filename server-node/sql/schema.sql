-- =============================================================================
-- 建库建表脚本（server-node / MySQL 版）
-- -----------------------------------------------------------------------------
-- 执行方式二选一：
--   1. 命令行：mysql -uroot -p < sql/schema.sql
--   2. DBeaver：连上本机 MySQL 后，把本文件内容粘进 SQL 编辑器执行
--
-- 【对比学习】MongoDB vs MySQL 的建库建表：
-- - MongoDB 无需建表：Mongoose 的 Schema 在应用启动时自动创建集合（synchronize 模式）
-- - MySQL 必须先建表：表结构是显式契约，改字段要跑迁移（生产项目用 Flyway/Knex 迁移工具）
--   这也是为什么 schema.sql 是这个项目里"和数据库的唯一契约"
-- =============================================================================

-- utf8mb4 才能完整存 emoji 和生僻字（MySQL 的 utf8 是 utf8mb3 别名，历史遗留坑）
CREATE DATABASE IF NOT EXISTS ticket_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ticket_booking;

-- -----------------------------------------------------------------------------
-- 活动表
-- -----------------------------------------------------------------------------
-- 【对比学习】主键设计：
-- - Mongo：自动生成 ObjectId（24 位十六进制，含时间戳信息）
-- - MySQL：最常用 BIGINT UNSIGNED AUTO_INCREMENT 自增主键
--   * 自增主键作为 InnoDB 聚簇索引，插入永远是追加，性能最好
--   * 缺点：暴露业务量（可以推测第 10000 个用户是什么时候注册的），
--     对外 API 慎用自增 id 当业务标识 —— 所以订单表单独设计了 order_no
CREATE TABLE IF NOT EXISTS activities (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
  title        VARCHAR(100)  NOT NULL COMMENT '活动标题',
  description  VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '活动描述',
  venue        VARCHAR(200)  NOT NULL COMMENT '活动地点',
  start_time   DATETIME      NOT NULL COMMENT '开始时间',
  end_time     DATETIME      NOT NULL COMMENT '结束时间',
  status       ENUM('DRAFT', 'PUBLISHED', 'OFFLINE') NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间（自动维护）'
) ENGINE = InnoDB COMMENT '活动';

-- -----------------------------------------------------------------------------
-- 票种表（库存的载体，防超卖战场）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_types (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
  activity_id    BIGINT UNSIGNED NOT NULL COMMENT '所属活动',
  name           VARCHAR(50) NOT NULL COMMENT '票种名称',
  price          INT NOT NULL COMMENT '票价，单位：分（整数避免浮点精度问题）',
  total_stock    INT NOT NULL COMMENT '总库存',
  stock          INT NOT NULL COMMENT '剩余库存（下单扣减/取消回加）',
  limit_per_user INT NOT NULL DEFAULT 0 COMMENT '每人限购，0 不限',
  status         ENUM('ON_SALE', 'OFF_SALE') NOT NULL DEFAULT 'ON_SALE' COMMENT '状态',
  version        INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（optimistic 策略用）',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  -- 外键：保证不出现"票种指向一个不存在的活动"的脏数据
  -- 【对比学习】Mongo 没有外键约束，引用完整性靠应用层校验；MySQL 由数据库兜底
  CONSTRAINT fk_ticket_activity FOREIGN KEY (activity_id) REFERENCES activities (id),
  -- 复合索引：活动详情页按活动查票种是最高频查询（最左前缀：activity_id 在前）
  INDEX idx_activity_status (activity_id, status)
) ENGINE = InnoDB COMMENT '票种';

-- -----------------------------------------------------------------------------
-- 订单表
-- -----------------------------------------------------------------------------
-- 【对比学习】为什么有 order_no 又有自增 id？
-- - id：内部主键，表关联用，快
-- - order_no：对外业务单号。自增 id 会泄露单量（每天 +1 一眼可见），
--   而且用户把 URL 里的 id 手动 +1 就能越权查别人的单（水平越权攻击）
CREATE TABLE IF NOT EXISTS orders (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键（仅内部使用）',
  order_no       VARCHAR(32) NOT NULL COMMENT '业务订单号，对外暴露',
  activity_id    BIGINT UNSIGNED NOT NULL COMMENT '冗余活动 id：列表展示免关联查询',
  ticket_type_id BIGINT UNSIGNED NOT NULL COMMENT '票种 id',
  quantity       INT NOT NULL COMMENT '购买数量',
  unit_price     INT NOT NULL COMMENT '下单时刻票价快照（分）。票价可调，历史订单不能变',
  total_amount   INT NOT NULL COMMENT '总额 = unit_price * quantity（分）',
  status         ENUM('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT' COMMENT '订单状态',
  pay_expire_at  DATETIME NOT NULL COMMENT '支付截止时间（迭代 4 超时释放扫描用）',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  -- unique 约束：order_no 全局唯一，也是并发下单时防重号的最后防线
  UNIQUE INDEX uk_order_no (order_no),
  INDEX idx_activity (activity_id)
) ENGINE = InnoDB COMMENT '订单';
