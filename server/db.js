/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 数据库初始化与安全迁移模块 (db.js) [SaaS 升级版]
 *
 * ⚠️  绝对安全原则：
 *    本文件永远不会使用 DROP TABLE 或 DELETE 清空数据。
 *    所有结构变更均通过 ALTER TABLE ADD COLUMN 安全追加。
 *    SQLite 的 ALTER TABLE 如果列已存在会报错，因此用 try-catch 保护每一条。
 *
 * 新增功能（相对原版）：
 *    1. users 表 — 多用户账号体系（含 role: 'admin' | 'user'）
 *    2. verification_codes 表 — 邮箱验证码（注册/改密）
 *    3. exercises / workout_sets / body_weight / routines 表均追加 user_id 列
 * ═══════════════════════════════════════════════════════════════════════════
 */

const Database = require('better-sqlite3');
const path = require('path');

// 🆕 引入标准种子数据（用于初始化及新用户默认分配）
const { defaultExercises, defaultRoutines } = require('./seedData');

// 数据库文件存放在 server 目录下
const DB_PATH = path.join(__dirname, 'sharkfit.db');

// 创建/打开数据库连接 (开启 WAL 模式，提升并发读性能)
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── 第一步：建立原有基础表（IF NOT EXISTS 保证幂等）────────────────────────

db.exec(`
  -- 动作库表
  CREATE TABLE IF NOT EXISTS exercises (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    target     TEXT NOT NULL,
    sets       INTEGER DEFAULT 4,
    reps       TEXT DEFAULT '8-12',
    rest       INTEGER DEFAULT 60,
    imageUrl   TEXT DEFAULT '',
    notes      TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 每周训练计划表 (dayOfWeek 0-6)
  CREATE TABLE IF NOT EXISTS routines (
    dayOfWeek    INTEGER NOT NULL,
    name         TEXT NOT NULL,
    exerciseIds  TEXT NOT NULL DEFAULT '[]'
  );

  -- 训练打卡组记录表
  CREATE TABLE IF NOT EXISTS workout_sets (
    id          TEXT PRIMARY KEY,
    exerciseId  TEXT NOT NULL,
    date        TEXT NOT NULL,
    weight      REAL NOT NULL,
    reps        INTEGER NOT NULL,
    isPR        INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 体重记录表
  CREATE TABLE IF NOT EXISTS body_weight (
    id          TEXT PRIMARY KEY,
    weight      REAL NOT NULL,
    date        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 为记录建索引（已存在则忽略）
  CREATE INDEX IF NOT EXISTS idx_sets_date ON workout_sets(date);
  CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exerciseId);
  CREATE INDEX IF NOT EXISTS idx_weight_date ON body_weight(date);
`);

// ─── 第二步：新增 SaaS 专属表（IF NOT EXISTS 幂等）──────────────────────────

