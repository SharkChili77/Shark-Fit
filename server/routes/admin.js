/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 管理员路由 (routes/admin.js)
 *
 * 所有路由都需要：requireAuth + requireAdmin 双重鉴权
 *
 * 路由清单：
 *   GET    /api/admin/users      获取所有注册用户列表
 *   DELETE /api/admin/users/:id  删除指定用户及其所有数据（级联删除）
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════════════
// 路由 1：获取所有用户列表
// GET /api/admin/users
// ═══════════════════════════════════════════════════════════════════════════

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  try {
    // 查询所有用户，注意 password_hash 列不返回给前端（安全）
    const users = db.prepare(`
      SELECT 
        u.id, u.email, u.role, u.username, u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM exercises WHERE user_id = u.id) as exercise_count,
        (SELECT COUNT(*) FROM workout_sets WHERE user_id = u.id) as record_count
      FROM users u
      ORDER BY u.created_at ASC
    `).all();

    res.json(users);
  } catch (err) {
    console.error('[admin/users GET 错误]', err.message);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 路由 2：删除用户（级联删除其所有数据）
// DELETE /api/admin/users/:id
// ═══════════════════════════════════════════════════════════════════════════

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const adminId = req.user.id; // 当前操作的管理员 ID

    // 安全限制：管理员不能删除自己
    if (targetUserId === adminId) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    // 查询目标用户是否存在
    const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 安全限制：不能删除其他管理员（避免误操作）
    if (targetUser.role === 'admin') {
      return res.status(403).json({ error: '不能删除管理员账号' });
    }

    // ── 使用事务进行级联删除（原子操作）──────────────────────────────────
    // 必须先删除子表数据，再删除主表数据（因为有外键约束）
    const deleteUserTransaction = db.transaction(() => {
      // 1. 删除该用户的所有打卡记录
      const deletedSets = db.prepare('DELETE FROM workout_sets WHERE user_id = ?').run(targetUserId);

      // 2. 删除该用户的所有体重记录
      const deletedBW = db.prepare('DELETE FROM body_weight WHERE user_id = ?').run(targetUserId);

      // 3. 删除该用户的所有动作
      const deletedEx = db.prepare('DELETE FROM exercises WHERE user_id = ?').run(targetUserId);

      // 4. 删除该用户的周计划
      const deletedRt = db.prepare('DELETE FROM routines WHERE user_id = ?').run(targetUserId);

      // 5. 🆕 强制清理该邮箱的所有验证码（无论是否使用过）
      //    这是解决“无法重新注册”的关键，因为旧的验证码记录可能会触发频率限制或校验错误
      const deletedCodes = db.prepare('DELETE FROM verification_codes WHERE email = ?').run(targetUser.email);

      // 6. 最后删除用户本身
      db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);

      console.log(`[admin] 🗑️ 用户 ${targetUser.email} 已被管理员彻底删除`);
      console.log(`  → 动作/记录/计划: 已清理`);
      console.log(`  → 验证码记录: 清理了 ${deletedCodes.changes} 条`);
      console.log(`  → 动作: ${deletedEx.changes} 条`);
      console.log(`  → 记录: ${deletedSets.changes} 条`);
      console.log(`  → 体重: ${deletedBW.changes} 条`);
      console.log(`  → 计划: ${deletedRt.changes} 条`);

      return {
        deletedSets: deletedSets.changes,
        deletedBW: deletedBW.changes,
        deletedEx: deletedEx.changes,
        deletedRt: deletedRt.changes,
      };
    });

    const result = deleteUserTransaction();

    res.json({
      success: true,
      message: `用户 ${targetUser.email} 及其所有数据已删除`,
      details: result,
    });

  } catch (err) {
    console.error('[admin/users DELETE 错误]', err.message);
    res.status(500).json({ error: '删除用户失败' });
  }
});

module.exports = router;
