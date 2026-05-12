/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EditWeightModal - 修改已记录食物重量弹窗
 *
 * 功能：
 *   1. 接收一个 dietLog 对象作为初始数据
 *   2. 允许用户修改重量
 *   3. 实时预览修改后的营养数据
 *   4. 保存时调用 updateDietLog 更新数据
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scale, Flame, Beef, Wheat, Droplet, Loader2, Save } from 'lucide-react';
import useDietStore, { calculateNutrition } from '../store/useDietStore';

const EditWeightModal = ({ isOpen, onClose, log }) => {
  const [weightInput, setWeightInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateDietLog } = useDietStore();

  // 当弹窗打开时，初始化重量
  useEffect(() => {
    if (isOpen && log) {
      setWeightInput(String(log.weight_grams));
    }
  }, [isOpen, log]);

  // 计算实时预览营养数据
  const previewNutrition = log
    ? calculateNutrition({
        weight_grams: parseFloat(weightInput) || 0,
        calories_per_100g: log.calories_per_100g,
        protein_per_100g: log.protein_per_100g,
        carbs_per_100g: log.carbs_per_100g,
        fat_per_100g: log.fat_per_100g,
      })
    : null;

  // 提交修改
  const handleSave = async () => {
    if (!log || !weightInput) return;
    const weight = parseFloat(weightInput);
    if (weight <= 0 || isNaN(weight)) return;

    setIsSubmitting(true);
    const result = await updateDietLog(log.id, weight);
    setIsSubmitting(false);

    if (result) {
      onClose();
    }
  };

  if (!log) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2200] flex items-end justify-center">
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
            className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-3xl shadow-2xl px-5 pb-8 flex flex-col"
          >
            {/* 拖拽指示条 */}
            <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-6 shrink-0" />

            {/* 头部信息 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  修改记录重量
                </h2>
                <p className="text-[11px] text-neutral-500 font-bold mt-1">
                  {log.food_name} (原: {log.weight_grams}g)
                </p>
              </div>
              <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* 重量输入框 */}
            <div className="mb-6">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 mb-2 block">
                新摄入重量
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
                    key={w}
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

            {/* 营养预览卡片 */}
            {previewNutrition && (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-6">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">
                  修改后营养速览
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-orange-500/5 rounded-xl border border-orange-500/10">
                    <Flame size={14} className="text-orange-400 mx-auto mb-1" />
                    <div className="text-sm font-black text-white">{previewNutrition.calories}</div>
                    <div className="text-[9px] text-neutral-500 font-bold">kcal</div>
                  </div>
                  <div className="text-center p-2 bg-blue-500/5 rounded-xl border border-blue-500/10">
                    <Beef size={14} className="text-blue-400 mx-auto mb-1" />
                    <div className="text-sm font-black text-white">{previewNutrition.protein}</div>
                    <div className="text-[9px] text-neutral-500 font-bold">蛋白质</div>
                  </div>
                  <div className="text-center p-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
                    <Wheat size={14} className="text-amber-400 mx-auto mb-1" />
                    <div className="text-sm font-black text-white">{previewNutrition.carbs}</div>
                    <div className="text-[9px] text-neutral-500 font-bold">碳水</div>
                  </div>
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
              onClick={handleSave}
              disabled={isSubmitting || !weightInput || parseFloat(weightInput) <= 0 || parseFloat(weightInput) === log.weight_grams}
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20
                         active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100
                         flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={18} />
                  确认修改
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default EditWeightModal;
