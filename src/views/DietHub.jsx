/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DietHub - 实时热量与营养物质计算中心
 *
 * 核心模块功能：
 *   1. 顶部四个环形进度条看板（卡路里、蛋白质、碳水、脂肪）
 *   2. 训练日类型切换器（自动检测 + 手动覆盖）
 *   3. 四个餐食区块（早餐/午餐/晚餐/加餐）
 *   4. 食物搜索录入弹窗
 *   5. 动态营养目标引擎（基于体重 + 训练日类型）
 *
 * 数据流：
 *   useDietStore (API + 计算) → DietHub (展示) → FoodSearchModal (录入)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Beef, Wheat, Droplet, Plus, Trash2, Sun, Moon, Coffee,
  Cookie, Dumbbell, BedDouble, Zap, Settings2, ChevronDown, X, Pencil, BookOpen, UtensilsCrossed, History, RefreshCw
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import CircularProgress from '../components/CircularProgress';
import FoodSearchModal from '../components/FoodSearchModal';
import EditWeightModal from '../components/EditWeightModal';
import useDietStore, {
  calculateDailyTargets,
  detectDayType,
  calculateNutrition,
} from '../store/useDietStore';
import useFitnessStore from '../store/useFitnessStore';
import { getDayOfWeek, getTodayDateString } from '../utils/dateUtils';

// ── 餐次配置 ─────────────────────────────────────────────────────────────
const MEAL_CONFIG = [
  { key: 'breakfast', label: '早餐', icon: Sun,    color: 'text-amber-400',  bg: 'bg-amber-500/5',  border: 'border-amber-500/10', glow: '#f59e0b' },
  { key: 'lunch',     label: '午餐', icon: Flame,  color: 'text-orange-400', bg: 'bg-orange-500/5', border: 'border-orange-500/10', glow: '#f97316' },
  { key: 'dinner',    label: '晚餐', icon: Moon,   color: 'text-indigo-400', bg: 'bg-indigo-500/5', border: 'border-indigo-500/10', glow: '#818cf8' },
  { key: 'snack',     label: '加餐', icon: Cookie, color: 'text-pink-400',   bg: 'bg-pink-500/5',   border: 'border-pink-500/10', glow: '#ec4899' },
];

