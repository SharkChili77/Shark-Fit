/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - Diet Hub 饮食追踪 Store (useDietStore.js)
 *
 * 职责：
 *   1. 管理食物搜索列表和当日饮食记录
 *   2. 封装所有饮食相关的 API 调用
 *   3. 动态营养目标计算引擎（基于体重 + 训练日类型）
 *   4. 持久化用户设定的预设体重
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 【核心算法说明 - 给初学者的超详细注释】
 *
 * 1. 宏量营养素 (Macronutrients) 的能量换算公式：
 *    - 蛋白质 (Protein):  1 克 = 4 千卡 (kcal)
 *    - 碳水化合物 (Carbs): 1 克 = 4 千卡 (kcal)
 *    - 脂肪 (Fat):        1 克 = 9 千卡 (kcal)
 *
 * 2. 每日营养目标的计算方式（基于体重的动态乘数）：
 *    - 蛋白质目标 = 体重(kg) × 2 (克)      → 不管训练不训练，固定乘数
 *    - 脂肪目标   = 体重(kg) × 0.8 (克)    → 不管训练不训练，固定乘数
 *    - 碳水目标   = 体重(kg) × 动态乘数 (克) → 根据训练日类型变化：
 *        · 休息日:   × 1.2
 *        · 普通训练日: × 2.5
 *        · 练腿日:   × 3.5
 *
 * 3. 每日总热量目标 = 蛋白质目标×4 + 碳水目标×4 + 脂肪目标×9
 *
 * 4. 单条食物的实际营养计算：
 *    实际营养 = (摄入克数 / 100) × 该食物每百克营养值
 *    例如: 吃了 150g 鸡胸肉（每百克蛋白质 31g）
 *         → 实际蛋白质 = (150 / 100) × 31 = 46.5g
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── API 请求工具（与 useFitnessStore 保持一致的封装方式）────────────────────

