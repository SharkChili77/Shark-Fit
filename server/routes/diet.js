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
 * POST /api/foods/:id/toggle-favorite
 * 切换食物收藏状态
 */
router.post('/foods/:id/toggle-favorite', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const food = db.prepare('SELECT is_favorite, created_by FROM foods WHERE id = ?').get(id);
    if (!food) return res.status(404).json({ error: '食物不存在' });
    
    // 如果是系统食物，先复制一份给用户（可选逻辑，但为了让用户能完全修改，建议复制）
    // 不过用户说“取消系统内置模块”，意味着以后可能没系统食物了。
    // 这里简单处理：直接更新状态
    const newStatus = food.is_favorite ? 0 : 1;
    db.prepare('UPDATE foods SET is_favorite = ? WHERE id = ?').run(newStatus, id);

    res.json({ success: true, is_favorite: !!newStatus });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

/**
 * PUT /api/foods/:id
 * 修改食物信息
 */
router.put('/foods/:id', requireAuth, validate(schemas.food), (req, res) => {
  try {
    const { id } = req.params;
    const { name, base_weight, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g } = req.body;
    const userId = req.user.id;

    const food = db.prepare('SELECT created_by FROM foods WHERE id = ?').get(id);
    if (!food) return res.status(404).json({ error: '食物不存在' });
    if (food.created_by !== 'system' && food.created_by !== String(userId)) {
      return res.status(403).json({ error: '无权修改此食物' });
    }

    db.prepare(`
      UPDATE foods 
      SET name = ?, base_weight = ?, calories_per_100g = ?, protein_per_100g = ?, carbs_per_100g = ?, fat_per_100g = ?
      WHERE id = ?
    `).run(name, base_weight || 100, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, id);

    const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * GET /api/diet/recommendations
 * 获取智能推荐食物（昨日同时间段 + 收藏）
 */
router.get('/diet/recommendations', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { meal_type } = req.query;

    // 获取昨日日期
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 1. 获取昨日同餐次食物
    const yesterdayFoods = db.prepare(`
      SELECT f.*, 'yesterday' as reason
      FROM diet_logs dl
      JOIN foods f ON dl.food_id = f.id
      WHERE dl.user_id = ? AND dl.date = ? AND dl.meal_type = ?
    `).all(userId, yesterdayStr, meal_type || 'breakfast');

    // 2. 获取收藏食物
    const favoriteFoods = db.prepare(`
      SELECT *, 'favorite' as reason
      FROM foods
      WHERE (created_by = 'system' OR created_by = ?) AND is_favorite = 1
    `).all(String(userId));

    // 合并并去重
    const combined = [...yesterdayFoods, ...favoriteFoods];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: '获取推荐失败' });
  }
});

/**
 * POST /api/foods
 * 新增自定义食物
 * created_by 自动填充为当前登录用户的 user_id
 */
router.post('/foods', requireAuth, validate(schemas.food), (req, res) => {
  try {
    const { name, base_weight, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g } = req.body;
    const userId = req.user.id;

    // 检查是否已存在同名食物（同一用户下）
    const existing = db.prepare(
      "SELECT id FROM foods WHERE name = ? AND created_by = ?"
    ).get(name, String(userId));

    if (existing) {
      return res.status(409).json({ error: '您已添加过同名食物' });
    }

    const result = db.prepare(`
      INSERT INTO foods (name, base_weight, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, base_weight || 100, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, String(userId));

    const newFood = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newFood);
  } catch (err) {
    console.error('[错误] 新增自定义食物失败:', err.message);
    res.status(500).json({ error: '新增自定义食物失败' });
  }
});

/**
 * DELETE /api/foods/:id
 * 删除自定义食物
 */
router.delete('/foods/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 系统食物不可删除
    const food = db.prepare('SELECT created_by FROM foods WHERE id = ?').get(id);
    if (!food) return res.status(404).json({ error: '食物不存在' });
    if (food.created_by === 'system') return res.status(403).json({ error: '系统内置食物不可删除' });
    if (food.created_by !== String(userId)) return res.status(403).json({ error: '无权操作此食物' });

    db.prepare('DELETE FROM foods WHERE id = ? AND created_by = ?').run(id, String(userId));
    res.json({ success: true, message: '食物已删除' });
  } catch (err) {
    console.error('[错误] 删除食物失败:', err.message);
    res.status(500).json({ error: '删除食物失败' });
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

    // 🆕 自动清理逻辑：删除超过 15 天的旧数据
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const cleanupDate = fifteenDaysAgo.toISOString().split('T')[0];
    db.prepare('DELETE FROM diet_logs WHERE user_id = ? AND date < ?').run(userId, cleanupDate);

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

/**
 * GET /api/diet/history
 * 获取最近 15 天的饮食概览（用于历史回顾）
 */
router.get('/diet/history', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const history = db.prepare(`
      SELECT 
        dl.date,
        SUM(f.calories_per_100g * dl.weight_grams / f.base_weight) as total_calories,
        COUNT(*) as item_count
      FROM diet_logs dl
      JOIN foods f ON dl.food_id = f.id
      WHERE dl.user_id = ?
      GROUP BY dl.date
      ORDER BY dl.date DESC
      LIMIT 15
    `).all(userId);

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: '获取历史记录失败' });
  }
});


const { searchExternalFood } = require('../utils/nutritionSearch');

/**
 * GET /api/foods/search-external
 * 智能搜索外部食物数据（联网搜索）
 * 返回每 100g 的营养成分数据
 */
router.get('/foods/search-external', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: '缺少搜索关键词' });

    const name = q.trim();

    // 1. 首先尝试联网搜索 (薄荷健康)
    const externalData = await searchExternalFood(name);
    
    if (externalData && externalData.calories_per_100g > 0) {
      return res.json({
        success: true,
        source: 'web_boohee',
        data: externalData
      });
    }

    // 2. 如果联网搜索失败，回退到高质量内部精选库
    const NUTRITION_DB = [
      { name: '鸡胸肉', calories: 133, protein: 30.2, carbs: 0, fat: 1.3 },
      { name: '牛肉(瘦)', calories: 155, protein: 20.2, carbs: 0, fat: 8.2 },
      { name: '鸡蛋', calories: 155, protein: 13, carbs: 1.1, fat: 11 },
      { name: '米饭', calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
      { name: '西兰花', calories: 34, protein: 4.1, carbs: 6.6, fat: 0.6 },
      // ... 更多项可以在这里扩充
    ];

    let match = NUTRITION_DB.find(f => f.name === name);
    if (!match) {
      match = NUTRITION_DB.find(f => name.includes(f.name) || f.name.includes(name));
    }

    if (match) {
      return res.json({
        success: true,
        source: 'internal_knowledge_base',
        data: {
          name: match.name,
          calories_per_100g: match.calories,
          protein_per_100g: match.protein,
          carbs_per_100g: match.carbs,
          fat_per_100g: match.fat,
          base_weight: 100
        }
      });
    }

    res.status(404).json({ error: '未找到该食物的营养数据，请手动填写' });
  } catch (err) {
    console.error('[搜索路由错误]', err);
    res.status(500).json({ error: '搜索失败' });
  }
});

module.exports = router;
