/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 认证路由 (routes/auth.js)
 *
 * 路由清单：
 *   POST /api/auth/send-code       发送邮箱验证码
 *   POST /api/auth/register        用户注册（含首位管理员逻辑 + 计划克隆）
 *   POST /api/auth/login           用户登录
 *   POST /api/auth/change-password 修改密码（支持原密码或验证码两种方式）
 *   GET  /api/auth/me              获取当前登录用户信息
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // 🆕 引入 multer
const { requireAuth } = require('../middleware/auth');

// 🆕 配置头像存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // 生成：用户ID_时间戳.扩展名
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 限制 2MB
});

// 🆕 引入标准种子数据，确保新用户注册时获得纯净的基础动作库
const { defaultExercises, defaultRoutines } = require('../seedData');

// 从环境变量读取配置
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '30d'; // Token 有效期 30 天

// 初始化 Resend 邮件客户端
const resend = new Resend(process.env.RESEND_API_KEY);

// 发件人地址（从环境变量读取）
const FROM_EMAIL = process.env.RESEND_FROM || 'SharkFit <noreply@sharkfit.app>';

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 生成 6 位数字验证码
 */
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * 生成极客风格的验证码 HTML 邮件
 * @param {string} code - 6位验证码
 * @param {string} purpose - 用途文字，如"注册账号"或"修改密码"
 */
const buildEmailHtml = (code, purpose = '注册账号') => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#080c10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:1px;background:linear-gradient(135deg,#10b981,#059669);border-radius:24px;">
    <div style="background-color:#0d1117;border-radius:23px;overflow:hidden;">
      
      <!-- Header -->
      <div style="padding:40px 0;text-align:center;background:linear-gradient(to bottom, rgba(16,185,129,0.05), transparent);">
        <div style="font-size:56px;margin-bottom:16px;">🐟</div>
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;letter-spacing:3px;">FINFIT</h1>
        <p style="margin:8px 0 0;color:#10b981;font-size:12px;font-weight:bold;letter-spacing:5px;text-transform:uppercase;opacity:0.8;">sharkchili.xyz</p>
      </div>

      <!-- Main Content -->
      <div style="padding:40px 48px;">
        <div style="margin-bottom:32px;">
          <h2 style="margin:0 0 12px;color:#ffffff;font-size:20px;font-weight:bold;">验证您的身份</h2>
          <p style="margin:0;color:#8b949e;font-size:15px;line-height:1.6;">
            您好！为了确保您的账号安全，请在 <strong style="color:#ffffff;">${purpose}</strong> 页面输入下方的验证码。
          </p>
        </div>
        
        <!-- Code Box -->
        <div style="background-color:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:16px;padding:32px;text-align:center;margin-bottom:32px;">
          <div style="color:#10b981;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:4px;margin-bottom:12px;">验证码</div>
          <div style="letter-spacing:16px;font-size:48px;font-weight:900;color:#ffffff;font-family:'Courier New',monospace;text-shadow:0 0 10px rgba(16,185,129,0.3);-webkit-user-select:all;user-select:all;">${code}</div>
          <div style="margin-top:16px;color:#8b949e;font-size:13px;">请长按或双击上方代码进行复制</div>
        </div>

        <!-- Action Link -->
        <div style="text-align:center;margin-bottom:32px;">
          <a href="https://sharkchili.xyz" style="display:inline-block;padding:14px 32px;background-color:#10b981;color:#000000;text-decoration:none;border-radius:12px;font-weight:bold;font-size:14px;box-shadow:0 4px 15px rgba(16,185,129,0.2);">返回网站</a>
        </div>

        <!-- Warning -->
        <div style="padding:16px;background-color:#161b22;border-radius:12px;border-left:4px solid #f59e0b;">
          <p style="margin:0;color:#8b949e;font-size:13px;line-height:1.6;">
            ⚠️ <strong>安全提示：</strong> 工作人员不会向您索要验证码。如果您未曾尝试 ${purpose}，请立即忽略此邮件。
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:32px;background-color:#0d1117;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0;color:#484f58;font-size:12px;">
          本邮件由 <a href="https://sharkchili.xyz" style="color:#10b981;text-decoration:none;">sharkchili.xyz</a> 自动发出，请勿直接回复。<br>
          © ${new Date().getFullYear()} FinFit · 专注训练，持续进步
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ═══════════════════════════════════════════════════════════════════════════
// 路由 1：发送邮箱验证码
// POST /api/auth/send-code
// 请求体: { email, purpose?: 'register' | 'change-password' }
// ═══════════════════════════════════════════════════════════════════════════

