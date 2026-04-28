/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 后端 API 服务 (server.js) [SaaS 升级版]
 *
 * 运行方式:  node server.js
 * 默认端口:  3001 (可通过环境变量 PORT 修改)
 *
 * 功能清单:
 *   [认证]    POST              /api/auth/send-code, /register, /login
 *   [动作库]  GET/POST/PUT/DELETE  /api/exercises
 *   [周计划]  GET/PUT              /api/routines
 *   [打卡]    GET/POST/DELETE      /api/records
 *   [全量拉取] GET               /api/sync/pull
 *   [管理员]  GET/DELETE          /api/admin/users
 * ═══════════════════════════════════════════════════════════════════════════
 */

const path = require('path');

// 加载 .env 环境变量（必须在其他 require 之前）
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');  // 引入数据库模块 (自动完成建表、迁移和播种)

// 引入认证中间件和路由
const { requireAuth } = require('./middleware/auth');
const authRouter  = require('./routes/auth');
const adminRouter = require('./routes/admin');
const systemRouter = require('./routes/system'); // 🆕 引入系统配置路由
const socialRouter = require('./routes/social');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── 中间件 ──────────────────────────────────────────────────────────────────

// 跨域处理
app.use(cors());

// 解析 JSON 请求体
app.use(express.json({ limit: '5mb' }));

// 🆕 静态资源挂载：让浏览器能访问上传的头像
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// 请求日志（简单版）
app.use((req, res, next) => {
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// ─── 挂载新路由 ───────────────────────────────────────────────────────────────

// 认证相关：注册、登录、验证码等（无需登录即可访问）
app.use('/api/auth', authRouter);

// 管理员专属：用户管理（内部已有 requireAuth + requireAdmin）
app.use('/api/admin', adminRouter);

// 系统配置：联系方式等（公开获取，管理员修改）
app.use('/api/system', systemRouter);

// 社交功能：全系统 PR 荣耀动态
app.use('/api/social', socialRouter);



// ═══════════════════════════════════════════════════════════════════════════
// 动作库 API  /api/exercises
// 所有接口现在需要登录（requireAuth），且查询/操作仅限当前用户的数据
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/exercises
 * 获取当前登录用户的动作列表
 */
app.get('/api/exercises', requireAuth, (req, res) => {
  try {
    // req.user.id 是由 requireAuth 中间件从 JWT 解码注入的用户 ID
    const exercises = db.prepare(
      'SELECT * FROM exercises WHERE user_id = ? ORDER BY created_at'
    ).all(req.user.id);
    res.json(exercises);
  } catch (err) {
    console.error('[错误] 获取动作列表失败:', err.message);
    res.status(500).json({ error: '获取动作列表失败' });
  }
});

/**
 * POST /api/exercises
 * 新增一个动作（自动绑定到当前用户）
 */
app.post('/api/exercises', requireAuth, (req, res) => {
  try {
    const { name, target, sets, reps, rest, imageUrl, notes } = req.body;

    if (!name || !target) {
      return res.status(400).json({ error: '动作名称和目标肌群不能为空' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO exercises (id, name, target, sets, reps, rest, imageUrl, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, target, sets || 4, reps || '8-12', rest || 60, imageUrl || '', notes || '', req.user.id);

    const newExercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id);
    res.status(201).json(newExercise);
  } catch (err) {
    console.error('[错误] 新增动作失败:', err.message);
    res.status(500).json({ error: '新增动作失败' });
  }
});

/**
 * PUT /api/exercises/:id
 * 修改一个动作（校验归属权）
 */
app.put('/api/exercises/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    // 查询时同时验证 user_id，防止用户修改他人的动作
    const existing = db.prepare(
      'SELECT * FROM exercises WHERE id = ? AND user_id = ?'
    ).get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: '动作不存在或无权操作' });
    }

    const updated = { ...existing, ...req.body, id };
    db.prepare(`
      UPDATE exercises SET name=?, target=?, sets=?, reps=?, rest=?, imageUrl=?, notes=?
      WHERE id=? AND user_id=?
    `).run(updated.name, updated.target, updated.sets, updated.reps, updated.rest, updated.imageUrl, updated.notes, id, req.user.id);

    res.json(db.prepare('SELECT * FROM exercises WHERE id = ?').get(id));
  } catch (err) {
    console.error('[错误] 修改动作失败:', err.message);
    res.status(500).json({ error: '修改动作失败' });
  }
});

