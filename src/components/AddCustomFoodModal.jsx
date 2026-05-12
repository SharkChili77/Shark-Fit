/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AddCustomFoodModal - 自定义食物录入弹窗
 *
 * 允许用户手动录入新食物的百克营养数据并保存至数据库。
 * 使用 Bottom Sheet 风格，与应用其他弹窗保持一致。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2, Search, Edit3 } from 'lucide-react';
import useDietStore from '../store/useDietStore';

const AddCustomFoodModal = ({ isOpen, onClose, onSuccess, editFood = null }) => {
  // 表单状态
  const [name, setName] = useState('');
  const [baseWeight, setBaseWeight] = useState('100');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const { addCustomFood, updateFood, searchExternalFood } = useDietStore();

  // 初始化编辑数据
  useEffect(() => {
    if (isOpen) {
      if (editFood) {
        setName(editFood.name);
        setBaseWeight(String(editFood.base_weight || 100));
        setCalories(String(editFood.calories_per_100g));
        setProtein(String(editFood.protein_per_100g));
        setCarbs(String(editFood.carbs_per_100g));
        setFat(String(editFood.fat_per_100g));
      } else {
        resetForm();
      }
    }
  }, [isOpen, editFood]);

  // 监听三大项变化，自动计算总热量 (4-4-9 规则)
  useEffect(() => {
    const p = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fat) || 0;
    if (p > 0 || c > 0 || f > 0) {
      setCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
    } else {
      setCalories('');
    }
  }, [protein, carbs, fat]);


  // 清空表单
  const resetForm = () => {
    setName('');
    setBaseWeight('100');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setError('');
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 前端基础校验
    if (!name.trim()) {
      setError('请输入食物名称');
      return;
    }

    const foodData = {
      name: name.trim(),
      base_weight: parseFloat(baseWeight) || 100,
      calories_per_100g: parseFloat(calories) || 0,
      protein_per_100g: parseFloat(protein) || 0,
      carbs_per_100g: parseFloat(carbs) || 0,
      fat_per_100g: parseFloat(fat) || 0,
    };

    setIsSubmitting(true);
    const result = editFood 
      ? await updateFood(editFood.id, foodData)
      : await addCustomFood(foodData);
    setIsSubmitting(false);

    if (result) {
      resetForm();
      onSuccess?.(result);
      onClose();
    } else {
      setError(editFood ? '修改失败' : '添加失败，请稍后重试');
    }
  };

  // 数字输入框通用组件
  const NumberInput = ({ label, value, onChange, unit = 'g', disabled = false }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          disabled={disabled}
          className={`w-full border border-white/5 rounded-xl px-4 py-3 text-sm font-bold
                     outline-none transition-all pr-12
                     ${disabled ? 'bg-black/20 text-neutral-500 cursor-not-allowed' : 'bg-black/40 text-white focus:border-primary/50 placeholder:text-neutral-700'}`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-600 font-bold">
          {unit}
        </span>
      </div>
    </div>
  );

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

          {/* 弹窗内容 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 pb-10 shadow-2xl"
          >
            {/* 拖拽指示条 */}
            <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto mb-5" />

            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {editFood ? (
                  <>
                    <Edit3 className="text-primary" size={20} />
                    修改食物信息
                  </>
                ) : (
                  <>
                    <Plus className="text-primary" size={20} />
                    新增自定义食物
                  </>
                )}
              </h2>
              <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 食物名称 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">
                    食物名称
                  </label>
                  {name.length >= 2 && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsSearching(true);
                        setError('');
                        const result = await searchExternalFood(name);
                        setIsSearching(false);
                        if (result && result.success) {
                          const { data } = result;
                          setProtein(String(data.protein_per_100g));
                          setCarbs(String(data.carbs_per_100g));
                          setFat(String(data.fat_per_100g));
                          setCalories(String(data.calories_per_100g));
                          setBaseWeight(String(data.base_weight || 100));
                          // 提示用户已自动填写
                        } else {
                          setError('未找到该食物的营养数据，请尝试更通用的名称');
                        }
                      }}
                      className="text-[10px] font-black text-primary hover:text-primary/80 transition-colors
                                 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg"
                    >
                      {isSearching ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Search size={10} />
                      )}
                      智能填写
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：紫薯"
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-sm
                             placeholder:text-neutral-700 outline-none focus:border-primary/50 transition-all"
                  autoFocus
                />
              </div>

              {/* 基准重量 */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">
                  基准分量 (每多少克/单位)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={baseWeight}
                    onChange={(e) => setBaseWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="100"
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-sm
                               outline-none focus:border-primary/50 transition-all pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-600 font-bold">g</span>
                </div>
              </div>

              {/* 提示：百克营养数据 */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
                <p className="text-[11px] text-primary/80 font-bold leading-relaxed">
                  💡 请填写该食物在 <span className="text-primary font-black">{baseWeight || 100}g</span> 下的营养含量
                </p>
              </div>

              {/* 营养数据输入网格 */}
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="热量 (自动计算)" value={calories} unit="kcal" disabled={true} />
                <NumberInput label="蛋白质" value={protein} onChange={setProtein} />
                <NumberInput label="碳水化合物" value={carbs} onChange={setCarbs} />
                <NumberInput label="脂肪" value={fat} onChange={setFat} />
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400">
                  ⚠️ {error}
                </div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
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
                  '保存食物'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AddCustomFoodModal;
