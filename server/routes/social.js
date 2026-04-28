const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// 获取全系统最近的 PR 动态
router.get('/recent-prs', (req, res) => {
  try {
    // 获取当前用户 ID（如果已登录），用于判断点赞状态
    const currentUserId = req.query.current_user_id || 0;

    const prs = db.prepare(`
      SELECT 
        ws.id as pr_id,
        u.username,
        e.name as exerciseName,
        ws.weight,
        ws.reps,
        ws.created_at as date,
        (SELECT COUNT(*) FROM likes WHERE pr_id = ws.id) as likesCount,
        (SELECT COUNT(*) FROM likes WHERE pr_id = ws.id AND user_id = ?) as hasLiked
      FROM workout_sets ws
      JOIN users u ON ws.user_id = u.id
      JOIN exercises e ON ws.exerciseId = e.id
      WHERE u.is_public = 1 AND ws.isPR = 1
      ORDER BY ws.created_at DESC
      LIMIT 20
    `).all(currentUserId);

    const maskedPrs = prs.map(p => ({
      ...p,
      username: p.username ? (p.username.charAt(0) + '***' + (p.username.length > 1 ? p.username.slice(-1) : '')) : '匿名用户',
      likesCount: Number(p.likesCount || 0),
      hasLiked: Boolean(p.hasLiked)
    }));

    res.json(maskedPrs);
  } catch (error) {
    console.error('Social API Error:', error);
    res.status(500).json({ error: 'Failed to fetch social PRs' });
  }
});

// 点赞/取消点赞 切换操作
router.post('/like', requireAuth, (req, res) => {
  try {
    const { pr_id } = req.body;
    const userId = req.user.id;

    // 检查是否已经点过赞
    const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND pr_id = ?').get(userId, pr_id);
    
    if (existing) {
      // 如果已点赞，则执行取消
      db.prepare('DELETE FROM likes WHERE user_id = ? AND pr_id = ?').run(userId, pr_id);
      return res.json({ success: true, action: 'unliked' });
    } else {
      // 如果未点赞，则执行添加
      db.prepare('INSERT INTO likes (user_id, pr_id) VALUES (?, ?)').run(userId, pr_id);
      return res.json({ success: true, action: 'liked' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Action failed' });
  }
});

// 获取我的 PR 动态收到的点赞通知
router.get('/notifications', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = db.prepare(`
      SELECT 
        u.username as likerName,
        e.name as exerciseName,
        l.created_at
      FROM likes l
      JOIN workout_sets ws ON l.pr_id = ws.id
      JOIN users u ON l.user_id = u.id
      JOIN exercises e ON ws.exerciseId = e.id
      WHERE ws.user_id = ?
      ORDER BY l.created_at DESC
      LIMIT 50
    `).all(userId);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
