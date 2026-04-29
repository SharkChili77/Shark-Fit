/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FinFit - Zod 请求校验中间件 (middleware/validate.js)
 *
 * 提供通用的校验中间件工厂和各业务的 Schema 定义。
 * 用法：
 *   const { validate, schemas } = require('./middleware/validate');
 *   app.post('/api/exercises', requireAuth, validate(schemas.exercise), handler);
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { z } = require('zod');

// ─── 通用校验中间件工厂 ──────────────────────────────────────────────────────

/**
 * 创建一个 Express 中间件，用 Zod schema 校验 req.body
 * 校验通过后将解析后的数据回写到 req.body（自动 trim/类型转换）
 * 校验失败返回 400 + 详细错误信息
 */
const validate = (schema) => (req, res, next) => {
  try {
    // parse 会自动做类型转换和默认值填充
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      // 提取每个字段的错误消息，格式化为用户友好的文字
      const messages = err.errors.map(e => {
        const field = e.path.join('.');
        return `${field}: ${e.message}`;
      });
      return res.status(400).json({
        error: '请求数据校验失败',
        details: messages,
      });
    }
    // 非 Zod 错误则透传
    next(err);
  }
};

// ─── 业务 Schema 定义 ────────────────────────────────────────────────────────

const schemas = {

  /** 新增动作 */
  exercise: z.object({
    name: z.string().min(1, '动作名称不能为空').max(50, '动作名称过长'),
    target: z.string().min(1, '目标肌群不能为空').max(20, '肌群名称过长'),
    sets: z.number().int().min(1).max(20).default(4),
    reps: z.string().max(20).default('8-12'),
    rest: z.number().int().min(0).max(600).default(60),
    imageUrl: z.string().max(500).default(''),
    notes: z.string().max(1000).default(''),
  }),

  /** 修改动作（所有字段可选） */
  exerciseUpdate: z.object({
    name: z.string().min(1).max(50).optional(),
    target: z.string().min(1).max(20).optional(),
    sets: z.number().int().min(1).max(20).optional(),
    reps: z.string().max(20).optional(),
    rest: z.number().int().min(0).max(600).optional(),
    imageUrl: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  }),

  /** 新增打卡记录 */
  record: z.object({
    exerciseId: z.string().min(1, '动作 ID 不能为空'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD'),
    weight: z.number().min(0, '重量不能为负数').max(1000, '重量超出合理范围'),
    reps: z.number().int().min(0, '次数不能为负数').max(200, '次数超出合理范围'),
  }),

  /** 记录体重 */
  bodyWeight: z.object({
    weight: z.number().min(20, '体重值异常（太小）').max(300, '体重值异常（太大）'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD'),
  }),

  /** 更新周计划 */
  routineUpdate: z.object({
    name: z.string().min(1).max(30).optional(),
    exerciseIds: z.array(z.string()).optional(),
  }),
};

module.exports = { validate, schemas };