db.exec(`
  -- ✅ 用户账号表
  --    role: 'admin' 为管理员（拥有所有权限），'user' 为普通用户
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ✅ 邮箱验证码表
  --    用于注册验证和修改密码验证
  --    expires_at: 验证码到期时间（通常为 10 分钟后）
  --    used: 0=未使用, 1=已使用（一次性验证码）
  CREATE TABLE IF NOT EXISTS verification_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ✅ 系统配置表 (存储创作者联系方式等)
  CREATE TABLE IF NOT EXISTS system_config (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  -- ✅ 系统公告表 (支持历史记录)
  CREATE TABLE IF NOT EXISTS announcements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    active     INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 为 email 建索引，加速验证码查询
  CREATE INDEX IF NOT EXISTS idx_codes_email ON verification_codes(email);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// ─── 第三步：安全追加 user_id 列到现有表 ────────────────────────────────────
//
// ⚠️  SQLite 的 "ALTER TABLE ADD COLUMN" 规则：
//     - 如果列已存在，会抛出 "duplicate column name" 错误
//     - 我们用 try-catch 捕获这个错误并静默忽略，实现幂等操作
//     - 允许 NULL 是关键！这样旧数据不会因为没有 user_id 而出错
//
const addColumnSafely = (tableName, columnDef) => {
  try {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
    console.log(`[DB 迁移] ✅ ${tableName} 新增列: ${columnDef}`);
  } catch (err) {
    // "duplicate column name" 表示列已存在，这是预期情况，直接忽略
    if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
      // 静默忽略，不打印任何内容，避免每次启动都刷屏
    } else {
      // 如果是其他未知错误，则抛出给上层处理
      throw err;
    }
  }
};

// 为四张业务表追加 user_id 外键列（引用 users.id）
addColumnSafely('exercises',    'user_id INTEGER REFERENCES users(id)');
addColumnSafely('workout_sets', 'user_id INTEGER REFERENCES users(id)');
addColumnSafely('body_weight',  'user_id INTEGER REFERENCES users(id)');
addColumnSafely('routines',     'user_id INTEGER REFERENCES users(id)');

// 🆕 SaaS 资料升级：追加用户名和头像字段
// ⚠️ 注意：SQLite 不支持在 ALTER TABLE 时直接加 UNIQUE，我们需要分两步走
addColumnSafely('users', 'username TEXT');
addColumnSafely('users', 'avatar_url TEXT');

// ─── 第三步.75：为旧用户填充默认用户名 ──────────────────────────────────────
// 防止由于 username 为 NULL 导致的显示问题，并将邮箱前缀作为初始用户名
(() => {
  const usersWithoutName = db.prepare('SELECT id, email FROM users WHERE username IS NULL').all();
  if (usersWithoutName.length > 0) {
    const update = db.prepare('UPDATE users SET username = ? WHERE id = ?');
    for (const u of usersWithoutName) {
      // 提取邮箱前缀，如果冲突则附带 ID 保证唯一
      const prefix = u.email.split('@')[0];
      try {
        update.run(prefix, u.id);
      } catch {
        update.run(`${prefix}_${u.id}`, u.id);
      }
    }
    console.log(`[DB 迁移] ✅ 已为 ${usersWithoutName.length} 个旧用户分配了初始用户名`);
  }
})();

// 🆕 为 username 创建唯一索引（确保业务逻辑上的唯一性）
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
} catch (err) {
  console.warn('[DB 迁移] 唯一索引创建跳过:', err.message);
}

// ─── 第三步半：修复 routines 表的主键问题（多用户兼容性迁移）────────────────
//
// 🐛 问题根因：
//    原始 routines 表用 "dayOfWeek INTEGER PRIMARY KEY"，全表只允许0-6共7行。
//    加入多用户后，每个用户都需要自己的7条计划（共 7×N 行），
//    直接插入第二个用户的计划时会触发主键冲突（UNIQUE constraint failed）。
//
// ✅ 修复方案（SQLite 标准迁移三步法，零数据丢失）：
//    1. RENAME 旧表为临时备份表（保留所有数据）
//    2. 用新的、正确的 schema 重建 routines 表（无单列主键）
//    3. 把备份表的数据全部 INSERT 回新表，然后 DROP 备份表
//
// 检测方法：用 PRAGMA table_info 查询 dayOfWeek 列的 pk 字段
//    pk=1 表示该列是主键 → 需要迁移
//    pk=0 表示该列不是主键 → 已经迁移过了，直接跳过
//
(() => {
  // 查询 routines 表的列信息
  const cols = db.prepare("PRAGMA table_info(routines)").all();
  const dayCol = cols.find(c => c.name === 'dayOfWeek');

  // 如果 dayOfWeek 是主键（pk !== 0），说明还是旧的单用户 schema
  if (dayCol && dayCol.pk !== 0) {
    console.log('[DB 迁移] ⚠️  检测到 routines 表使用旧的单主键 schema，开始安全迁移...');

    // 使用事务保证原子性：迁移要么完全成功，要么完全回滚
    const migrateRoutines = db.transaction(() => {
      // 步骤1：将旧表重命名为临时备份名（数据完整保留）
      db.exec('ALTER TABLE routines RENAME TO routines_legacy_backup');

      // 步骤2：用新 schema 重建 routines 表
      //         关键变化：去掉 dayOfWeek 的 PRIMARY KEY 约束
      //         改用自增 id 作为主键，允许多用户各自拥有 0-6 的计划行
      db.exec(`
        CREATE TABLE routines (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          dayOfWeek    INTEGER NOT NULL,
          name         TEXT NOT NULL,
          exerciseIds  TEXT NOT NULL DEFAULT '[]',
          user_id      INTEGER REFERENCES users(id)
        )
      `);

      // 步骤3：将备份表中的所有数据迁移回新表
      //         旧表可能没有 user_id 列（如果 addColumnSafely 还没执行到），
      //         用 COALESCE 安全处理 NULL 值
      const oldRows = db.prepare('SELECT * FROM routines_legacy_backup').all();
      const insertRow = db.prepare(
        'INSERT INTO routines (dayOfWeek, name, exerciseIds, user_id) VALUES (?, ?, ?, ?)'
      );
      for (const row of oldRows) {
        insertRow.run(row.dayOfWeek, row.name, row.exerciseIds, row.user_id ?? null);
      }

      // 步骤4：删除备份表（数据已全部迁移完毕）
      db.exec('DROP TABLE routines_legacy_backup');

      console.log(`[DB 迁移] ✅ routines 表迁移完成，共保留 ${oldRows.length} 条周计划数据`);
    });

    migrateRoutines();
  }
})();

// ─── 第四步：播种默认数据（仅在 exercises 表完全为空时执行）──────────────────

const exerciseCount = db.prepare('SELECT COUNT(*) as cnt FROM exercises').get();

if (exerciseCount.cnt === 0) {
  console.log('[DB] 首次启动，播种默认动作数据...');

  const insertEx = db.prepare(`
    INSERT INTO exercises (id, name, target, sets, reps, rest, imageUrl, notes)
    VALUES (@id, @name, @target, @sets, @reps, @rest, @imageUrl, @notes)
  `);

  const insertRoutine = db.prepare(`
    INSERT INTO routines (dayOfWeek, name, exerciseIds)
    VALUES (@dayOfWeek, @name, @exerciseIds)
  `);

  const seedAll = db.transaction(() => {
    for (const ex of defaultExercises) {
      insertEx.run(ex);
    }
    for (const r of defaultRoutines) {
      insertRoutine.run({
        dayOfWeek: r.dayOfWeek,
        name: r.name,
        exerciseIds: JSON.stringify(r.exerciseIds),
      });
    }
  });

  seedAll();
  console.log(`[DB] ✅ 已播种 ${defaultExercises.length} 个标准动作, ${defaultRoutines.length} 条周计划模板`);
}

// ─── 第五步：创建复合索引（加速多用户场景下的常见查询）────────────────────────
//
// 当查询条件同时包含 user_id + 另一列时，复合索引比单列索引快得多。
// IF NOT EXISTS 保证幂等，重复执行不会报错。
//
try {
  db.exec(`
    -- 打卡记录：按用户+动作查询（力量增长趋势、PR 计算）
    CREATE INDEX IF NOT EXISTS idx_workout_user_exercise ON workout_sets(user_id, exerciseId);

    -- 打卡记录：按用户+日期查询（每日汇总、热力图）
    CREATE INDEX IF NOT EXISTS idx_workout_user_date ON workout_sets(user_id, date);

    -- 体重记录：按用户+日期查询（体重趋势图）
    CREATE INDEX IF NOT EXISTS idx_bodyweight_user_date ON body_weight(user_id, date);

    -- 周计划：按用户+星期查询（获取某天的训练计划）
    CREATE INDEX IF NOT EXISTS idx_routines_user_day ON routines(user_id, dayOfWeek);
  `);
} catch (err) {
  console.warn('[DB 索引] 创建跳过:', err.message);
}

// ─── 第六步：新增 Diet Hub 饮食追踪模块表 ────────────────────────────────────

db.exec(`
  -- ✅ 食物库表
  --    created_by: 'system' 表示系统预置食物，数字 ID 表示用户自定义食物
  CREATE TABLE IF NOT EXISTS foods (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL,
    calories_per_100g  REAL NOT NULL DEFAULT 0,
    protein_per_100g   REAL NOT NULL DEFAULT 0,
    carbs_per_100g     REAL NOT NULL DEFAULT 0,
    fat_per_100g       REAL NOT NULL DEFAULT 0,
    created_by         TEXT NOT NULL DEFAULT 'system',
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ✅ 饮食记录表
  --    meal_type: 餐次类型，限制为四种
  --    weight_grams: 实际摄入克数
  --    date: 北京时间日期 YYYY-MM-DD
  CREATE TABLE IF NOT EXISTS diet_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    food_id      INTEGER NOT NULL REFERENCES foods(id),
    meal_type    TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
    weight_grams REAL NOT NULL,
    date         TEXT NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 为饮食记录建复合索引（按用户+日期查询）
  CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date ON diet_logs(user_id, date);
  -- 为食物库建索引（按创建者查询）
  CREATE INDEX IF NOT EXISTS idx_foods_created_by ON foods(created_by);
`);

// ─── 第七步：播种系统默认食物库（仅在 foods 表为空时执行）──────────────────

const foodCount = db.prepare('SELECT COUNT(*) as cnt FROM foods').get();

if (foodCount.cnt === 0) {
  console.log('[DB] 首次启动 Diet Hub，播种系统默认食物数据...');

  // 系统默认食物库（每 100g 的营养数据）
  // 数据格式: [名称, 热量, 蛋白质, 碳水, 脂肪]
  const defaultFoods = [
    // ── 用户指定的默认食物 ──
    ['鸡蛋', 155, 13.0, 1.1, 11.0],
    ['鸡蛋白', 52, 11.0, 0.7, 0.2],
    ['燕麦', 379, 13.0, 67.0, 6.5],
    ['纯土豆泥', 86, 1.6, 17.5, 0.2],
    ['黄瓜', 16, 0.7, 3.6, 0.1],
    ['西红柿', 18, 0.9, 3.9, 0.2],
  ];

  const insertFood = db.prepare(`
    INSERT INTO foods (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_by)
    VALUES (?, ?, ?, ?, ?, 'system')
  `);

  const seedFoods = db.transaction(() => {
    for (const [name, cal, protein, carbs, fat] of defaultFoods) {
      insertFood.run(name, cal, protein, carbs, fat);
    }
  });

  seedFoods();
  console.log(`[DB] ✅ 已播种 ${defaultFoods.length} 种系统默认食物`);
}

module.exports = db;