router.post('/send-code', async (req, res) => {
  try {
    const { email, purpose = 'register' } = req.body;

    // 基础参数校验
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请提供有效的邮箱地址' });
    }

    // 如果是注册，检查邮箱是否已被注册
    if (purpose === 'register') {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(409).json({ error: '该邮箱已被注册' });
      }
    }

    // 如果是重置密码，检查邮箱是否存在
    if (purpose === 'reset-password') {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (!existingUser) {
        return res.status(404).json({ error: '该邮箱未注册，请先注册账号' });
      }
    }

    // 🆕 自动清理逻辑：发送新码前，先删掉该邮箱所有已过期或已使用的垃圾记录
    // 这能有效防止由于残留数据导致的各种奇葩校验失败
    db.prepare(`
      DELETE FROM verification_codes 
      WHERE email = ? AND (expires_at < datetime('now') OR used = 1)
    `).run(email);

    // 频率限制：同一邮箱 60 秒内不能重复发送有效验证码
    // （如果之前发的已经过期或被我们删了，这里就不会触发限制）
    const recentCode = db.prepare(`
      SELECT created_at FROM verification_codes
      WHERE email = ? AND created_at > datetime('now', '-60 seconds')
      ORDER BY created_at DESC LIMIT 1
    `).get(email);

    if (recentCode) {
      return res.status(429).json({ error: '发送太频繁，请 60 秒后再试' });
    }

    // 生成验证码
    const code = generateCode();

    // 计算过期时间（当前时间 + 10 分钟）
    // SQLite 的 datetime 函数使用 UTC 时间
    db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, datetime('now', '+10 minutes'))
    `).run(email, code);

    // 确定邮件主题和用途文字
    let purposeText = '修改密码';
    let subjectText = '你的 FinFit 密码修改验证码';

    if (purpose === 'register') {
      purposeText = '注册账号';
      subjectText = '你的 FinFit 注册验证码';
    } else if (purpose === 'reset-password') {
      purposeText = '找回密码';
      subjectText = '你的 FinFit 找回密码验证码';
    }

    // 发送邮件（使用 Resend SDK）
    const emailResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: subjectText,
      html: buildEmailHtml(code, purposeText),
    });

    if (emailResult.error) {
      // 🆕 将错误详情记录到本地日志文件，方便诊断
      const logMsg = `[${new Date().toLocaleString()}] 邮件发送失败 (${email}): ${JSON.stringify(emailResult.error)}\n`;
      fs.appendFileSync(path.join(__dirname, '../error.log'), logMsg);
      
      console.error('[邮件] 发送失败:', emailResult.error);
      return res.status(500).json({ error: '验证码发送失败，请检查邮箱地址或稍后再试' });
    }

    console.log(`[验证码] 已发送到 ${email}，ID: ${emailResult.data?.id}`);
    res.json({ success: true, message: '验证码已发送，请查收邮件' });

  } catch (err) {
    console.error('[send-code 错误]', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 2：用户注册
// POST /api/auth/register
// 请求体: { email, password, code }
//
// 🌟 核心逻辑：
//   - 首位注册的用户自动成为 admin
//   - 管理员注册后，所有 user_id IS NULL 的历史数据归集给管理员
//   - 普通用户注册时，从管理员账号克隆动作库和周计划
// ═══════════════════════════════════════════════════════════════════════════

router.post('/register', async (req, res) => {
  try {
    const { email, password, code, username } = req.body;

    // ── 基础参数校验 ──────────────────────────────────────────────────────
    if (!email || !password || !code || !username) {
      return res.status(400).json({ error: '邮箱、用户名、密码和验证码均不能为空' });
    }
    if (username.length < 2) {
      return res.status(400).json({ error: '用户名太短了' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于 6 位' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 🆕 增强校验：查询该邮箱下是否存在匹配、未使用且未过期的验证码
    const validCode = db.prepare(`
      SELECT id FROM verification_codes
      WHERE email = ?
        AND code = ?
        AND used = 0
        AND expires_at > datetime('now')
      LIMIT 1
    `).get(email, code.trim());

    if (!validCode) {
      return res.status(400).json({ error: '验证码错误、无效或已过期' });
    }

    // ── 检查邮箱和用户名是否已注册 ───────────────────────────────────────────────
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUsername) {
      return res.status(409).json({ error: '用户名已存在，请换一个吧' });
    }

    // ─────────────────────────────────────────────────────────────────────
    // ✅ 核心逻辑 1：判断是否为首位用户（自动成为 admin）
    // 查询 users 表中的总用户数，如果为 0，则当前注册的人就是管理员
    // ─────────────────────────────────────────────────────────────────────
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    const isFirstUser = userCount.cnt === 0; // true 表示系统中还没有任何用户
    const role = isFirstUser ? 'admin' : 'user'; // 首位用户自动成为 admin

    // ── 使用 bcrypt 对密码进行哈希加密 ───────────────────────────────────
    // bcrypt.hash(password, saltRounds)
    // saltRounds=10 表示加盐轮数，值越大越安全但越慢（10 是业界标准推荐值）
    const passwordHash = await bcrypt.hash(password, 10);

    // ─────────────────────────────────────────────────────────────────────
    // ✅ 使用数据库事务保证原子性：
    //    要么全部成功（用户创建 + 数据操作），要么全部回滚
    //    这防止了"用户创建成功但数据归集失败"这种半成功状态
    // ─────────────────────────────────────────────────────────────────────
    const registerTransaction = db.transaction(() => {

      // ── 步骤 1：插入新用户 ──────────────────────────────────────────────
      const insertResult = db.prepare(`
        INSERT INTO users (email, password_hash, role, username)
        VALUES (?, ?, ?, ?)
      `).run(email, passwordHash, role, username);

      // lastInsertRowid 是 SQLite 自动分配的新用户 ID（INTEGER PRIMARY KEY AUTOINCREMENT）
      const newUserId = insertResult.lastInsertRowid;

      // ── 步骤 2a：如果是首位管理员 → 归集所有历史数据 ────────────────────
      if (isFirstUser) {
        // 将所有 user_id IS NULL 的旧数据（迁移前的历史数据）绑定到管理员 ID
        // 这是数据迁移的核心步骤，保证了所有历史训练记录不丢失
        const claimedEx    = db.prepare('UPDATE exercises    SET user_id = ? WHERE user_id IS NULL').run(newUserId);
        const claimedSets  = db.prepare('UPDATE workout_sets SET user_id = ? WHERE user_id IS NULL').run(newUserId);
        const claimedBW    = db.prepare('UPDATE body_weight  SET user_id = ? WHERE user_id IS NULL').run(newUserId);
        const claimedRt    = db.prepare('UPDATE routines     SET user_id = ? WHERE user_id IS NULL').run(newUserId);

        console.log(`[注册] 🎉 首位管理员 ${email} 注册成功，已归集历史数据：`);
        console.log(`  → 动作库: ${claimedEx.changes} 条`);
        console.log(`  → 训练记录: ${claimedSets.changes} 条`);
        console.log(`  → 体重记录: ${claimedBW.changes} 条`);
        console.log(`  → 周计划: ${claimedRt.changes} 条`);
      }

      // ── 步骤 2b：如果是普通用户 → 分配标准基础动作和计划 ──────────────────
      if (!isFirstUser) {
        // ⚠️  不再克隆管理员的实时数据，而是克隆 seedData.js 中的标准 31 个动作
        //    这样即便管理员修改了自己的动作库，新用户注册时依然获得标准的初始数据
        
        const idMap = {}; // 格式: { '旧ID': '新ID', ... }

        const insertExercise = db.prepare(`
          INSERT INTO exercises (id, name, target, sets, reps, rest, imageUrl, notes, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // 插入 31 个标准动作
        for (const ex of defaultExercises) {
          const newId = uuidv4();
          idMap[ex.id] = newId;

          insertExercise.run(
            newId, ex.name, ex.target, ex.sets, ex.reps, ex.rest, ex.imageUrl, ex.notes, newUserId
          );
        }

        // 插入 7 天标准周计划
        const insertRoutine = db.prepare(`
          INSERT INTO routines (dayOfWeek, name, exerciseIds, user_id)
          VALUES (?, ?, ?, ?)
        `);

        for (const r of defaultRoutines) {
          const newIds = r.exerciseIds.map(oldId => idMap[oldId] || oldId);
          insertRoutine.run(
            r.dayOfWeek, r.name, JSON.stringify(newIds), newUserId
          );
        }

        console.log(`[注册] 👤 新用户 ${email} 注册成功，已分配 ${defaultExercises.length} 个标准动作和 7 天初始计划`);
      }

      // ── 步骤 3：标记验证码为已使用（一次性） ─────────────────────────────
      db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(validCode.id);

      // 返回新用户 ID 和角色，供后续签发 JWT 使用
      return { newUserId, role };
    });

    // 执行事务（事务内任何错误都会自动回滚）
    const { newUserId, role: finalRole } = registerTransaction();

    // ── 步骤 4：签发 JWT Token ─────────────────────────────────────────────
    // JWT Payload 包含用户基本信息，前端可以解码（但不能篡改）获取角色信息
    const token = jwt.sign(
      { id: newUserId, email, role: finalRole, username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 返回 Token 和用户信息给前端
    res.status(201).json({
      success: true,
      message: isFirstUser ? '注册成功！欢迎，管理员！' : '注册成功！欢迎加入 FinFit！',
      token,
      user: { id: newUserId, email, role: finalRole, username, avatar_url: null },
    });

  } catch (err) {
    console.error('[register 错误]', err.message);
    // 处理邮箱唯一约束冲突（UNIQUE constraint failed: users.email）
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 3：用户登录
// POST /api/auth/login
// 请求体: { email, password }
// ═══════════════════════════════════════════════════════════════════════════

router.post('/login', async (req, res) => {
  try {
    const { email: account, password } = req.body;

    if (!account || !password) {
      return res.status(400).json({ error: '账号和密码不能为空' });
    }

    // 查询用户（支持邮箱或用户名登录）
    const user = db.prepare(
      'SELECT id, email, password_hash, role, username, avatar_url FROM users WHERE email = ? OR username = ?'
    ).get(account, account);

    if (!user) {
      // 故意模糊错误信息，防止枚举攻击（不告诉攻击者是邮箱不存在还是密码错误）
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 使用 bcrypt 比较用户输入的密码和存储的哈希值
    // bcrypt.compare 是异步的，它会自动从哈希中提取 salt 进行比较
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 密码验证通过，签发新的 JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`[登录] ✅ 用户 ${user.username} 登录成功`);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, username: user.username, avatar_url: user.avatar_url },
    });

  } catch (err) {
    console.error('[login 错误]', err.message);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 3.5：重置密码（通过验证码，无需登录）
// POST /api/auth/reset-password
// 请求体: { email, code, newPassword }
// ═══════════════════════════════════════════════════════════════════════════

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: '邮箱、验证码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度不能少于 6 位' });
    }

    // 1. 验证验证码
    const validCode = db.prepare(`
      SELECT id FROM verification_codes
      WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(email, code.trim());

    if (!validCode) {
      return res.status(400).json({ error: '验证码无效或已过期' });
    }

    // 2. 检查用户是否存在
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }

    // 3. 更新密码
    const newHash = await bcrypt.hash(newPassword, 10);
    
    // 使用事务保证密码更新和验证码标记同步
    const resetTransaction = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
      db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(validCode.id);
    });

    resetTransaction();

    console.log(`[重置密码] ✅ 用户 ${email} 通过验证码重置密码成功`);
    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });

  } catch (err) {
    console.error('[reset-password 错误]', err.message);
    res.status(500).json({ error: '重置密码失败，请稍后再试' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 4：修改密码
// POST /api/auth/change-password
// 请求头: Authorization: Bearer <token>
// 请求体: { oldPassword, newPassword } 或 { code, newPassword }
// ═══════════════════════════════════════════════════════════════════════════

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword, code } = req.body;
    const { id: userId, email } = req.user; // 来自 JWT 的用户信息

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度不能少于 6 位' });
    }

    // 查询当前用户的密码哈希
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);

    if (oldPassword) {
      // ── 方式一：通过旧密码验证 ─────────────────────────────────────────
      const isValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: '原密码错误' });
      }
    } else if (code) {
      // ── 方式二：通过邮箱验证码验证 ────────────────────────────────────
      const validCode = db.prepare(`
        SELECT id FROM verification_codes
        WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
        ORDER BY created_at DESC LIMIT 1
      `).get(email, code.trim());

      if (!validCode) {
        return res.status(400).json({ error: '验证码无效或已过期' });
      }

      // 标记验证码已使用
      db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(validCode.id);
    } else {
      return res.status(400).json({ error: '请提供原密码或邮箱验证码' });
    }

    // 对新密码进行 bcrypt 加密
    const newHash = await bcrypt.hash(newPassword, 10);

    // 更新数据库中的密码哈希
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    console.log(`[改密] ✅ 用户 ${email} 修改密码成功`);
    res.json({ success: true, message: '密码修改成功' });

  } catch (err) {
    console.error('[change-password 错误]', err.message);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 4.5：更新个人资料（用户名、头像）
// POST /api/auth/profile
// ═══════════════════════════════════════════════════════════════════════════

router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { username, avatar_url } = req.body;
    const userId = req.user.id;

    if (username) {
      if (username.length < 2) return res.status(400).json({ error: '用户名太短' });
      
      // 检查冲突（排除自己）
      const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
      if (conflict) return res.status(409).json({ error: '用户名已被占用' });

      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
    }

    if (avatar_url !== undefined) {
      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, userId);
    }

    const updatedUser = db.prepare('SELECT id, email, role, username, avatar_url FROM users WHERE id = ?').get(userId);
    res.json({ success: true, user: updatedUser });

  } catch (err) {
    console.error('[profile 错误]', err.message);
    res.status(500).json({ error: '更新资料失败' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 5：获取当前用户信息
// GET /api/auth/me
// 请求头: Authorization: Bearer <token>
// ═══════════════════════════════════════════════════════════════════════════

router.get('/me', requireAuth, (req, res) => {
  try {
    // req.user 已由 requireAuth 中间件填充（来自 JWT 解码）
    const user = db.prepare(
      'SELECT id, email, role, username, avatar_url, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 6：上传头像文件
// POST /api/auth/upload-avatar
// ═══════════════════════════════════════════════════════════════════════════

router.post('/upload-avatar', requireAuth, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未选择文件' });
    }

    // 构造访问 URL
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      url: fileUrl,
      message: '文件上传成功'
    });
  } catch (err) {
    console.error('[上传错误]', err.message);
    res.status(500).json({ error: '头像上传失败' });
  }
});

module.exports = router;
