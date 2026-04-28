const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置二维码存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `contact_qr_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// ── 路由 1：获取联系方式（公开） ──────────────────────────────────────────────
router.get('/contact', (req, res) => {
  try {
    const configs = db.prepare(`SELECT * FROM system_config WHERE [key] IN ('contact_wechat', 'contact_email', 'contact_qr')`).all();
    const result = {
      wechat: configs.find(c => c.key === 'contact_wechat')?.value || '',
      email: configs.find(c => c.key === 'contact_email')?.value || '',
      qr: configs.find(c => c.key === 'contact_qr')?.value || ''
    };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '获取联系方式失败' });
  }
});

// ── 路由 2：更新联系方式（仅限管理员） ──────────────────────────────────────────
router.post('/contact', requireAuth, requireAdmin, upload.single('qr_file'), (req, res) => {
  try {
    const { wechat, email } = req.body;

    // 更新文本信息 (增加非 "undefined" 校验)
    if (wechat !== undefined && wechat !== 'undefined') {
      db.prepare('INSERT OR REPLACE INTO system_config ([key], value) VALUES (?, ?)').run('contact_wechat', wechat);
    }
    if (email !== undefined && email !== 'undefined') {
      db.prepare('INSERT OR REPLACE INTO system_config ([key], value) VALUES (?, ?)').run('contact_email', email);
    }

    // 更新二维码图片
    if (req.file) {
      const qrUrl = `/uploads/${req.file.filename}`;
      db.prepare('INSERT OR REPLACE INTO system_config ([key], value) VALUES (?, ?)').run('contact_qr', qrUrl);
    }

    res.json({ success: true, message: '系统配置更新成功' });
  } catch (err) {
    console.error('[System Config Error]', err.message);
    res.status(500).json({ error: '更新配置失败' });
  }
});

module.exports = router;
