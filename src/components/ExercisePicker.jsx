import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Search } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

/**
 * 🆕 动作选择器组件 - 从底部弹出
 * 用于在训练过程中动态插入动作
 */
const ExercisePicker = ({ isOpen, onClose, onSelect, currentIndex, title = "插入下一个动作" }) => {
  const { exercises } = useFitnessStore();
  const [filter, setFilter] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef(null);

  const targets = ['全部', '胸', '背', '肩', '腿', '二头', '三头', '腹部', '核心', '小腿', '有氧'];

  // ── 1. 防止背景滚动 (Body Scroll Lock) ───────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ── 2. 切换分类或搜索时自动回到顶部 ──────────────────────────────────────────
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0 }); // 瞬时回到顶部
    }
  }, [filter, searchQuery]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      const matchFilter = filter === '全部' || ex.target === filter;
      const matchSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [exercises, filter, searchQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* 弹出面板 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-neutral-900 border-t border-white/10 rounded-t-[2.5rem] flex flex-col h-[75vh] shadow-2xl overflow-hidden pointer-events-auto"
            // 防止触摸事件穿透到背景
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* 顶部指示条 */}
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mt-4 shrink-0 mb-2 opacity-50" />

            {/* 头部 */}
            <div className="px-6 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-white">{title}</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">选择一个动作插入到当前进度之后</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors btn-scale"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 搜索框 */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="搜索动作名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* 分类过滤器 */}
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                {targets.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      filter === t
                        ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 动作列表 - 滚动区域 */}
            <div 
              ref={listRef}
              className="flex-1 overflow-y-auto px-6 pb-20 space-y-3 custom-scrollbar touch-pan-y overscroll-contain"
            >
              {filteredExercises.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4">🔍</div>
                  <p className="text-neutral-500 text-sm">没有找到匹配的动作</p>
                </div>
              ) : (
                filteredExercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => onSelect(ex.id)}
                    className="w-full flex items-center justify-between p-4 bg-neutral-800/40 hover:bg-neutral-800 border border-white/5 rounded-2xl transition-all active:scale-[0.98] group"
                  >
                    <div className="text-left flex items-center gap-4">
                      {/* 图标/缩略图占位 */}
                      <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center text-xl shrink-0 group-hover:border-primary/30 transition-colors">
                        {ex.target === '有氧' ? '🏃' : '💪'}
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-primary transition-colors">{ex.name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {ex.target} · {ex.sets}组 × {ex.reps}
                        </div>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      <Plus size={20} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExercisePicker;
