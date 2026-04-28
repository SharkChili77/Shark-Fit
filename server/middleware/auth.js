/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 认证中间件 (middleware/auth.js)
 *
 * 提供两个中间件函数：
 *   requireAuth  — 验证请求是否携带有效的 JWT Token
 *   requireAdmin — 在 requireAuth 基础上，进一步验证是否为管理员角色
 *
 * 使用方式（在路由中）：
 *   app.get('/api/protected', requireAuth, handler)
 *   app.get('/api/admin/users', requireAuth, requireAdmin, handler)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const jwt = require('jsonwebtoken');

// 从环境变量读取 JWT 密钥，如果没有则抛出错误（启动时应该已经 dotenv 加载）
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * requireAuth 中间件
 *
 * 工作流程：
 * 1. 从请求头 "Authorization: Bearer <token>" 中提取 Token
 * 2. 使用 JWT_SECRET 解码并验证签名和有效期
 * 3. 如果验证成功，把解码后的用户信息 { id, email, role } 挂载到 req.user
 * 4. 调用 next() 把控制权交给下一个中间件或路由处理函数
 * 5. 任何验证失败都返回 401 Unauthorized
 */
const requireAuth = (req, res, next) => {
  try {
    // 提取 Authorization 请求头
    const authHeader = req.headers['authorization'];

    // 检查格式是否为 "Bearer xxxxx"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }

    // 截取 "Bearer " 后面的 Token 字符串
    const token = authHeader.substring(7);

    // 使用密钥验证 Token
    // jwt.verify 会自动检查签名和过期时间
    // 如果 Token 无效或已过期，会抛出异常，被下面的 catch 捕获
    const decoded = jwt.verify(token, JWT_SECRET);

    // 把解码后的用户信息挂载到 req 上，供后续路由使用
    // decoded 结构: { id: number, email: string, role: 'admin'|'user', iat, exp }
    req.user = decoded;

    // 验证通过，继续处理请求
    next();
  } catch (err) {
    // jwt.verify 抛出的常见错误：
    // - JsonWebTokenError: 签名无效（Token 被篡改）
    // - TokenExpiredError: Token 已过期
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token 已过期，请重新登录' });
    }
    return res.status(401).json({ error: 'Token 无效，请重新登录' });
  }
};

/**
 * requireAdmin 中间件
 *
 * 必须在 requireAuth 之后使用（依赖 req.user 已经被设置）
 * 检查 req.user.role 是否为 'admin'
 */
const requireAdmin = (req, res, next) => {
  // 此时 req.user 已由 requireAuth 填充
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足，需要管理员权限' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
