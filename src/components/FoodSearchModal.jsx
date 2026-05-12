/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FoodSearchModal - 食物搜索与录入弹窗
 *
 * 功能：
 *   1. 模糊搜索过滤 foods 表中的食物
 *   2. 选中食物后输入重量，实时计算并展示营养数据
 *   3. 确认后将饮食记录保存到数据库
 *   4. 底部提供"新增自定义食物"快捷入口
 *
 * 交互流程：
 *   搜索列表 → 选中食物 → 输入重量 → 实时预览营养 → 确认保存
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, ArrowLeft, Scale, Loader2, Flame, Beef, Wheat, Droplet, BookOpen, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useDietStore, { calculateNutrition } from '../store/useDietStore';
import AddCustomFoodModal from './AddCustomFoodModal';

const FoodItem = ({ food, onSelect, onToggleFav }) => {
  const isFav = !!food.is_favorite;
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center justify-between p-3.5 bg-white/[0.02] hover:bg-white/[0.06]
                 border border-white/5 hover:border-primary/20 rounded-2xl transition-all text-left group"
    >
      <div className="min-w-0 flex-1 flex items-center gap-3" onClick={onSelect}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
              {food.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-orange-400 font-bold">{food.calories_per_100g} kcal</span>
            <span className="text-[10px] text-neutral-500">
              每 {food.base_weight || 100}g
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-2 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          className={`p-2 rounded-xl transition-all ${isFav ? 'text-amber-400 bg-amber-400/10' : 'text-neutral-700 hover:text-amber-400'}`}
        >
          <Star size={14} fill={isFav ? "currentColor" : "none"} />
        </button>
        <button 
          onClick={onSelect}
          className="p-2 text-neutral-700 group-hover:text-primary transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </motion.div>
  );
};