/**
 * DELETE /api/exercises/:id
 * 删除一个动作（校验归属权，同时清除打卡记录和计划引用）
 */
app.delete('/api/exercises/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = db.prepare('SELECT id FROM exercises WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: '动作不存在或无权操作' });
    }

    const deleteOp = db.transaction(() => {
      // 1. 删除该动作的打卡记录（同属该用户）
      db.prepare('DELETE FROM workout_sets WHERE exerciseId = ? AND user_id = ?').run(id, userId);

      // 2. 从该用户的周计划中移除引用
      const routines = db.prepare('SELECT * FROM routines WHERE user_id = ?').all(userId);
      const updateRoutine = db.prepare('UPDATE routines SET exerciseIds = ? WHERE dayOfWeek = ? AND user_id = ?');
      for (const r of routines) {
        const ids = JSON.parse(r.exerciseIds);
        const filtered = ids.filter(eid => eid !== id);
        if (filtered.length !== ids.length) {
          updateRoutine.run(JSON.stringify(filtered), r.dayOfWeek, userId);
        }
      }

      // 3. 删除动作本身
      db.prepare('DELETE FROM exercises WHERE id = ? AND user_id = ?').run(id, userId);
    });

    deleteOp();
    res.json({ success: true, message: `动作 ${id} 已删除` });
  } catch (err) {
    console.error('[错误] 删除动作失败:', err.message);
    res.status(500).json({ error: '删除动作失败' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 周计划 API  /api/routines
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/routines
 * 获取当前用户的周计划
 */
app.get('/api/routines', requireAuth, (req, res) => {
  try {
    const routines = db.prepare(
      'SELECT * FROM routines WHERE user_id = ? ORDER BY dayOfWeek'
    ).all(req.user.id);
    const parsed = routines.map(r => ({
      ...r,
      exerciseIds: JSON.parse(r.exerciseIds),
    }));
    res.json(parsed);
  } catch (err) {
    console.error('[错误] 获取周计划失败:', err.message);
    res.status(500).json({ error: '获取周计划失败' });
  }
});

/**
 * PUT /api/routines/:dayOfWeek
 * 修改某天的训练计划（校验归属权）
 */
app.put('/api/routines/:dayOfWeek', requireAuth, (req, res) => {
  try {
    const dayOfWeek = Number(req.params.dayOfWeek);
    const { name, exerciseIds } = req.body;
    const userId = req.user.id;

    const existing = db.prepare(
      'SELECT * FROM routines WHERE dayOfWeek = ? AND user_id = ?'
    ).get(dayOfWeek, userId);

    if (!existing) {
      return res.status(404).json({ error: '计划不存在' });
    }

    const updatedName = name || existing.name;
    const updatedIds = exerciseIds !== undefined ? JSON.stringify(exerciseIds) : existing.exerciseIds;

    db.prepare(
      'UPDATE routines SET name = ?, exerciseIds = ? WHERE dayOfWeek = ? AND user_id = ?'
    ).run(updatedName, updatedIds, dayOfWeek, userId);

    const result = db.prepare('SELECT * FROM routines WHERE dayOfWeek = ? AND user_id = ?').get(dayOfWeek, userId);
    res.json({ ...result, exerciseIds: JSON.parse(result.exerciseIds) });
  } catch (err) {
    console.error('[错误] 修改周计划失败:', err.message);
    res.status(500).json({ error: '修改周计划失败' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 打卡记录 API  /api/records
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/records
 */
app.get('/api/records', requireAuth, (req, res) => {
  try {
    const { date, exerciseId } = req.query;
    let sql = 'SELECT * FROM workout_sets WHERE user_id = ?';
    const params = [req.user.id];

    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }
    if (exerciseId) {
      sql += ' AND exerciseId = ?';
      params.push(exerciseId);
    }

    sql += ' ORDER BY created_at ASC';
    const records = db.prepare(sql).all(...params);
    res.json(records);
  } catch (err) {
    console.error('[错误] 获取打卡记录失败:', err.message);
    res.status(500).json({ error: '获取打卡记录失败' });
  }
});

/**
 * POST /api/records
 */
app.post('/api/records', requireAuth, (req, res) => {
  try {
    const { exerciseId, date, weight, reps } = req.body;
    const userId = req.user.id;

    if (!exerciseId || !date || weight === undefined || reps === undefined) {
      return res.status(400).json({ error: '缺少必要字段: exerciseId, date, weight, reps' });
    }

    const numWeight = Number(weight);
    const numReps = Number(reps);

    // 计算是否 PR（只在该用户的记录范围内）
    const prevMax = db.prepare(
      'SELECT MAX(weight) as maxWeight FROM workout_sets WHERE exerciseId = ? AND user_id = ?'
    ).get(exerciseId, userId);

    const prevMaxWeight = prevMax?.maxWeight || 0;
    // 🆕 修正：首条记录或超过历史记录均判定为 PR
    const isPR = (numWeight > prevMaxWeight || prevMaxWeight === 0) ? 1 : 0;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO workout_sets (id, exerciseId, date, weight, reps, isPR, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, exerciseId, date, numWeight, numReps, isPR, userId);

    const newRecord = db.prepare('SELECT * FROM workout_sets WHERE id = ?').get(id);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error('[错误] 新增打卡记录失败:', err.message);
    res.status(500).json({ error: '新增打卡记录失败' });
  }
});

/**
 * DELETE /api/records/:id
 */
app.delete('/api/records/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare(
      'DELETE FROM workout_sets WHERE id = ? AND user_id = ?'
    ).run(id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在或无权操作' });
    }

    res.json({ success: true, message: `记录 ${id} 已删除` });
  } catch (err) {
    console.error('[错误] 删除打卡记录失败:', err.message);
    res.status(500).json({ error: '删除打卡记录失败' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 体重 API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/bodyweight', requireAuth, (req, res) => {
  try {
    const { weight, date } = req.body;
    const userId = req.user.id;

    if (!weight || !date) return res.status(400).json({ error: '缺少体重或日期' });

    const id = uuidv4();
    db.prepare('DELETE FROM body_weight WHERE date = ? AND user_id = ?').run(date, userId);
    db.prepare('INSERT INTO body_weight (id, weight, date, user_id) VALUES (?, ?, ?, ?)').run(id, weight, date, userId);

    res.status(201).json({ id, weight, date });
  } catch (err) {
    console.error('[错误] 记录体重失败:', err.message);
    res.status(500).json({ error: '记录体重失败' });
  }
});

app.delete('/api/bodyweight/:date', requireAuth, (req, res) => {
  try {
    const { date } = req.params;
    db.prepare('DELETE FROM body_weight WHERE date = ? AND user_id = ?').run(date, req.user.id);
    res.json({ success: true, message: `体重记录 ${date} 已删除` });
  } catch (err) {
    console.error('[错误] 删除体重失败:', err.message);
    res.status(500).json({ error: '删除体重失败' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 分析中心 API  /api/analytics
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/analytics/summary', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const volume = db.prepare(`
      SELECT SUM(weight * reps) as totalVolume 
      FROM workout_sets 
      WHERE date >= ? AND user_id = ?
    `).get(weekStartStr, userId).totalVolume || 0;

    const dates = db.prepare(
      'SELECT DISTINCT date FROM workout_sets WHERE user_id = ? ORDER BY date DESC'
    ).all(userId);

    let streak = 0;
    if (dates.length > 0) {
      let current = new Date().toISOString().split('T')[0];
      if (dates[0].date !== current) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        current = yesterday.toISOString().split('T')[0];
      }
      for (const d of dates) {
        if (d.date === current) {
          streak++;
          const nextDate = new Date(current);
          nextDate.setDate(nextDate.getDate() - 1);
          current = nextDate.toISOString().split('T')[0];
        } else {
          break;
        }
      }
    }

    res.json({ totalVolume: volume, streak });
  } catch (err) {
    res.status(500).json({ error: '获取汇总失败' });
  }
});

app.get('/api/analytics/strength/:exerciseId', requireAuth, (req, res) => {
  try {
    const { exerciseId } = req.params;
    const data = db.prepare(`
      SELECT date, MAX(weight) as maxWeight 
      FROM workout_sets 
      WHERE exerciseId = ? AND user_id = ?
      GROUP BY date 
      ORDER BY date ASC
    `).all(exerciseId, req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '获取力量数据失败' });
  }
});

app.get('/api/analytics/weight', requireAuth, (req, res) => {
  try {
    const data = db.prepare(
      'SELECT date, weight FROM body_weight WHERE user_id = ? ORDER BY date ASC'
    ).all(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '获取体重数据失败' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 全量同步 API  /api/sync/pull
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/sync/pull', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;

    // 1. 该用户的全部动作
    const exercises = db.prepare(
      'SELECT * FROM exercises WHERE user_id = ? ORDER BY created_at'
    ).all(userId);

    // 2. 该用户的全部周计划
    const routinesRaw = db.prepare(
      'SELECT * FROM routines WHERE user_id = ? ORDER BY dayOfWeek'
    ).all(userId);
    const routines = routinesRaw.map(r => ({
      ...r,
      exerciseIds: JSON.parse(r.exerciseIds),
    }));

    // 3. 该用户的打卡记录 → 组装为嵌套的 history[] 格式
    const allSets = db.prepare(
      'SELECT * FROM workout_sets WHERE user_id = ? ORDER BY date, created_at'
    ).all(userId);

    const historyMap = {};
    for (const s of allSets) {
      if (!historyMap[s.date]) {
        historyMap[s.date] = { date: s.date, workouts: [] };
      }
      const dayEntry = historyMap[s.date];
      let workout = dayEntry.workouts.find(w => w.exerciseId === s.exerciseId);
      if (!workout) {
        workout = { exerciseId: s.exerciseId, sets: [] };
        dayEntry.workouts.push(workout);
      }
      workout.sets.push({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        isPR: s.isPR === 1,
      });
    }

    const history = Object.values(historyMap).sort((a, b) => a.date.localeCompare(b.date));

    // 4. 该用户的体重记录
    const bodyWeight = db.prepare(
      'SELECT * FROM body_weight WHERE user_id = ? ORDER BY date ASC'
    ).all(userId);

    res.json({ exercises, routines, history, bodyWeight });
  } catch (err) {
    console.error('[错误] 全量同步失败:', err.message);
    res.status(500).json({ error: '全量同步失败' });
  }
});


/**
 * POST /api/auth/update-public
 * 更新用户的隐私公开设置
 */
app.post('/api/auth/update-public', requireAuth, (req, res) => {
  try {
    const { is_public } = req.body;
    db.prepare('UPDATE users SET is_public = ? WHERE id = ?').run(is_public ? 1 : 0, req.user.id);
    res.json({ success: true, is_public });
  } catch (err) {
    console.error('[错误] 更新隐私设置失败:', err.message);
    res.status(500).json({ error: '更新隐私设置失败' });
  }
});

// ─── 管理员后台 API ───────────────────────────────────────────────────────────

// 获取所有用户列表 (仅限管理员)
app.get('/api/admin/users', requireAuth, (req, res) => {
  try {
    const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    // 统计每个用户的数据量
    const users = db.prepare(`
      SELECT 
        u.id, u.email, u.username, u.role, u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM exercises WHERE user_id = u.id) as exercise_count,
        (SELECT COUNT(*) FROM workout_sets WHERE user_id = u.id) as record_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    res.json(users);
  } catch (err) {
    console.error('[Admin] 获取用户列表失败:', err.message);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 删除用户及其所有数据 (仅限管理员)
app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  try {
    const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const targetId = req.params.id;
    if (Number(targetId) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    // 级联删除用户相关的所有业务数据
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM workout_sets WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM exercises WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM routines WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM body_weight WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    });

    deleteTransaction();
    res.json({ success: true, message: '用户已彻底删除' });
  } catch (err) {
    console.error('[Admin] 删除用户失败:', err.message);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// ─── 系统全局配置 API ─────────────────────────────────────────────────────────

// 获取系统联系方式 (公开)
app.get('/api/system/contact', (req, res) => {
  try {
    const config = db.prepare('SELECT value FROM system_config WHERE key = ?').get('contact');
    res.json(config ? JSON.parse(config.value) : { wechat: '', email: '', qr: '' });
  } catch (err) {
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 更新系统联系方式 (仅管理员)
const multer = require('multer');
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => cb(null, `system_qr_${Date.now()}${path.extname(file.originalname)}`)
  })
});

app.post('/api/system/contact', requireAuth, upload.single('qr_file'), (req, res) => {
  try {
    const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!admin || admin.role !== 'admin') return res.status(403).json({ error: '权限不足' });

    const { wechat, email } = req.body;
    let qrPath = null;
    if (req.file) qrPath = `/uploads/${req.file.filename}`;

    const oldConfig = db.prepare('SELECT value FROM system_config WHERE key = ?').get('contact');
    const prevData = oldConfig ? JSON.parse(oldConfig.value) : {};
    
    const newData = {
      wechat: wechat || prevData.wechat || '',
      email: email || prevData.email || '',
      qr: qrPath || prevData.qr || ''
    };

    db.prepare('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)')
      .run('contact', JSON.stringify(newData));

    res.json({ success: true, data: newData });
  } catch (err) {
    res.status(500).json({ error: '保存失败' });
  }
});

// ─── 公告系统 API (支持历史记录) ──────────────────────────────────────────────

// 获取最新一条激活的公告 (用户端调用)
app.get('/api/announcement/latest', (req, res) => {
  try {
    const ann = db.prepare('SELECT * FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 1').get();
    res.json(ann || { id: 0, title: '', content: '', active: 0 });
  } catch (err) {
    res.status(500).json({ error: '获取公告失败' });
  }
});

// 获取所有历史公告 (仅管理员)
app.get('/api/announcements', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: '权限不足' });

    const list = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: '获取公告列表失败' });
  }
});

// 发布新公告 (仅管理员)
app.post('/api/announcements', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: '权限不足' });

    const { title, content, active } = req.body;
    
    // 如果是启用状态，先将其他所有公告设为不启用（保证只弹出一个）
    if (active) {
      db.prepare('UPDATE announcements SET active = 0').run();
    }

    const info = db.prepare('INSERT INTO announcements (title, content, active) VALUES (?, ?, ?)')
      .run(title, content, active ? 1 : 0);

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: '发布失败' });
  }
});

