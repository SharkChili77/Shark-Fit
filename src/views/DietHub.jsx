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
  Cookie, Dumbbell, BedDouble, Zap, Settings2, ChevronDown, X, Pencil
} from 'lucide-react';
import { createPortal } from 'react-dom';

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
  { key: 'breakfast', label: '早餐', icon: Sun,    color: 'text-amber-400',  bg: 'bg-amber-500/5',  border: 'border-amber-500/10' },
  { key: 'lunch',     label: '午餐', icon: Flame,  color: 'text-orange-400', bg: 'bg-orange-500/5', border: 'border-orange-500/10' },
  { key: 'dinner',    label: '晚餐', icon: Moon,   color: 'text-indigo-400', bg: 'bg-indigo-500/5', border: 'border-indigo-500/10' },
  { key: 'snack',     label: '加餐', icon: Cookie, color: 'text-pink-400',   bg: 'bg-pink-500/5',   border: 'border-pink-500/10' },
];

const DietHub = () => {
  const todayStr = getTodayDateString();
  const dayOfWeek = getDayOfWeek();

  // ── Store 数据 ─────────────────────────────────────────────────────────
  const {
    presetBodyWeight, dayTypeOverride, setDayTypeOverride, setPresetBodyWeight,
    carbsMultipliers, setCarbsMultipliers, customTargets, setCustomTargets,
    dietLogs, fetchDietLogs, isLoadingLogs, deleteDietLog, getTotalIntake,
  } = useDietStore();

  const { routines, exercises, setModalOpen } = useFitnessStore();

  // ── 训练日类型动态配置 ────────────────────────────────────────────────
  const dynamicDayTypes = useMemo(() => [
    { key: 'rest',   label: '休息日',   icon: BedDouble, desc: `碳水 × ${carbsMultipliers?.rest || 1.2}`, color: 'text-blue-400',   bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { key: 'normal', label: '训练日',   icon: Dumbbell,  desc: `碳水 × ${carbsMultipliers?.normal || 2.5}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { key: 'leg',    label: '练腿日',   icon: Zap,       desc: `碳水 × ${carbsMultipliers?.leg || 3.5}`, color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  ], [carbsMultipliers]);

  // ── 加载当日饮食记录 ──────────────────────────────────────────────────
  useEffect(() => {
    fetchDietLogs(todayStr);
  }, [todayStr, fetchDietLogs]);

  // ── 训练日类型自动检测 ─────────────────────────────────────────────────
  // 从当天的训练计划中获取所有动作，然后检测 target 字段是否包含"腿"
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

  // 自动检测的训练日类型
  const autoDetectedDayType = useMemo(
    () => detectDayType(todayExercises),
    [todayExercises]
  );

  // 最终使用的训练日类型：用户手动覆盖 > 自动检测
  const activeDayType = dayTypeOverride || autoDetectedDayType;

  // ── 计算每日营养目标 ──────────────────────────────────────────────────
  // 这是核心引擎：根据体重和训练日类型，计算蛋白质/碳水/脂肪/热量目标
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

  // ── 弹窗状态 ──────────────────────────────────────────────────────────
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState('breakfast');
  const [showDayTypeSelector, setShowDayTypeSelector] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // 设置中心状态
  const [showSettings, setShowSettings] = useState(false);
  const [tempWeight, setTempWeight] = useState('');
  const [tempTargets, setTempTargets] = useState({ protein: '', carbs: '', fat: '' });
  const [tempCarbs, setTempCarbs] = useState({ rest: '', normal: '', leg: '' });

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
    // 刷新饮食记录
    fetchDietLogs(todayStr);
  };

  // 删除饮食记录
  const handleDeleteLog = (logId) => {
    deleteDietLog(logId);
  };

  // 获取当前训练日类型的配置
  const activeDayConfig = dynamicDayTypes.find(d => d.key === activeDayType);

  // ── 环形进度条百分比计算说明 ──────────────────────────────────────────
  // 百分比 = (已摄入量 / 目标量) × 100
  // 例如: 蛋白质已吃 80g，目标 128g → 百分比 = 80/128 × 100 = 62.5%
  // CircularProgress 组件内部会自动处理超标变色（>100%时变红）

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
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 mt-2">
                {dynamicDayTypes.map(dt => (
                  <button
                    key={dt.key}
                    onClick={() => {
                      // 如果用户选择的和自动检测结果一致，则取消手动覆盖（恢复自动模式）
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
          {/* 总卡路里 */}
          <CircularProgress
            value={totalIntake.calories}
            max={targets.calories}
            label="热量"
            unit="kcal"
            size={80}
            color="#f97316"  // orange-500
          />
          {/* 蛋白质 */}
          <CircularProgress
            value={totalIntake.protein}
            max={targets.protein}
            label="蛋白质"
            unit="g"
            size={80}
            color="#3b82f6"  // blue-500
          />
          {/* 碳水化合物 */}
          <CircularProgress
            value={totalIntake.carbs}
            max={targets.carbs}
            label="碳水"
            unit="g"
            size={80}
            color="#f59e0b"  // amber-500
          />
          {/* 脂肪 */}
          <CircularProgress
            value={totalIntake.fat}
            max={targets.fat}
            label="脂肪"
            unit="g"
            size={80}
            color="#a855f7"  // purple-500
          />
        </div>

        {/* 目标总览数据行 */}
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

      {/* ═══════ 4. 四个餐食区块 ═══════ */}
      <div className="space-y-4">
        {MEAL_CONFIG.map((meal) => {
          const logs = mealGroups[meal.key] || [];
          const Icon = meal.icon;

          // 计算该餐次的小计
          const mealTotal = logs.reduce(
            (acc, log) => {
              const n = calculateNutrition(log);
              return {
                calories: acc.calories + n.calories,
                protein: acc.protein + n.protein,
                carbs: acc.carbs + n.carbs,
                fat: acc.fat + n.fat,
              };
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return (
            <motion.div
              key={meal.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${meal.bg} border ${meal.border} rounded-2xl overflow-hidden`}
            >
              {/* 餐次头部 */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className={meal.color} />
                  <span className="text-sm font-black text-white">{meal.label}</span>
                  {logs.length > 0 && (
                    <span className="text-[10px] text-neutral-500 font-bold">
                      {Math.round(mealTotal.calories)} kcal
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openFoodSearch(meal.key)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-primary/10
                             rounded-xl text-[11px] font-bold text-neutral-400 hover:text-primary
                             transition-all active:scale-95"
                >
                  <Plus size={12} />
                  添加
                </button>
              </div>

              {/* 已记录的食物列表 */}
              {logs.length > 0 && (
                <div className="px-3 pb-3 space-y-1">
                  {logs.map((log) => {
                    // 计算每条记录的实际营养值
                    const nutrition = calculateNutrition(log);
                    return (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-2.5 bg-black/20 rounded-xl group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{log.food_name}</span>
                            <span className="text-[10px] text-neutral-500 shrink-0">{log.weight_grams}g</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-orange-400 font-bold">{nutrition.calories}kcal</span>
                            <span className="text-[9px] text-neutral-600">
                              蛋白{nutrition.protein}g · 碳水{nutrition.carbs}g · 脂肪{nutrition.fat}g
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => setEditingLog(log)}
                            className="p-2 text-neutral-500 hover:text-primary opacity-0 group-hover:opacity-100
                                       transition-all active:scale-90 shrink-0"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-2 text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100
                                       transition-all active:scale-90 shrink-0 ml-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* 空状态 */}
              {logs.length === 0 && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => openFoodSearch(meal.key)}
                    className="w-full py-4 border border-dashed border-white/5 rounded-xl
                               text-xs text-neutral-600 hover:text-primary hover:border-primary/20
                               transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    点击添加食物
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ═══════ 食物搜索弹窗 ═══════ */}
      <FoodSearchModal
        isOpen={searchModalOpen}
        onClose={closeFoodSearch}
        mealType={activeMealType}
        date={todayStr}
      />

      {/* ═══════ 修改记录重量弹窗 ═══════ */}
      <EditWeightModal
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
        log={editingLog}
      />

      {/* ═══════ 高级设置中心弹窗 ═══════ */}
      {createPortal(
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
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
                  {/* 1. 基础体重 */}
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 mb-2 block">
                      预设体重 (计算基准)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={tempWeight}
                        onChange={(e) => setTempWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3
                                   text-sm font-bold text-white outline-none focus:border-primary/50 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-bold">kg</span>
                    </div>
                  </div>

                  {/* 2. 目标强制覆盖 */}
                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                        三大营养素目标独立覆盖
                      </label>
                      <span className="text-[9px] text-neutral-600">留空为按体重自动计算</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tempTargets.protein}
                          onChange={(e) => setTempTargets({ ...tempTargets, protein: e.target.value.replace(/[^0-9.]/g, '') })}
                          placeholder="蛋白质 (g)"
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5
                                     text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all text-center"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tempTargets.carbs}
                          onChange={(e) => setTempTargets({ ...tempTargets, carbs: e.target.value.replace(/[^0-9.]/g, '') })}
                          placeholder="碳水 (g)"
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5
                                     text-sm font-bold text-white outline-none focus:border-amber-500/50 transition-all text-center"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tempTargets.fat}
                          onChange={(e) => setTempTargets({ ...tempTargets, fat: e.target.value.replace(/[^0-9.]/g, '') })}
                          placeholder="脂肪 (g)"
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5
                                     text-sm font-bold text-white outline-none focus:border-purple-500/50 transition-all text-center"
                        />
                      </div>
                      <div className="relative flex items-center justify-center bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2.5">
                        <div className="text-center">
                          <div className="text-xs font-black text-orange-400">自动计算</div>
                          <div className="text-[9px] text-orange-400/80">热量守恒</div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-primary/80 mt-1.5 ml-1 leading-relaxed">
                      💡 设置后，目标将强制固定。总热量目标永远根据 4-4-9 能量守恒定律自动计算。
                    </p>
                  </div>

                  {/* 3. 碳水倍数配置 */}
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 mb-2 block">
                      各训练日碳水乘数
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <div className="text-[9px] text-neutral-500 text-center">休息日</div>
                        <input
                          type="text"
                          value={tempCarbs.rest}
                          onChange={(e) => setTempCarbs({ ...tempCarbs, rest: e.target.value.replace(/[^0-9.]/g, '') })}
                          className="w-full bg-black/40 border border-white/5 rounded-xl py-2 text-center text-sm font-bold text-white focus:border-blue-500/50 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[9px] text-neutral-500 text-center">训练日</div>
                        <input
                          type="text"
                          value={tempCarbs.normal}
                          onChange={(e) => setTempCarbs({ ...tempCarbs, normal: e.target.value.replace(/[^0-9.]/g, '') })}
                          className="w-full bg-black/40 border border-white/5 rounded-xl py-2 text-center text-sm font-bold text-white focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[9px] text-neutral-500 text-center">练腿日</div>
                        <input
                          type="text"
                          value={tempCarbs.leg}
                          onChange={(e) => setTempCarbs({ ...tempCarbs, leg: e.target.value.replace(/[^0-9.]/g, '') })}
                          className="w-full bg-black/40 border border-white/5 rounded-xl py-2 text-center text-sm font-bold text-white focus:border-orange-500/50 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 shrink-0 pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      const w = parseFloat(tempWeight);
                      if (w > 0 && w < 300) setPresetBodyWeight(w);

                      const pro = parseFloat(tempTargets.protein);
                      const car = parseFloat(tempTargets.carbs);
                      const f = parseFloat(tempTargets.fat);

                      setCustomTargets({
                        calories: null,
                        protein: pro > 0 ? pro : null,
                        carbs: car > 0 ? car : null,
                        fat: f > 0 ? f : null,
                      });

                      setCarbsMultipliers({
                        rest: parseFloat(tempCarbs.rest) || 1.2,
                        normal: parseFloat(tempCarbs.normal) || 2.5,
                        leg: parseFloat(tempCarbs.leg) || 3.5,
                      });

                      setShowSettings(false);
                    }}
                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20
                               active:scale-95 transition-all"
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
    </motion.div>
  );
};

export default DietHub;