const FoodSearchModal = ({ isOpen, onClose, mealType, date }) => {
  // ── 状态管理 ───────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);  // 已选中的食物
  const [weightInput, setWeightInput] = useState('100');     // 重量输入（默认100克）
  const [showCustomFood, setShowCustomFood] = useState(false); // 自定义食物弹窗
  const [recommendations, setRecommendations] = useState([]); // 推荐食物
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const debounceTimer = useRef(null);

  const {
    foods, isLoadingFoods, searchFoods, addDietLog, toggleFavorite, fetchRecommendations
  } = useDietStore();

  // ── 初始加载全部食物与推荐 ───────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      searchFoods('');
      setSearchQuery('');
      setSelectedFood(null);
      setWeightInput('100');
      
      // 获取智能推荐
      fetchRecommendations(mealType).then(res => setRecommendations(res));

      // 延迟聚焦搜索框（等动画完成）
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [isOpen, searchFoods, fetchRecommendations, mealType]);

  // ── 防抖搜索（300ms）──────────────────────────────────────────────────
  // 用户每次输入都会清除上一个定时器，重新设置一个 300ms 后执行的搜索
  // 这样用户快速输入时不会触发大量请求，只在停止输入 300ms 后才搜索
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    // 清除之前的定时器
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    // 设置新的定时器：300ms 后执行搜索
    debounceTimer.current = setTimeout(() => {
      searchFoods(value);
    }, 300);
  }, [searchFoods]);

  // ── 选择食物 ──────────────────────────────────────────────────────────
  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setWeightInput('100');
  };

  // ── 返回搜索列表 ─────────────────────────────────────────────────────
  const handleBackToSearch = () => {
    setSelectedFood(null);
    setWeightInput('100');
  };

  // ── 确认添加饮食记录 ─────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedFood || !weightInput) return;

    const weight = parseFloat(weightInput);
    if (weight <= 0 || isNaN(weight)) return;

    setIsSubmitting(true);
    const result = await addDietLog({
      food_id: selectedFood.id,
      meal_type: mealType,
      weight_grams: weight,
      date: date,
    });
    setIsSubmitting(false);

    if (result) {
      onClose();
    }
  };

  // ── 实时营养计算预览 ────────────────────────────────────────────────
  // 当用户修改重量时，实时计算并展示该重量下的热量和三大项
  // 公式: (输入重量/100) × 百克营养值
  const previewNutrition = selectedFood
    ? calculateNutrition({
        weight_grams: parseFloat(weightInput) || 0,
        base_weight: selectedFood.base_weight,
        calories_per_100g: selectedFood.calories_per_100g,
        protein_per_100g: selectedFood.protein_per_100g,
        carbs_per_100g: selectedFood.carbs_per_100g,
        fat_per_100g: selectedFood.fat_per_100g,
      })
    : null;

  // ── 餐次名称映射 ─────────────────────────────────────────────────────
  const mealTypeLabel = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    snack: '加餐',
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div key="food-search-modal-wrapper" className="fixed inset-0 z-[2100] flex items-end justify-center">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-3xl shadow-2xl
                       flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            {/* 拖拽指示条 */}
            <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-2 shrink-0" />

            <AnimatePresence mode="wait">
              {!selectedFood ? (
                // ════════════ 阶段1：搜索列表 ════════════
                <motion.div
                  key="search"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col min-h-0 px-5 pb-8"
                >
                  {/* 头部 */}
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h2 className="text-lg font-black text-white">
                      添加{mealTypeLabel[mealType] || '食物'}
                    </h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {/* 搜索框 */}
                  <div className="relative mb-4 shrink-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="搜索食物名称..."
                      className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-sm text-white
                                 placeholder:text-neutral-600 outline-none focus:border-primary/50 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(''); searchFoods(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* 食物列表 */}
                  <div className="flex-1 overflow-y-auto min-h-0 space-y-3 custom-scrollbar pb-2" style={{ maxHeight: '50vh' }}>
                    {isLoadingFoods ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-primary" size={24} />
                      </div>
                    ) : (
                      <>
                        {/* 智能推荐区域 (仅在搜索框为空时显示) */}
                        {!searchQuery && recommendations.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <div className="w-1 h-3 bg-amber-500 rounded-full" />
                              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">智能推荐 (昨日/收藏)</span>
                            </div>
                            <div className="space-y-1.5">
                              {recommendations.map((food, idx) => (
                                <FoodItem 
                                  key={`modal-rec-item-${food.id || idx}`} 
                                  food={food} 
                                  onSelect={() => handleSelectFood(food)}
                                  onToggleFav={() => toggleFavorite(food.id)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 搜索结果/全部列表 */}
                        <div className="space-y-1.5">
                          {!searchQuery && <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 px-1">所有食物</div>}
                            {foods.length === 0 ? (
                              <div className="text-center py-12">
                                <p className="text-neutral-500 text-sm">未找到匹配的食物</p>
                              </div>
                            ) : (
                              foods.map((food, idx) => (
                                <FoodItem 
                                  key={`modal-food-item-${food.id || idx}`} 
                                  food={food} 
                                  onSelect={() => handleSelectFood(food)}
                                  onToggleFav={() => toggleFavorite(food.id)}
                                />
                              ))
                            )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 底部：新增自定义食物 & 管理食物库 */}
                  <div className="flex gap-2 mt-3 shrink-0">
                    <button
                      onClick={() => setShowCustomFood(true)}
                      className="flex-1 py-3.5 bg-white/[0.03] hover:bg-primary/10 border border-dashed border-white/10
                                 hover:border-primary/30 rounded-2xl text-sm font-bold text-neutral-400 hover:text-primary
                                 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      自定义食物
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        navigate('/food-library');
                      }}
                      className="flex-1 py-3.5 bg-white/[0.03] hover:bg-emerald-500/10 border border-dashed border-white/10
                                 hover:border-emerald-500/30 rounded-2xl text-sm font-bold text-neutral-400 hover:text-emerald-500
                                 transition-all flex items-center justify-center gap-2"
                    >
                      <BookOpen size={16} />
                      管理食物库
                    </button>
                  </div>
                </motion.div>
              ) : (
                // ════════════ 阶段2：输入重量 + 营养预览 ════════════
                <motion.div
                  key="weight"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="px-5 pb-8"
                >
                  {/* 返回按钮 + 食物名称 */}
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      onClick={handleBackToSearch}
                      className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center
                                 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-lg font-black text-white">{selectedFood.name}</h2>
                      <p className="text-[10px] text-neutral-500">基准: {selectedFood.calories_per_100g} kcal / {selectedFood.base_weight || 100}g</p>
                    </div>
                  </div>

                  {/* 重量输入 */}
                  <div className="mb-6">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 mb-2 block">
                      摄入重量
                    </label>
                    <div className="relative">
                      <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-12 py-4
                                   text-2xl font-black text-white text-center outline-none
                                   focus:border-primary/50 transition-all tabular-nums"
                        autoFocus
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-bold">
                        克
                      </span>
                    </div>
                    {/* 快捷重量按钮 */}
                    <div className="flex gap-2 mt-3">
                      {[50, 100, 150, 200, 250, 300].map(w => (
                        <button
                          key={`weight-btn-${w}`}
                          onClick={() => setWeightInput(String(w))}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                            weightInput === String(w)
                              ? 'bg-primary/20 text-primary border border-primary/30'
                              : 'bg-white/[0.03] text-neutral-500 border border-white/5 hover:bg-white/5'
                          }`}
                        >
                          {w}g
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 营养预览卡片 — 这里展示根据输入重量实时计算的营养数据 */}
                  {previewNutrition && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-6">
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">
                        营养速览 · {weightInput || 0}g (约 {((parseFloat(weightInput)||0)/(selectedFood.base_weight||100)).toFixed(1)} 份)
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {/* 热量 */}
                        <div className="text-center p-2 bg-orange-500/5 rounded-xl border border-orange-500/10">
                          <Flame size={14} className="text-orange-400 mx-auto mb-1" />
                          <div className="text-sm font-black text-white">{previewNutrition.calories}</div>
                          <div className="text-[9px] text-neutral-500 font-bold">kcal</div>
                        </div>
                        {/* 蛋白质 */}
                        <div className="text-center p-2 bg-blue-500/5 rounded-xl border border-blue-500/10">
                          <Beef size={14} className="text-blue-400 mx-auto mb-1" />
                          <div className="text-sm font-black text-white">{previewNutrition.protein}</div>
                          <div className="text-[9px] text-neutral-500 font-bold">蛋白质</div>
                        </div>
                        {/* 碳水 */}
                        <div className="text-center p-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
                          <Wheat size={14} className="text-amber-400 mx-auto mb-1" />
                          <div className="text-sm font-black text-white">{previewNutrition.carbs}</div>
                          <div className="text-[9px] text-neutral-500 font-bold">碳水</div>
                        </div>
                        {/* 脂肪 */}
                        <div className="text-center p-2 bg-purple-500/5 rounded-xl border border-purple-500/10">
                          <Droplet size={14} className="text-purple-400 mx-auto mb-1" />
                          <div className="text-sm font-black text-white">{previewNutrition.fat}</div>
                          <div className="text-[9px] text-neutral-500 font-bold">脂肪</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 确认按钮 */}
                  <button
                    onClick={handleConfirm}
                    disabled={isSubmitting || !weightInput || parseFloat(weightInput) <= 0}
                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20
                               active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100
                               flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        记录中...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        确认添加
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* 自定义食物子弹窗 */}
      <AddCustomFoodModal
        isOpen={showCustomFood}
        onClose={() => setShowCustomFood(false)}
        onSuccess={() => {
          // 新增食物成功后，刷新搜索列表
          searchFoods(searchQuery);
        }}
      />
    </AnimatePresence>,
    document.body
  );
};

export default FoodSearchModal;