const DietHub = () => {
  const todayStr = getTodayDateString();
  const dayOfWeek = getDayOfWeek();
  const navigate = useNavigate();

  // ── Store 数据 ─────────────────────────────────────────────────────────
  const {
    presetBodyWeight, dayTypeOverride, setDayTypeOverride, setPresetBodyWeight,
    carbsMultipliers, setCarbsMultipliers, customTargets, setCustomTargets,
    dietLogs, fetchDietLogs, isLoadingLogs, deleteDietLog, getTotalIntake,
    fetchRecommendations, addDietLog, fetchDietHistory
  } = useDietStore();

  const { routines, exercises, setModalOpen } = useFitnessStore();

  // ── 弹窗状态 ──────────────────────────────────────────────────────────
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState('breakfast');
  const [showDayTypeSelector, setShowDayTypeSelector] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [mealDetailOpen, setMealDetailOpen] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dietHistory, setDietHistory] = useState([]);

  // 设置中心状态
  const [showSettings, setShowSettings] = useState(false);
  const [tempWeight, setTempWeight] = useState(String(presetBodyWeight));
  const [tempTargets, setTempTargets] = useState({ 
    protein: customTargets?.protein ? String(customTargets.protein) : '', 
    carbs: customTargets?.carbs ? String(customTargets.carbs) : '', 
    fat: customTargets?.fat ? String(customTargets.fat) : '' 
  });
  const [tempCarbs, setTempCarbs] = useState({ 
    rest: String(carbsMultipliers.rest), 
    normal: String(carbsMultipliers.normal), 
    leg: String(carbsMultipliers.leg) 
  });

  // ── 监听明细开启，获取推荐 ──
  useEffect(() => {
    if (mealDetailOpen) {
      const loadRecs = async () => {
        const recs = await fetchRecommendations(mealDetailOpen);
        setRecommendations(recs);
      };
      loadRecs();
    }
  }, [mealDetailOpen, fetchRecommendations]);

  // ── 监听历史开启 ──
  useEffect(() => {
    if (showHistory) {
      const loadHistory = async () => {
        const history = await fetchDietHistory();
        setDietHistory(history);
      };
      loadHistory();
    }
  }, [showHistory, fetchDietHistory]);

  // ── 加载当日饮食记录 ──────────────────────────────────────────────────
  useEffect(() => {
    fetchDietLogs(todayStr);
  }, [todayStr, fetchDietLogs]);

  // 打开设置
  const openSettings = () => {
    setTempWeight(String(presetBodyWeight));
    setTempTargets({
      protein: customTargets?.protein ? String(customTargets.protein) : '',
      carbs: customTargets?.carbs ? String(customTargets.carbs) : '',
      fat: customTargets?.fat ? String(customTargets.fat) : '',
    });
    setTempCarbs({
      rest: String(carbsMultipliers.rest),
      normal: String(carbsMultipliers.normal),
      leg: String(carbsMultipliers.leg),
    });
    setShowSettings(true);
  };

  // 打开食物搜索弹窗
  const openFoodSearch = (mealType) => {
    setActiveMealType(mealType);
    setSearchModalOpen(true);
    setModalOpen(true);
  };

  // 关闭食物搜索弹窗
  const closeFoodSearch = () => {
    setSearchModalOpen(false);
    setModalOpen(false);
    fetchDietLogs(todayStr);
  };

  // 删除饮食记录
  const handleDeleteLog = (logId) => {
    deleteDietLog(logId);
  };

  // ── 训练日类型动态配置 ────────────────────────────────────────────────
  const dynamicDayTypes = useMemo(() => [
    { key: 'rest',   label: '休息日',   icon: BedDouble, desc: `碳水 × ${carbsMultipliers?.rest || 1.2}`, color: 'text-blue-400',   bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { key: 'normal', label: '训练日',   icon: Dumbbell,  desc: `碳水 × ${carbsMultipliers?.normal || 2.5}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { key: 'leg',    label: '练腿日',   icon: Zap,       desc: `碳水 × ${carbsMultipliers?.leg || 3.5}`, color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  ], [carbsMultipliers]);

  // ── 训练日类型自动检测 ─────────────────────────────────────────────────
  const todayRoutine = useMemo(
    () => routines.find(r => r.dayOfWeek === dayOfWeek),
    [routines, dayOfWeek]
  );

  const todayExercises = useMemo(() => {
    if (!todayRoutine) return [];
    return todayRoutine.exerciseIds
      .map(id => exercises.find(e => e.id === id))
      .filter(Boolean);
  }, [todayRoutine, exercises]);

  const autoDetectedDayType = useMemo(
    () => detectDayType(todayExercises),
    [todayExercises]
  );

  const activeDayType = dayTypeOverride || autoDetectedDayType;
  const activeDayConfig = dynamicDayTypes.find(d => d.key === activeDayType);

  // ── 计算每日营养目标 ──────────────────────────────────────────────────
  const targets = useMemo(
    () => calculateDailyTargets(presetBodyWeight, activeDayType, carbsMultipliers, customTargets),
    [presetBodyWeight, activeDayType, carbsMultipliers, customTargets]
  );

  // ── 计算当日总摄入 ────────────────────────────────────────────────────
  const totalIntake = useMemo(() => getTotalIntake(), [dietLogs, getTotalIntake]);

  // ── 按餐次分组饮食记录 ────────────────────────────────────────────────
  const mealGroups = useMemo(() => {
    const groups = {};
    MEAL_CONFIG.forEach(m => { groups[m.key] = []; });
    dietLogs.forEach(log => {
      if (groups[log.meal_type]) {
        groups[log.meal_type].push(log);
      }
    });
    return groups;
  }, [dietLogs]);

  // ── 基于当前时间自动检测餐食类型 ──────────────────────────────────────
  const currentMealType = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 14) return 'lunch';
    if (hour >= 14 && hour < 20) return 'dinner';
    return 'snack';
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-32"
    >
      {/* ═══════ 1. 顶部标题区 ═══════ */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter italic">DIET HUB</h1>
          <p className="text-[10px] text-neutral-500 font-bold">{todayStr}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* 历史记录按钮 */}
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-white/5 rounded-xl
                       active:scale-95 transition-all text-neutral-400 hover:text-white"
          >
            <History size={14} />
          </button>
          {/* 食物库按钮 */}
          <button
            onClick={() => navigate('/food-library')}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-white/5 rounded-xl
                       active:scale-95 transition-all text-neutral-400 hover:text-emerald-500 hover:border-emerald-500/30"
          >
            <BookOpen size={14} />
            <span className="text-xs font-black">食物库</span>
          </button>

          {/* 设置按钮 */}
          <button
            onClick={openSettings}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-white/5 rounded-xl
                       active:scale-95 transition-all"
          >
            <Settings2 size={14} className="text-primary" />
            <span className="text-sm font-black text-white">
              {presetBodyWeight}<span className="text-[10px] text-neutral-500 ml-0.5">kg</span>
            </span>
          </button>
        </div>
      </div>

      {/* ═══════ 2. 训练日类型切换器 ═══════ */}
      <div className="mb-5">
        <button
          onClick={() => setShowDayTypeSelector(!showDayTypeSelector)}
          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
            activeDayConfig?.bg} ${activeDayConfig?.border}`}
        >
          <div className="flex items-center gap-3">
            {activeDayConfig && <activeDayConfig.icon size={18} className={activeDayConfig.color} />}
            <div className="text-left">
              <div className="text-sm font-black text-white flex items-center gap-2">
                {activeDayConfig?.label}
                {dayTypeOverride && (
                  <span className="text-[8px] bg-white/10 text-neutral-400 px-1.5 py-0.5 rounded-full">手动</span>
                )}
                {!dayTypeOverride && (
                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">自动</span>
                )}
              </div>
              <div className="text-[10px] text-neutral-500 font-bold">{activeDayConfig?.desc}</div>
            </div>
          </div>
          <ChevronDown size={14} className={`text-neutral-500 transition-transform ${showDayTypeSelector ? 'rotate-180' : ''}`} />
        </button>

        {/* 训练日类型选择下拉 */}
        <AnimatePresence>
          {showDayTypeSelector && (
            <motion.div
              key="day-type-selector-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 mt-2">
                {dynamicDayTypes.map((dt, idx) => (
                  <button
                    key={dt.key || `day-type-${idx}`}
                    onClick={() => {
                      if (dt.key === autoDetectedDayType) {
                        setDayTypeOverride(null);
                      } else {
                        setDayTypeOverride(dt.key);
                      }
                      setShowDayTypeSelector(false);
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeDayType === dt.key
                        ? `${dt.bg} ${dt.border}`
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <dt.icon size={16} className={`mx-auto mb-1 ${activeDayType === dt.key ? dt.color : 'text-neutral-500'}`} />
                    <div className={`text-xs font-bold ${activeDayType === dt.key ? 'text-white' : 'text-neutral-400'}`}>
                      {dt.label}
                    </div>
                    <div className="text-[9px] text-neutral-600">{dt.desc}</div>
                  </button>
                ))}
              </div>
              {dayTypeOverride && (
                <button
                  onClick={() => { setDayTypeOverride(null); setShowDayTypeSelector(false); }}
                  className="w-full mt-2 py-2 text-[10px] text-neutral-500 hover:text-primary transition-colors font-bold"
                >
                  恢复自动检测
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ 3. 环形进度条看板 ═══════ */}
      <div className="glass-panel rounded-3xl p-5 mb-5">
        <div className="grid grid-cols-4 gap-2">
          <CircularProgress
            value={totalIntake.calories}
            max={targets.calories}
            label="热量"
            unit="kcal"
            size={80}
            color="#f97316"
          />
          <CircularProgress
            value={totalIntake.protein}
            max={targets.protein}
            label="蛋白质"
            unit="g"
            size={80}
            color="#3b82f6"
          />
          <CircularProgress
            value={totalIntake.carbs}
            max={targets.carbs}
            label="碳水"
            unit="g"
            size={80}
            color="#f59e0b"
          />
          <CircularProgress
            value={totalIntake.fat}
            max={targets.fat}
            label="脂肪"
            unit="g"
            size={80}
            color="#a855f7"
          />
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-[10px] text-neutral-500 font-bold">目标</div>
            <div className="text-xs font-black text-white">{targets.calories}<span className="text-[9px] text-neutral-600"> kcal</span></div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 font-bold">目标</div>
            <div className="text-xs font-black text-white">{targets.protein}<span className="text-[9px] text-neutral-600">g</span></div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 font-bold">目标</div>
            <div className="text-xs font-black text-white">{targets.carbs}<span className="text-[9px] text-neutral-600">g</span></div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 font-bold">目标</div>
            <div className="text-xs font-black text-white">{targets.fat}<span className="text-[9px] text-neutral-600">g</span></div>
          </div>
        </div>
      </div>

      {/* ═══════ 4. 快捷餐食矩阵 ═══════ */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {MEAL_CONFIG.map((meal) => {
          const logs = mealGroups[meal.key] || [];
          const mealTotal = logs.reduce(
            (acc, log) => {
              const n = calculateNutrition(log);
              return { calories: acc.calories + n.calories };
            },
            { calories: 0 }
          );
          const Icon = meal.icon;

          const isCurrentMeal = meal.key === currentMealType;

          return (
            <motion.div
              key={meal.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMealDetailOpen(meal.key)}
              className={`relative h-32 rounded-[2.5rem] p-5 flex flex-col justify-between items-start 
                         backdrop-blur-xl overflow-hidden group cursor-pointer transition-all duration-300
                         ${isCurrentMeal 
                           ? `bg-neutral-900/70 border-2 ${meal.border}` 
                           : 'bg-neutral-900/40 border border-white/5'}`}
              style={isCurrentMeal ? { boxShadow: `0 0 20px ${meal.glow}30, 0 0 60px ${meal.glow}15, inset 0 1px 0 ${meal.glow}20` } : {}}
            >
              {/* 当前餐食的大光晕背景 */}
              {isCurrentMeal && (
                <div className="absolute -top-8 -right-8 w-28 h-28 blur-3xl opacity-30 pointer-events-none" style={{ backgroundColor: meal.glow }} />
              )}
              <div className={`absolute -top-4 -right-4 w-16 h-16 blur-2xl transition-opacity group-hover:opacity-40 ${meal.bg} ${isCurrentMeal ? 'opacity-50' : 'opacity-20'}`} />
              
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${meal.bg} border ${meal.border} shadow-lg ${isCurrentMeal ? 'scale-110' : ''} transition-transform`}>
                <Icon size={20} className={meal.color} />
              </div>

              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white italic">{meal.label}</span>
                  {isCurrentMeal && (
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest animate-pulse text-white" style={{ backgroundColor: `${meal.glow}90` }}>NOW</span>
                  )}
                  {logs.length > 0 && (
                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-neutral-500 font-bold mt-0.5">
                  {logs.length > 0 ? (
                    <span className={meal.color}>{Math.round(mealTotal.calories)} kcal</span>
                  ) : (
                    "待录入"
                  )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openFoodSearch(meal.key);
                }}
                className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-600 border border-white/5 hover:text-primary hover:border-primary/20 transition-all z-20"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* ═══════ 5. 今日概览记录 ═══════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">今日所有记录</h2>
          <span className="text-[10px] text-neutral-700 font-bold italic">Total {dietLogs.length} Items</span>
        </div>

        <AnimatePresence mode="popLayout">
          {dietLogs.length > 0 ? (
            <div className="space-y-3">
              {dietLogs.map((log, idx) => {
                const nutrition = calculateNutrition(log);
                const config = MEAL_CONFIG.find(m => m.key === log.meal_type);
                return (
                  <motion.div
                    key={`log-item-${log.id || idx}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-neutral-900/30 backdrop-blur-md border border-white/5 rounded-[1.5rem] p-4 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config?.bg} border ${config?.border}`}>
                        {config && <config.icon size={16} className={config.color} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white truncate">{log.food_name}</span>
                          <span className="text-[9px] text-neutral-600 font-bold">{log.weight_grams}g</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-orange-400 font-black">{Math.round(nutrition.calories)}<span className="text-[8px] opacity-60 ml-0.5">kcal</span></span>
                          <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] text-blue-400 font-bold">P{nutrition.protein}</span>
                            <span className="text-[8px] text-amber-400 font-bold">C{nutrition.carbs}</span>
                            <span className="text-[8px] text-purple-400 font-bold">F{nutrition.fat}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingLog(log)} className="p-2 text-neutral-500 hover:text-primary"><Pencil size={14} /></button>
                      <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-neutral-500 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              key="empty-diet-logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 border border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-neutral-600"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <UtensilsCrossed size={20} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">开启今天的健康记录</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FoodSearchModal
        isOpen={searchModalOpen}
        onClose={closeFoodSearch}
        mealType={activeMealType}
        date={todayStr}
      />

      <EditWeightModal
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
        log={editingLog}
      />

      {/* ═══════ 设置中心 ═══════ */}
      {createPortal(
        <AnimatePresence>
          {showSettings && (
            <div key="settings-overlay" className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col"
                style={{ maxHeight: '85vh' }}
              >
                <div className="flex items-center justify-between mb-5 shrink-0">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Settings2 size={18} className="text-primary" />
                    饮食偏好设置
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="text-neutral-500 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 mb-2 block">预设体重 (计算基准)</label>
                    <div className="relative">
                      <input type="text" inputMode="decimal" value={tempWeight} onChange={(e) => setTempWeight(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-bold">kg</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">三大营养素目标独立覆盖</label>
                      <span className="text-[9px] text-neutral-600">留空为自动计算</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={tempTargets.protein} onChange={(e) => setTempTargets({ ...tempTargets, protein: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="蛋白质 (g)" className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all text-center" />
                      <input type="text" value={tempTargets.carbs} onChange={(e) => setTempTargets({ ...tempTargets, carbs: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="碳水 (g)" className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-500/50 transition-all text-center" />
                      <input type="text" value={tempTargets.fat} onChange={(e) => setTempTargets({ ...tempTargets, fat: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="脂肪 (g)" className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-purple-500/50 transition-all text-center" />
                      <div className="relative flex items-center justify-center bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2.5">
                        <div className="text-center"><div className="text-xs font-black text-orange-400">自动</div></div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 mb-2 block">各训练日碳水乘数</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <div className="text-[9px] text-neutral-500 text-center">休息日</div>
                        <input type="text" value={tempCarbs.rest} onChange={(e) => setTempCarbs({ ...tempCarbs, rest: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full bg-black/40 border border-white/5 rounded-xl py-2 text-center text-sm font-bold text-white outline-none" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[9px] text-neutral-500 text-center">训练日</div>
                        <input type="text" value={tempCarbs.normal} onChange={(e) => setTempCarbs({ ...tempCarbs, normal: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full bg-black/40 border border-white/5 rounded-xl py-2 text-center text-sm font-bold text-white outline-none" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[9px] text-neutral-500 text-center">练腿日</div>
                        <input type="text" value={tempCarbs.leg} onChange={(e) => setTempCarbs({ ...tempCarbs, leg: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full bg-black/40 border border-white/5 rounded-xl py-2 text-center text-sm font-bold text-white outline-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 shrink-0 pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      const w = parseFloat(tempWeight);
                      if (w > 0 && w < 300) setPresetBodyWeight(w);
                      setCustomTargets({
                        calories: null,
                        protein: parseFloat(tempTargets.protein) || null,
                        carbs: parseFloat(tempTargets.carbs) || null,
                        fat: parseFloat(tempTargets.fat) || null,
                      });
                      setCarbsMultipliers({
                        rest: parseFloat(tempCarbs.rest) || 1.2,
                        normal: parseFloat(tempCarbs.normal) || 2.5,
                        leg: parseFloat(tempCarbs.leg) || 3.5,
                      });
                      setShowSettings(false);
                    }}
                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                  >
                    保存并应用
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══════ 餐次明细抽屉 ═══════ */}
      {createPortal(
        <AnimatePresence>
          {mealDetailOpen && (
            <div key={`meal-detail-${mealDetailOpen}`} className="fixed inset-0 z-[1500] flex items-end justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMealDetailOpen(null)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-[3rem] p-6 shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 shrink-0" />
                {(() => {
                  const meal = MEAL_CONFIG.find(m => m.key === mealDetailOpen);
                  const logs = mealGroups[mealDetailOpen] || [];
                  const mealTotal = logs.reduce((acc, log) => {
                    const n = calculateNutrition(log);
                    return { calories: acc.calories + n.calories, protein: acc.protein + n.protein, carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat };
                  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
                  const Icon = meal.icon;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-6 shrink-0">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${meal.bg} border ${meal.border}`}>
                            <Icon size={28} className={meal.color} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-white italic tracking-tight">{meal.label}明细</h3>
                            <span className={`text-sm font-black ${meal.color}`}>{Math.round(mealTotal.calories)} <span className="text-[10px] opacity-60">kcal</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-6 shrink-0">
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                          <div className="text-[9px] text-neutral-500 font-bold uppercase mb-1">蛋白质</div>
                          <div className="text-sm font-black text-blue-400">{Math.round(mealTotal.protein)}g</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                          <div className="text-[9px] text-neutral-500 font-bold uppercase mb-1">碳水</div>
                          <div className="text-sm font-black text-amber-400">{Math.round(mealTotal.carbs)}g</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                          <div className="text-[9px] text-neutral-500 font-bold uppercase mb-1">脂肪</div>
                          <div className="text-sm font-black text-purple-400">{Math.round(mealTotal.fat)}g</div>
                        </div>
                      </div>

                      {/* 3. 推荐记录 (昨日同餐食) */}
                      {recommendations.length > 0 && (
                        <div className="mb-6 shrink-0">
                          <div className="flex items-center justify-between mb-3 px-1">
                            <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                              <RefreshCw size={10} className="text-primary" /> 昨日同餐推荐
                            </h4>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar-hide no-scrollbar">
                            {recommendations.map((food, idx) => (
                              <motion.div
                                key={`rec-item-${food.id || idx}`}
                                whileTap={{ scale: 0.95 }}
                                onClick={async () => {
                                  await addDietLog({
                                    food_id: food.id,
                                    meal_type: mealDetailOpen,
                                    weight_grams: food.base_weight || 100,
                                    date: todayStr
                                  });
                                }}
                                className="flex-shrink-0 w-32 p-3 bg-white/5 border border-white/5 rounded-2xl text-left cursor-pointer group/rec"
                              >
                                <div className="text-[11px] font-black text-white truncate mb-1 group-hover/rec:text-primary transition-colors">{food.name}</div>
                                <div className="text-[9px] text-neutral-500 font-bold">{food.calories_per_100g}kcal/100g</div>
                                <div className="mt-2 flex items-center gap-1 text-[8px] text-primary font-black uppercase opacity-60">
                                  <Plus size={8} strokeWidth={4} /> 快捷添加
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 pb-24">
                        <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 mb-2">已记录内容</div>
                        {logs.length > 0 ? (
                          logs.map((log, idx) => {
                            const n = calculateNutrition(log);
                            return (
                              <div key={`meal-log-item-${log.id || idx}`} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white truncate">{log.food_name}</span>
                                    <span className="text-[10px] text-neutral-500 font-bold italic">{log.weight_grams}g</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-orange-400/80 font-black">{Math.round(n.calories)} kcal</span>
                                    <span className="text-[9px] text-neutral-600">P{n.protein} · C{n.carbs} · F{n.fat}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setEditingLog(log)} className="p-2 text-neutral-500 hover:text-primary"><Pencil size={16} /></button>
                                  <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-neutral-500 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div key="empty-meal-logs" className="py-12 text-center text-neutral-600">
                            <p className="text-xs font-bold">暂无记录，快去添加吧</p>
                          </div>
                        )}
                      </div>

                      {/* 底部固定操作栏 */}
                      <div className="absolute bottom-6 left-6 right-6">
                        <button
                          onClick={() => openFoodSearch(mealDetailOpen)}
                          className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20
                                     active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={20} strokeWidth={3} />
                          添加{meal.label}内容
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══════ 8. 饮食历史概览 (15天历史) ═══════ */}
      {createPortal(
        <AnimatePresence>
          {showHistory && (
            <div key="diet-history-overlay" className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-white italic tracking-tight">15天历史回顾</h3>
                  <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-500">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                  {dietHistory.length > 0 ? (
                    dietHistory.map((item, idx) => (
                      <div key={`history-item-${item.date || idx}`} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div>
                          <div className="text-xs font-black text-white">{item.date}</div>
                          <div className="text-[10px] text-neutral-500 font-bold mt-0.5">{item.item_count} 项记录</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-primary">{Math.round(item.total_calories)} <span className="text-[9px] opacity-60">kcal</span></div>
                          <div className="text-[9px] text-neutral-600 font-bold italic uppercase mt-0.5">Summary</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-neutral-600">
                      <p className="text-xs font-bold italic">尚无历史记录，开始记录第一天吧</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 text-center">
                  <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">
                    * 记录仅保存最近15天，超期将自动清理
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};

export default DietHub;