// 删除公告 (仅管理员)
app.delete('/api/announcements/:id', requireAuth, (req, res) => {
  try {
    const adminUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const annId = String(req.params.id); // 先转为字符串
    console.log('[公告] 尝试删除 ID:', annId);

    // 尝试直接删除 (SQLite 自动处理类型转换)
    const result = db.prepare('DELETE FROM announcements WHERE id = ?').run(annId);
    
    if (result.changes > 0) {
      console.log('[公告] 删除成功');
      res.json({ success: true });
    } else {
      // 如果没删除成功，尝试用数字类型再删一次 (预防万一)
      const result2 = db.prepare('DELETE FROM announcements WHERE id = ?').run(parseInt(annId));
      if (result2.changes > 0) {
        res.json({ success: true });
      } else {
        console.warn('[公告] 未找到对应的记录:', annId);
        res.status(404).json({ error: '记录不存在' });
      }
    }
  } catch (err) {
    console.error('[公告] 删除异常:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ─── 静态文件与启动 ───────────────────────────────────────────────────────────

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const distDir = path.join(__dirname, '..', 'dist');
const indexFile = path.join(distDir, 'index.html');

if (fs.existsSync(indexFile)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(indexFile);
  });
}

// 健康检查
app.get('/api/health', (req, res) => {
  try {
    const exerciseCount = db.prepare('SELECT COUNT(*) as cnt FROM exercises').get().cnt;
    const setCount = db.prepare('SELECT COUNT(*) as cnt FROM workout_sets').get().cnt;
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: { users: userCount, exercises: exerciseCount, records: setCount }
    });
  } catch (err) {
    res.status(500).json({ status: 'error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🐟 FinFit API Server 运行在: http://0.0.0.0:${PORT}\n`);
});