const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const { hostname, protocol, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3001`;
  }
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * 封装 fetch 请求，自动附加 JWT Token
 * 和 useFitnessStore 中的 apiRequest 逻辑完全一致
 */
const apiRequest = async (path, options = {}) => {
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}${path}`;
    const token = localStorage.getItem('sharkfit_token');

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      console.warn('[Diet API] Token 已过期');
      localStorage.removeItem('sharkfit_token');
      localStorage.removeItem('sharkfit_user');
      window.location.href = '/login';
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Diet API 错误] ${options.method || 'GET'} ${path}:`, errorData);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn(`[Diet API 离线] ${path}:`, err.message);
    return null;
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// 营养目标计算引擎 — 纯函数（可独立测试）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 计算每日宏量营养素目标
 *
 * @param {number} bodyWeight - 用户体重（千克），例如 63.8
 * @param {string} dayType   - 训练日类型: 'rest' | 'normal' | 'leg'
 * @returns {object} 目标对象: { protein, carbs, fat, calories }
 *
 * 【计算步骤详解】
 *
 * 步骤 1: 确定碳水乘数
 *   - dayType === 'rest'   → carbsMultiplier = 1.2  （休息日，低碳水）
 *   - dayType === 'normal' → carbsMultiplier = 2.5  （普通训练日，中等碳水）
 *   - dayType === 'leg'    → carbsMultiplier = 3.5  （练腿日，高碳水，因为腿部训练消耗巨大）
 *
 * 步骤 2: 计算三大项的克数目标
 *   - proteinTarget = bodyWeight × 2
 *   - carbsTarget   = bodyWeight × carbsMultiplier
 *   - fatTarget     = bodyWeight × 0.8
 *
 * 步骤 3: 转换为总热量
 *   - caloriesTarget = proteinTarget × 4 + carbsTarget × 4 + fatTarget × 9
 *   （蛋白质和碳水每克 4 千卡，脂肪每克 9 千卡）
 */
export const calculateDailyTargets = (bodyWeight, dayType, carbsMultipliers = { rest: 1.2, normal: 2.5, leg: 3.5 }, customTargets = {}) => {
  // ── 步骤 1: 确定碳水化合物的动态乘数 ──
  // 从用户自定义配置中读取（如果未传则用默认）
  const carbsMultiplier = carbsMultipliers[dayType] || 1.2;

  // ── 步骤 2: 计算三大营养素目标（单位：克）──
  // 如果用户设置了强制的营养素目标，则直接使用；否则使用体重动态计算
  const proteinTarget = customTargets.protein ? Math.round(customTargets.protein) : Math.round(bodyWeight * 2);
  const carbsTarget = customTargets.carbs ? Math.round(customTargets.carbs) : Math.round(bodyWeight * carbsMultiplier);
  const fatTarget = customTargets.fat ? Math.round(customTargets.fat) : Math.round(bodyWeight * 0.8);

  // ── 步骤 3: 强制按照 4-4-9 公式自动计算总热量目标 ──
  // 无论如何设置，总热量永远根据目标营养素自动计算浮动
  const caloriesTarget = proteinTarget * 4 + carbsTarget * 4 + fatTarget * 9;

  return {
    protein: proteinTarget,   // 蛋白质目标（克）
    carbs: carbsTarget,       // 碳水目标（克）
    fat: fatTarget,           // 脂肪目标（克）
    calories: caloriesTarget, // 总热量目标（千卡）
  };
};

/**
 * 根据当天的训练计划自动判定训练日类型
 *
 * @param {Array} todayExercises - 今天计划中的动作数组，每个元素需要有 target 属性
 * @returns {string} 'rest' | 'leg' | 'normal'
 *
 * 判定逻辑：
 *   1. 如果今天没有安排任何动作 → 休息日 ('rest')
 *   2. 如果今天的动作中有 target 包含 "腿" → 练腿日 ('leg')
 *   3. 其他情况 → 普通训练日 ('normal')
 */
export const detectDayType = (todayExercises) => {
  // 没有动作 = 休息日
  if (!todayExercises || todayExercises.length === 0) {
    return 'rest';
  }

  // 检查是否有腿部训练动作
  // Array.some() 会遍历数组，只要有一个元素满足条件就返回 true
  const hasLegExercise = todayExercises.some(ex =>
    ex.target && ex.target.includes('腿')
  );

  return hasLegExercise ? 'leg' : 'normal';
};

/**
 * 计算单条饮食记录的实际营养摄入
 *
 * @param {object} log - 饮食记录对象，需要包含以下属性：
 *   - weight_grams: 实际摄入克数（比如吃了 150 克）
 *   - calories_per_100g: 该食物每 100 克的热量
 *   - protein_per_100g:  该食物每 100 克的蛋白质
 *   - carbs_per_100g:    该食物每 100 克的碳水
 *   - fat_per_100g:      该食物每 100 克的脂肪
 * @returns {object} { calories, protein, carbs, fat }
 *
 * 【核心公式】
 * 实际值 = (实际摄入克数 / 100) × 每百克营养值
 *
 * 举例：吃了 200g 鸡胸肉（每百克含 31g 蛋白质）
 *   → 实际蛋白质 = (200 / 100) × 31 = 62g
 *   → 倍率就是 200/100 = 2 倍
 *   → 所以吃了 2 份（每份 100g），蛋白质自然也是 2 倍
 */
export const calculateNutrition = (log) => {
  // 计算倍率：实际摄入克数相对于基准重量的比例
  const baseWeight = log.base_weight || 100;
  const ratio = (log.weight_grams || 0) / baseWeight;

  const protein = parseFloat(((log.protein_per_100g || 0) * ratio).toFixed(1));
  const carbs = parseFloat(((log.carbs_per_100g || 0) * ratio).toFixed(1));
  const fat = parseFloat(((log.fat_per_100g || 0) * ratio).toFixed(1));
  
  // 每日已摄入热量要能够根据已填写的食物营养物质进行动态浮动
  const calories = parseFloat((protein * 4 + carbs * 4 + fat * 9).toFixed(1));

  return {
    calories,
    protein,
    carbs,
    fat,
  };
};


// ═══════════════════════════════════════════════════════════════════════════
// Zustand Store
// ═══════════════════════════════════════════════════════════════════════════

const useDietStore = create(
  persist(
    (set, get) => ({
      // ── 持久化状态 ─────────────────────────────────────────────────────
      presetBodyWeight: 63.8,        // 预设体重（千克），默认 63.8
      dayTypeOverride: null,         // 用户手动覆盖的训练日类型（null = 自动检测）
      carbsMultipliers: {            // 碳水乘数配置
        rest: 1.2,
        normal: 2.5,
        leg: 3.5
      },
      customTargets: {               // 用户覆盖的营养素目标
        calories: null,
        protein: null,
        carbs: null,
        fat: null
      },

      // ── 运行时状态（不持久化）────────────────────────────────────────────
      foods: [],                     // 食物搜索结果列表
      dietLogs: [],                  // 当日饮食记录
      isLoadingFoods: false,         // 食物列表加载状态
      isLoadingLogs: false,          // 饮食记录加载状态

      // ── 基础设置更新 ───────────────────────────────────────────────────
      setPresetBodyWeight: (weight) => {
        set({ presetBodyWeight: weight });
      },

      setDayTypeOverride: (type) => {
        set({ dayTypeOverride: type });
      },

      setCarbsMultipliers: (multipliers) => {
        set({ carbsMultipliers: multipliers });
      },

      setCustomTargets: (targets) => {
        set({ customTargets: targets });
      },

      // ── 食物库 API ─────────────────────────────────────────────────────

      /**
       * 搜索食物列表
       * @param {string} query - 搜索关键词（空字符串 = 返回全部）
       */
      searchFoods: async (query = '') => {
        set({ isLoadingFoods: true });
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        const data = await apiRequest(`/api/foods${params}`);
        if (data) {
          set({ foods: data });
        }
        set({ isLoadingFoods: false });
      },

      /**
       * 新增自定义食物
       * @param {object} foodData - { name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g }
       * @returns {object|null} 新增成功返回食物对象，失败返回 null
       */
      addCustomFood: async (foodData) => {
        const result = await apiRequest('/api/foods', {
          method: 'POST',
          body: JSON.stringify(foodData),
        });

        if (result) {
          // 将新食物添加到列表顶部（用户自定义的优先显示）
          set({ foods: [result, ...get().foods] });
        }

        return result;
      },

      /**
       * 删除自定义食物
       * @param {number} foodId - 食物 ID
       */
      deleteFood: async (foodId) => {
        // 乐观更新
        set({ foods: get().foods.filter(f => f.id !== foodId) });

        const result = await apiRequest(`/api/foods/${foodId}`, {
          method: 'DELETE',
        });

        // 如果删除失败，重新获取列表
        if (!result) {
          get().searchFoods('');
        }
        return result;
      },

      /**
       * 切换食物收藏状态
       */
      toggleFavorite: async (foodId) => {
        const result = await apiRequest(`/api/foods/${foodId}/toggle-favorite`, {
          method: 'POST',
        });
        if (result) {
          set({
            foods: get().foods.map(f => f.id === foodId ? { ...f, is_favorite: result.is_favorite ? 1 : 0 } : f)
          });
        }
        return result;
      },

      /**
       * 更新食物信息
       */
      updateFood: async (foodId, foodData) => {
        const result = await apiRequest(`/api/foods/${foodId}`, {
          method: 'PUT',
          body: JSON.stringify(foodData),
        });
        if (result) {
          set({
            foods: get().foods.map(f => f.id === foodId ? result : f)
          });
        }
        return result;
      },

      /**
       * 获取智能推荐食物
       */
      fetchRecommendations: async (mealType) => {
        const result = await apiRequest(`/api/diet/recommendations?meal_type=${mealType}`);
        return result || [];
      },

      /**
       * 获取最近 15 天饮食历史概览
       */
      fetchDietHistory: async () => {
        const result = await apiRequest('/api/diet/history');
        return result || [];
      },

      /**
       * 联网搜索外部食物数据
       * @param {string} name - 食物名称
       * @returns {object|null}
       */
      searchExternalFood: async (name) => {
        if (!name) return null;
        const result = await apiRequest(`/api/foods/search-external?q=${encodeURIComponent(name)}`);
        return result;
      },

      // ── 饮食记录 API ───────────────────────────────────────────────────

      /**
       * 获取指定日期的饮食记录
       * @param {string} date - 日期字符串 YYYY-MM-DD
       */
      fetchDietLogs: async (date) => {
        set({ isLoadingLogs: true });
        const data = await apiRequest(`/api/diet-logs?date=${date}`);
        if (data) {
          set({ dietLogs: data });
        }
        set({ isLoadingLogs: false });
      },

      /**
       * 新增饮食记录
       * @param {object} logData - { food_id, meal_type, weight_grams, date }
       * @returns {object|null}
       */
      addDietLog: async (logData) => {
        const result = await apiRequest('/api/diet-logs', {
          method: 'POST',
          body: JSON.stringify(logData),
        });

        if (result) {
          // 乐观更新：将新记录追加到列表
          set({ dietLogs: [...get().dietLogs, result] });
        }

        return result;
      },

      /**
       * 修改饮食记录（重量）
       */
      updateDietLog: async (logId, weight_grams) => {
        const result = await apiRequest(`/api/diet-logs/${logId}`, {
          method: 'PUT',
          body: JSON.stringify({ weight_grams }),
        });

        if (result) {
          // 乐观更新：修改列表中对应记录的数据
          set({
            dietLogs: get().dietLogs.map((l) => (l.id === logId ? result : l)),
          });
        }
        return result;
      },

      /**
       * 删除饮食记录
       */
      deleteDietLog: async (logId) => {
        // 乐观更新：先从本地列表移除
        set({ dietLogs: get().dietLogs.filter(l => l.id !== logId) });

        const result = await apiRequest(`/api/diet-logs/${logId}`, {
          method: 'DELETE',
        });

        // 如果后端删除失败，重新拉取数据
        if (!result) {
          const { dietLogs } = get();
          const date = dietLogs[0]?.date;
          if (date) get().fetchDietLogs(date);
        }
      },

      /**
       * 计算当日总摄入量
       * 遍历所有饮食记录，累加每条记录的实际营养摄入
       *
       * @returns {object} { calories, protein, carbs, fat }
       */
      getTotalIntake: () => {
        const { dietLogs } = get();

        // 初始值：所有营养素从 0 开始累加
        const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };

        for (const log of dietLogs) {
          // 对每条饮食记录，调用 calculateNutrition 计算实际营养值
          const nutrition = calculateNutrition(log);
          // 累加到总量
          total.calories += nutrition.calories;
          total.protein += nutrition.protein;
          total.carbs += nutrition.carbs;
          total.fat += nutrition.fat;
        }

        // 四舍五入到一位小数
        total.calories = parseFloat(total.calories.toFixed(1));
        total.protein = parseFloat(total.protein.toFixed(1));
        total.carbs = parseFloat(total.carbs.toFixed(1));
        total.fat = parseFloat(total.fat.toFixed(1));

        return total;
      },
    }),
    {
      name: 'diet-hub-storage',  // localStorage key
      // 只持久化用户设定，不持久化运行时的列表数据
      partialize: (state) => ({
        presetBodyWeight: state.presetBodyWeight,
        dayTypeOverride: state.dayTypeOverride,
        carbsMultipliers: state.carbsMultipliers,
        customTargets: state.customTargets,
      }),
    }
  )
);

export default useDietStore;
