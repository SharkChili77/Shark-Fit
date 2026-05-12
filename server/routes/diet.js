/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - Diet Hub 饮食模块 API 路由 (routes/diet.js)
 *
 * 功能清单:
 *   [食物库]    GET    /api/foods        — 获取食物列表（支持模糊搜索）
 *   [食物库]    POST   /api/foods        — 新增自定义食物
 *   [饮食记录]  GET    /api/diet-logs    — 获取指定日期的饮食记录
 *   [饮食记录]  POST   /api/diet-logs    — 新增饮食记录
 *   [饮食记录]  PUT    /api/diet-logs/:id — 修改饮食记录
 *   [饮食记录]  DELETE /api/diet-logs/:id — 删除饮食记录
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');


// ═══════════════════════════════════════════════════════════════════════════
// 食物库 API  /api/foods
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/foods
 * 获取食物列表，支持模糊搜索
 * 
 * Query 参数:
 *   q — 搜索关键词（可选），对食物名称进行模糊匹配
 * 
 * 返回规则：
 *   - 系统默认食物（created_by = 'system'）对所有用户可见
 *   - 用户自定义食物（created_by = 用户ID）仅对创建者可见
 */
router.get('/foods', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    let sql, params;

    if (q && q.trim()) {
      // 模糊搜索：使用 LIKE + 通配符进行中文名匹配
      sql = `
        SELECT * FROM foods 
        WHERE (created_by = 'system' OR created_by = ?) 
          AND name LIKE ?
        ORDER BY 
          CASE WHEN created_by = ? THEN 0 ELSE 1 END,
          name ASC
      `;
      params = [String(userId), `%${q.trim()}%`, String(userId)];
    } else {
      // 无搜索词：返回全部可见食物
      sql = `
        SELECT * FROM foods 
        WHERE created_by = 'system' OR created_by = ?
        ORDER BY 
          CASE WHEN created_by = ? THEN 0 ELSE 1 END,
          name ASC
      `;
      params = [String(userId), String(userId)];
    }

    const foods = db.prepare(sql).all(...params);
    res.json(foods);
  } catch (err) {
    console.error('[错误] 获取食物列表失败:', err.message);
    res.status(500).json({ error: '获取食物列表失败' });
  }
});

/**
 * POST /api/foods
 * 新增自定义食物
 * created_by 自动填充为当前登录用户的 user_id
 */
router.post('/foods', requireAuth, validate(schemas.food), (req, res) => {
  try {
    const { name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g } = req.body;
    const userId = req.user.id;

    // 检查是否已存在同名食物（同一用户下）
    const existing = db.prepare(
      "SELECT id FROM foods WHERE name = ? AND created_by = ?"
    ).get(name, String(userId));

    if (existing) {
      return res.status(409).json({ error: '您已添加过同名食物' });
    }

    const result = db.prepare(`
      INSERT INTO foods (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, String(userId));

    const newFood = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newFood);
  } catch (err) {
    console.error('[错误] 新增自定义食物失败:', err.message);
    res.status(500).json({ error: '新增自定义食物失败' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 饮食记录 API  /api/diet-logs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/diet-logs
 * 获取指定日期的饮食记录
 * 
 * Query 参数:
 *   date — 日期（必须，YYYY-MM-DD 格式）
 * 
 * 返回值：JOIN foods 表，返回每条记录的完整食物营养信息
 */
router.get('/diet-logs', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: '缺少 date 参数' });
    }

    // 联表查询：diet_logs JOIN foods，返回完整的食物信息 + 记录信息
    const logs = db.prepare(`
      SELECT 
        dl.id,
        dl.user_id,
        dl.food_id,
        dl.meal_type,
        dl.weight_grams,
        dl.date,
        dl.created_at,
        f.name AS food_name,
        f.calories_per_100g,
        f.protein_per_100g,
        f.carbs_per_100g,
        f.fat_per_100g
      FROM diet_logs dl
      JOIN foods f ON dl.food_id = f.id
      WHERE dl.user_id = ? AND dl.date = ?
      ORDER BY dl.created_at ASC
    `).all(userId, date);

    res.json(logs);
  } catch (err) {
    console.error('[错误] 获取饮食记录失败:', err.message);
    res.status(500).json({ error: '获取饮食记录失败' });
  }
});

/**
 * POST /api/diet-logs
 * 新增饮食记录
 */
router.post('/diet-logs', requireAuth, validate(schemas.dietLog), (req, res) => {
  try {
    const { food_id, meal_type, weight_grams, date } = req.body;
    const userId = req.user.id;

    // 验证食物是否存在且用户有权使用
    const food = db.prepare(
      "SELECT * FROM foods WHERE id = ? AND (created_by = 'system' OR created_by = ?)"
    ).get(food_id, String(userId));

    if (!food) {
      return res.status(404).json({ error: '食物不存在或无权使用' });
    }

    const result = db.prepare(`
      INSERT INTO diet_logs (user_id, food_id, meal_type, weight_grams, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, food_id, meal_type, weight_grams, date);

    // 返回完整记录（含食物信息）
    const newLog = db.prepare(`
      SELECT 
        dl.id, dl.user_id, dl.food_id, dl.meal_type, dl.weight_grams, dl.date, dl.created_at,
        f.name AS food_name, f.calories_per_100g, f.protein_per_100g, f.carbs_per_100g, f.fat_per_100g
      FROM diet_logs dl
      JOIN foods f ON dl.food_id = f.id
      WHERE dl.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newLog);
  } catch (err) {
    console.error('[错误] 新增饮食记录失败:', err.message);
    res.status(500).json({ error: '新增饮食记录失败' });
  }
});

/**
 * PUT /api/diet-logs/:id
 * 修改饮食记录（仅允许修改重量和餐次类型）
 */
router.put('/diet-logs/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { weight_grams, meal_type } = req.body;

    // 验证记录归属权
    const existing = db.prepare(
      'SELECT * FROM diet_logs WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: '记录不存在或无权操作' });
    }

    const newWeight = weight_grams !== undefined ? weight_grams : existing.weight_grams;
    const newMealType = meal_type || existing.meal_type;

    db.prepare(
      'UPDATE diet_logs SET weight_grams = ?, meal_type = ? WHERE id = ? AND user_id = ?'
    ).run(newWeight, newMealType, id, userId);

    // 返回更新后的完整记录
    const updated = db.prepare(`
      SELECT 
        dl.id, dl.user_id, dl.food_id, dl.meal_type, dl.weight_grams, dl.date, dl.created_at,
        f.name AS food_name, f.calories_per_100g, f.protein_per_100g, f.carbs_per_100g, f.fat_per_100g
      FROM diet_logs dl
      JOIN foods f ON dl.food_id = f.id
      WHERE dl.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('[错误] 修改饮食记录失败:', err.message);
    res.status(500).json({ error: '修改饮食记录失败' });
  }
});

/**
 * DELETE /api/diet-logs/:id
 * 删除饮食记录
 */
router.delete('/diet-logs/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = db.prepare(
      'DELETE FROM diet_logs WHERE id = ? AND user_id = ?'
    ).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在或无权操作' });
    }

    res.json({ success: true, message: `饮食记录 ${id} 已删除` });
  } catch (err) {
    console.error('[错误] 删除饮食记录失败:', err.message);
    res.status(500).json({ error: '删除饮食记录失败' });
  }
});

module.exports = router;
