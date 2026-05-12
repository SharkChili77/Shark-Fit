import { useState, useMemo, memo, useEffect } from 'react';
import { 
  Plus, Trash2, ChevronDown, ChevronUp, Check, X, TrendingUp, Edit3, RotateCcw, 
  AlertTriangle, Calendar, ChevronRight, ArrowUp, ArrowDown, Settings2, Info,
  ChevronLeft, Trophy, Search, GripVertical, ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence, useIsPresent, Reorder, useDragControls } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import useFitnessStore from '../store/useFitnessStore';
import ExercisePicker from '../components/ExercisePicker';
import { getDynamicRoutineName } from '../utils/routineUtils';
// ─── 性能优化点 1：剥离 Recharts 渲染为独立 Memo 组件 ───────────────────
// 这样在动作列表挂载时，不会在主线程计算和准备 SVG DOM。只有在真展开时才实例化。
const ExerciseChart = memo(({ exerciseId, history }) => {
  const chartData = useMemo(() => {
    const data = [];
    history.forEach(day => {
      const w = day.workouts.find(wk => wk.exerciseId === exerciseId);
      if (w && w.sets.length > 0) {
        const maxW = Math.max(...w.sets.map(s => s.weight));
        data.push({ date: day.date.substring(5), weight: maxW });
      }
    });
    return data.slice(-10);
  }, [history, exerciseId]);

  if (chartData.length <= 1) {
    return (
      <div className="text-xs text-neutral-500 text-center py-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
        暂无足够的历史打卡记录来生成图表
      </div>
    );
  }

  return (
    <div className="h-32 w-full">
      <div className="flex items-center gap-1 text-xs text-neutral-500 mb-2 font-bold tracking-wider uppercase">
        <TrendingUp size={12} /> <span>重量趋势 (kg)</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="date" stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis domain={['auto', 'auto']} hide />
          <RechartsTooltip 
            contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#39ff14' }}
          />
          <Line type="monotone" dataKey="weight" stroke="#39ff14" strokeWidth={3} dot={{ r: 4, fill: '#171717', strokeWidth: 2 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
ExerciseChart.displayName = 'ExerciseChart';

// ─── 性能优化点 2：列表子组件 ──────────────────────────────────────────
// 将单个项抽离，通过 useIsPresent 判断，如果发生路由跳转等卸载行为，立刻截断内部繁重状态
const ExerciseListItem = memo(({ ex, isExpanded, onToggle, onRemove, history }) => {
  const { updateExercise } = useFitnessStore();
  const isPresent = useIsPresent();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...ex });

  const handleSave = (e) => {
    e.stopPropagation();
    updateExercise(ex.id, editData);
    setIsEditing(false);
  };

  const itemVariants = {
    hidden: { opacity: 1, y: 0 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div 
      variants={itemVariants} 
      style={{ willChange: "transform, opacity" }}
      className={`bg-surface rounded-xl border overflow-hidden group transition-all ${isEditing ? 'border-primary/50 ring-1 ring-primary/20' : 'border-neutral-800'}`}
    >
      {!isEditing ? (
        <div 
          onClick={() => onToggle(ex.id)}
          className="p-4 flex justify-between items-start cursor-pointer active:bg-neutral-800/50"
        >
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white">{ex.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">{ex.target}</span>
            </div>
            <div className="text-xs text-neutral-500 font-mono mb-1">
              {ex.sets}组 × {ex.reps}次 | 休息 {ex.rest}s
            </div>
            {ex.notes && (
              <div className="text-xs text-neutral-400 line-clamp-1 mt-1">
                {ex.notes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-2 text-neutral-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors mt-1 btn-scale"
            >
              <Edit3 size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(ex.id); }}
              className="p-2 text-neutral-600 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors mt-1 btn-scale"
            >
              <Trash2 size={16} />
            </button>
            <div className="text-neutral-500 p-2">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
             <input 
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm font-bold focus:border-primary outline-none"
              value={editData.name} 
              onChange={e => setEditData({...editData, name: e.target.value})}
            />
            <span className="text-[10px] px-2 py-1 rounded bg-neutral-800 text-neutral-400">{ex.target}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-600">组数</label>
              <input type="number" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs" value={editData.sets} onChange={e => setEditData({...editData, sets: Number(e.target.value)})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-600">次数</label>
              <input className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs" value={editData.reps} onChange={e => setEditData({...editData, reps: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-600">休息</label>
              <input type="number" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs" value={editData.rest} onChange={e => setEditData({...editData, rest: Number(e.target.value)})} />
            </div>
          </div>
          <textarea 
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs outline-none focus:border-primary"
            placeholder="备注..."
            value={editData.notes}
            onChange={e => setEditData({...editData, notes: e.target.value})}
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 bg-primary text-white text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1">
              <Check size={14} /> 保存
            </button>
            <button onClick={() => setIsEditing(false)} className="flex-1 bg-neutral-800 text-neutral-400 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1">
              <X size={14} /> 取消
            </button>
          </div>
        </div>
      )}
      
      {/* 展开/收起区 */}
      <AnimatePresence>
        {isExpanded && !isEditing && isPresent && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 overflow-hidden"
          >
            <div className="border-t border-neutral-800/50 pt-4 pb-4">
              <ExerciseChart exerciseId={ex.id} history={history} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
ExerciseListItem.displayName = 'ExerciseListItem';

// ─── 性能优化点 3：周计划动作拖拽项 ─────────────────────────────────────────
const RoutineReorderItem = memo(({ 
  exId, ex, expandedRoutineExId, setExpandedRoutineExId, 
  setInsertingAtIndex, reorderingIds, setShowRoutinePicker, 
  toggleRoutineExercise, selectedRoutineDay 
}) => {
  const controls = useDragControls();

  return (
    <Reorder.Item 
      value={exId}
      dragControls={controls}
      dragListener={false} // 关闭默认的整行拖拽
      onClick={() => setExpandedRoutineExId(expandedRoutineExId === exId ? null : exId)}
      className={`bg-surface border ${expandedRoutineExId === exId ? 'border-primary/50 shadow-lg shadow-primary/5' : 'border-neutral-800/80'} rounded-2xl p-4 transition-all select-none group relative cursor-pointer`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div 
            className="p-1 text-neutral-700 group-hover:text-neutral-500 cursor-grab active:cursor-grabbing touch-none" 
            onPointerDown={(e) => controls.start(e)}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={20} />
          </div>
          <div>
            <div className="font-bold text-white group-hover:text-primary transition-colors">{ex.name}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">{ex.target} · {ex.sets}组</div>
          </div>
        </div>
        <div className={`transition-transform duration-300 ${expandedRoutineExId === exId ? 'rotate-180 text-primary' : 'text-neutral-600'}`}>
          <ChevronDown size={20} />
        </div>
      </div>

      <AnimatePresence>
        {expandedRoutineExId === exId && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => { setInsertingAtIndex(reorderingIds.indexOf(exId)); setShowRoutinePicker(true); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all"
              >
                <Plus size={16} /> 下方插入动作
              </button>
              <button 
                onClick={() => toggleRoutineExercise(selectedRoutineDay, exId)} 
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-danger/10 hover:bg-danger/20 text-danger rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 size={16} /> 移除动作
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
});
RoutineReorderItem.displayName = 'RoutineReorderItem';

const ExerciseLib = () => {
  const { 
    exercises, routines, history, trash, addExercise, removeExercise, 
    updateRoutine, restoreExercise, permanentDelete, reorderRoutineExercise,
    swapRoutineDays
  } = useFitnessStore();

  const [activeTab, setActiveTab] = useState('exercises'); 
  const [filter, setFilter] = useState('全部'); 
  const [expandedExId, setExpandedExId] = useState(null); 
  
  const [isAdding, setIsAdding] = useState(false);
  const [newEx, setNewEx] = useState({ name: '', target: '胸', sets: 4, reps: '8-12', rest: 60, imageUrl: '', notes: '' });

  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    id: null, 
    type: 'trash',
    extra: null
  }); 
  
  const [selectedRoutineDay, setSelectedRoutineDay] = useState(null);
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [routineFilter, setRoutineFilter] = useState('全部');
  const [isSwapping, setIsSwapping] = useState(false);
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [insertingAtIndex, setInsertingAtIndex] = useState(null);

  const [reorderingIds, setReorderingIds] = useState([]);
  const [expandedRoutineExId, setExpandedRoutineExId] = useState(null); // 🆕 用于控制周计划中哪个动作处于展开操作态

  const targets = ['胸', '背', '肩', '腿', '二头', '三头', '腹部', '核心', '小腿', '有氧'];
  const allFilters = ['全部', ...targets];
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  useEffect(() => {
    if (selectedRoutineDay !== null) {
      const routine = routines.find(r => r.dayOfWeek === selectedRoutineDay);
      setReorderingIds(routine?.exerciseIds || []);
    }
  }, [selectedRoutineDay, routines]);

  const handleReorderComplete = (newIds) => {
    setReorderingIds(newIds);
    updateRoutine(selectedRoutineDay, newIds);
  };

  const filteredExercises = useMemo(() => {
    if (filter === '全部') return exercises;
    return exercises.filter(ex => ex.target === filter);
  }, [exercises, filter]);

  const availableExercisesForRoutine = useMemo(() => {
    const currentIds = routines.find(r => r.dayOfWeek === selectedRoutineDay)?.exerciseIds || [];
    return exercises.filter(ex => {
      const notAdded = !currentIds.includes(ex.id);
      const matchFilter = routineFilter === '全部' || ex.target === routineFilter;
      const matchSearch = ex.name.toLowerCase().includes(routineSearchQuery.toLowerCase());
      return notAdded && matchFilter && matchSearch;
    });
  }, [exercises, routines, selectedRoutineDay, routineFilter, routineSearchQuery]);

  const handleDeleteRequest = (id, type = 'trash', extra = null) => {
    setConfirmModal({ isOpen: true, id, type, extra });
  };

  const handleConfirmDelete = () => {
    if (confirmModal.id) {
      if (confirmModal.type === 'permanent') {
        permanentDelete(confirmModal.id);
      } else if (confirmModal.type === 'routine_remove') {
        const dayOfWeek = confirmModal.extra.dayOfWeek;
        const exerciseId = confirmModal.id;
        const routine = routines.find(r => r.dayOfWeek === dayOfWeek);
        if (routine) {
          const newIds = routine.exerciseIds.filter(id => id !== exerciseId);
          updateRoutine(dayOfWeek, newIds);
        }
      } else {
        removeExercise(confirmModal.id);
      }
      setConfirmModal({ isOpen: false, id: null, type: 'trash', extra: null });
    }
  };

  const handleAdd = () => {
    if (!newEx.name) return;
    addExercise(newEx);
    setIsAdding(false);
    setNewEx({ name: '', target: '胸', sets: 4, reps: '8-12', rest: 60, imageUrl: '', notes: '' });
  };

  const toggleRoutineExercise = (dayOfWeek, exerciseId) => {
    const routine = routines.find(r => r.dayOfWeek === dayOfWeek);
    if (!routine) return;
    
    let newIds = [...routine.exerciseIds];
    if (newIds.includes(exerciseId)) {
      // 如果已存在，则触发确认弹窗
      handleDeleteRequest(exerciseId, 'routine_remove', { dayOfWeek });
    } else {
      newIds.push(exerciseId);
      updateRoutine(dayOfWeek, newIds);
    }
  };

  /**
   * 🆕 从选择器中插入动作到周计划
   */
  const handleInsertFromPicker = (exerciseId) => {
    const routine = routines.find(r => r.dayOfWeek === selectedRoutineDay);
    if (!routine) return;

    const newIds = [...routine.exerciseIds];
    if (insertingAtIndex === null) {
      // 如果没有指定位置，默认加到最后
      newIds.push(exerciseId);
    } else {
      // 插入到指定位置的下方
      newIds.splice(insertingAtIndex + 1, 0, exerciseId);
    }

    updateRoutine(selectedRoutineDay, newIds);
    setShowRoutinePicker(false);
    setInsertingAtIndex(null);
  };

  const handleToggleEx = (id) => {
    setExpandedExId(prev => prev === id ? null : id);
  };

  // 交错动画容器配置
  const containerVariants = {
    hidden: { opacity: 1 },
    show: { 
      opacity: 1, 
    }
  };

  return (
    <div className="pb-6">
      <h1 className="text-3xl font-black mb-6 text-white">动作库 & 计划</h1>
      
      {/* 顶部 Tabs */}
      <div className="flex bg-neutral-900 rounded-lg p-1 mb-6">
        <button 
          onClick={() => { setActiveTab('exercises'); setSelectedRoutineDay(null); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'exercises' ? 'bg-surface text-primary shadow-lg ring-1 ring-white/5' : 'text-neutral-500'}`}
        >
          动作库
        </button>
        <button 
          onClick={() => setActiveTab('routines')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'routines' ? 'bg-surface text-primary shadow-lg ring-1 ring-white/5' : 'text-neutral-500'}`}
        >
          每周计划
        </button>
        <button 
          onClick={() => { setActiveTab('trash'); setSelectedRoutineDay(null); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'trash' ? 'bg-surface text-primary shadow-lg ring-1 ring-white/5' : 'text-neutral-500'}`}
        >
          回收站
        </button>
      </div>

      {activeTab === 'exercises' && (
        <div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-4 transition-colors"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            {isAdding ? '取消添加' : '新增自定义动作'}
          </button>

          {isAdding && (
            <div className="bg-surface p-4 rounded-xl border border-primary/50 mb-6 space-y-4 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              {/* 表单部分保持不变 */}
              <input 
                type="text" placeholder="动作名称 (如: 杠铃卧推)" 
                value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {targets.map(t => (
                  <button 
                    key={t} onClick={() => setNewEx({...newEx, target: t})}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${newEx.target === t ? 'bg-primary border-primary text-white' : 'border-neutral-700 text-neutral-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">组数</label>
                  <input type="number" value={newEx.sets} onChange={e => setNewEx({...newEx, sets: Number(e.target.value)})} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">次数</label>
                  <input type="text" value={newEx.reps} onChange={e => setNewEx({...newEx, reps: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">休息(秒)</label>
                  <input type="number" value={newEx.rest} onChange={e => setNewEx({...newEx, rest: Number(e.target.value)})} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">细节与注意事项 (选填)</label>
                <textarea 
                  rows="2"
                  value={newEx.notes} 
                  onChange={e => setNewEx({...newEx, notes: e.target.value})} 
                  placeholder="例如: 保持核心收紧..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus:border-primary focus:outline-none resize-none text-sm" 
                />
              </div>
              <button onClick={handleAdd} className="w-full bg-primary text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                <Check size={18} /> 保存动作
              </button>
            </div>
          )}

          {/* 动作分类过滤器 */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide -mx-4 px-4">
            {allFilters.map(t => (
              <button 
                key={t}
                onClick={() => { setFilter(t); setExpandedExId(null); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  filter === t 
                    ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                }`}
              >
                {t}
                {t !== '全部' && (
                  <span className="ml-1.5 opacity-50 text-[10px]">
                    {exercises.filter(ex => ex.target === t).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {filteredExercises.length === 0 ? (
              <div className="text-center py-20 text-neutral-600 text-sm">
                该分类下暂无动作
              </div>
            ) : (
              filteredExercises.map(ex => (
                <ExerciseListItem 
                  key={ex.id}
                  ex={ex}
                  isExpanded={expandedExId === ex.id}
                  onToggle={handleToggleEx}
                  onRemove={(id) => handleDeleteRequest(id, 'trash')}
                  history={history}
                />
              ))
            )}
          </motion.div>
        </div>
      )}

      {activeTab === 'trash' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-4">
            <AlertTriangle size={14} />
            <span>回收站中的动作可以在此还原或永久删除</span>
          </div>
          {trash.length === 0 ? (
            <div className="text-center py-20 text-neutral-600">
              回收站是空的
            </div>
          ) : (
            trash.map(ex => (
              <div key={ex.id} className="bg-surface/40 border border-neutral-800 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-neutral-400">{ex.name}</div>
                  <div className="text-[10px] text-neutral-600">{ex.target} · {ex.sets}组</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => restoreExercise(ex.id)}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all btn-scale"
                    title="还原"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteRequest(ex.id, 'permanent')}
                    className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-all btn-scale"
                    title="彻底删除"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* 删除确认 Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ isOpen: false, id: null })}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {confirmModal.type === 'permanent' ? '永久删除动作？' : '删除动作？'}
              </h2>
              <p className="text-neutral-400 text-sm mb-6">
                {confirmModal.type === 'permanent' ? '此操作将无法撤销，该动作及其所有历史记录都将被永久抹去。' : 
                 confirmModal.type === 'routine_remove' ? '该动作将从当天的训练计划中移除，你随时可以重新添加。' : 
                 '该动作将移至回收站，你可以随时在回收站中找回它。'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-danger text-white font-bold rounded-xl active:scale-95 transition-transform"
                >
                  {confirmModal.type === 'routine_remove' ? '确认移除' : '确认删除'}
                </button>
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, id: null })}
                  className="flex-1 py-3 bg-neutral-800 text-white font-bold rounded-xl active:scale-95 transition-transform"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === 'routines' && (
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedRoutineDay === null ? (
              <motion.div key="routine-list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid gap-4">
                <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2 px-1">
                  <Info size={14} className="text-primary" />
                  <span>点击训练日进入详情调整顺序或跨天交换计划</span>
                </div>
                {routines.map(routine => (
                  <div key={routine.dayOfWeek} className="relative">
                    <div 
                      onClick={() => setSelectedRoutineDay(routine.dayOfWeek)} 
                      className="w-full bg-surface border border-neutral-800 rounded-[2rem] p-5 flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all hover:border-primary/30 shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl ${routine.exerciseIds.length > 0 ? 'bg-primary/10 text-primary shadow-inner shadow-primary/5' : 'bg-neutral-800 text-neutral-600'}`}>
                          {days[routine.dayOfWeek].charAt(1)}
                        </div>
                        <div className="text-left">
                          <div className="font-black text-white group-hover:text-primary transition-colors text-lg tracking-tight">{days[routine.dayOfWeek]} · {getDynamicRoutineName(routine, exercises)}</div>
                          <div className="text-xs text-neutral-500 mt-1 line-clamp-1 max-w-[200px]">
                            {routine.exerciseIds.length > 0 
                              ? `${routine.exerciseIds.length} 个动作: ${routine.exerciseIds.map(id => exercises.find(e => e.id === id)?.name).filter(Boolean).join('、')}`
                              : '🧘 这是一个休息日'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsSwapping(routine.dayOfWeek); }}
                          className="flex items-center gap-0 hover:gap-2 px-2 hover:px-4 py-2 rounded-full hover:bg-primary/10 text-neutral-600 hover:text-primary transition-all duration-500 group/swap overflow-hidden"
                        >
                          <ArrowLeftRight size={18} className="group-hover/swap:rotate-180 transition-transform duration-700" />
                          <span className="text-[0px] group-hover/swap:text-[11px] font-black uppercase tracking-widest transition-all duration-500 opacity-0 group-hover/swap:opacity-100 whitespace-nowrap">计划互换</span>
                        </button>
                        <div className="p-2.5 rounded-2xl bg-neutral-900 group-hover:bg-primary/10 text-neutral-700 group-hover:text-primary transition-all duration-300">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div key="routine-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex items-center justify-between bg-neutral-900/50 p-4 rounded-3xl border border-white/5">
                  <button onClick={() => setSelectedRoutineDay(null)} className="flex items-center gap-1.5 text-sm font-bold text-neutral-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} /> 返回
                  </button>
                  <div className="text-xl font-black text-white tracking-tight">{days[selectedRoutineDay]}计划管理</div>
                  <button 
                    onClick={() => setIsSwapping(selectedRoutineDay)} 
                    className="p-3 text-neutral-500 hover:text-primary hover:bg-white/5 rounded-2xl transition-all active:scale-90"
                  >
                    <ArrowLeftRight size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Settings2 size={12} /> 当前动作与排序
                    </span>
                    <span className="text-[10px] text-primary bg-primary/10 px-2.5 py-1 rounded-full font-bold">长按手柄拖拽排序</span>
                  </div>
                  {reorderingIds.length === 0 ? (
                    <div className="bg-neutral-900/40 border border-dashed border-neutral-800 rounded-[2rem] py-14 text-center">
                      <div className="text-3xl mb-3 opacity-30">🧘</div>
                      <p className="text-neutral-500 text-sm font-medium">这是一个休息日</p>
                    </div>
                  ) : (
                    <Reorder.Group 
                      axis="y" 
                      values={reorderingIds} 
                      onReorder={handleReorderComplete}
                      className="space-y-2.5"
                    >
                      {reorderingIds.map((exId) => {
                        const ex = exercises.find(e => e.id === exId);
                        if (!ex) return null;
                        return (
                          <RoutineReorderItem 
                            key={exId}
                            exId={exId}
                            ex={ex}
                            expandedRoutineExId={expandedRoutineExId}
                            setExpandedRoutineExId={setExpandedRoutineExId}
                            setInsertingAtIndex={setInsertingAtIndex}
                            reorderingIds={reorderingIds}
                            setShowRoutinePicker={setShowRoutinePicker}
                            toggleRoutineExercise={toggleRoutineExercise}
                            selectedRoutineDay={selectedRoutineDay}
                          />
                        );
                      })}
                    </Reorder.Group>
                  )}
                  
                  {/* 🆕 列表底部的添加按钮 */}
                  <button 
                    onClick={() => { setInsertingAtIndex(null); setShowRoutinePicker(true); }}
                    className="w-full py-4 bg-neutral-900/50 border border-dashed border-neutral-800 rounded-2xl flex items-center justify-center gap-2 text-neutral-500 hover:text-primary hover:border-primary/30 transition-all group mt-2"
                  >
                    <Plus size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold">添加训练动作</span>
                  </button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
          
          {/* 🆕 动作选择弹窗 */}
          <ExercisePicker 
            isOpen={showRoutinePicker}
            onClose={() => setShowRoutinePicker(false)}
            onSelect={handleInsertFromPicker}
            title={insertingAtIndex !== null ? "插入新动作" : "添加到训练计划"}
          />
        </div>
      )}

      {/* 🆕 交换日期弹窗 */}
      <AnimatePresence>
        {isSwapping !== false && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSwapping(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[30px]" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 40 }} 
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative w-[calc(100%-2rem)] max-w-md bg-neutral-900/60 border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl max-h-[90vh] flex flex-col"
            >
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6 md:mb-10">
                  <div className="flex flex-col">
                    <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter mb-1">计划互换</h2>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Select Target Day</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSwapping(false)} 
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-90"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3 overflow-y-auto pr-1 custom-scrollbar max-h-[50vh] md:max-h-none">
                  {days.map((d, i) => (
                    <motion.button
                      key={d}
                      whileHover={{ scale: i === isSwapping ? 1 : 1.02 }}
                      whileTap={{ scale: i === isSwapping ? 1 : 0.98 }}
                      disabled={i === isSwapping}
                      onClick={() => { swapRoutineDays(isSwapping, i); setIsSwapping(false); if (selectedRoutineDay !== null) setSelectedRoutineDay(i); }}
                      className={`relative group h-24 md:h-32 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5 text-left transition-all duration-500 overflow-hidden ${
                        i === isSwapping 
                        ? 'bg-primary/5 border border-primary/20 cursor-default' 
                        : 'bg-neutral-800/40 hover:bg-neutral-800 border border-white/5 hover:border-primary/40'
                      }`}
                    >
                      <span className="absolute -right-1 -bottom-4 md:-right-2 md:-bottom-6 text-6xl md:text-8xl font-black text-white/[0.03] select-none italic group-hover:text-primary/[0.05] transition-colors">
                        {d.charAt(1)}
                      </span>
                      
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between">
                          <span className={`text-base md:text-lg font-black tracking-tight transition-colors ${i === isSwapping ? 'text-primary' : 'text-neutral-400 group-hover:text-white'}`}>
                            {d}
                          </span>
                          {i === isSwapping && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        
                        <div>
                          {routines[i].exerciseIds.length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-neutral-600 group-hover:text-primary/70 transition-colors">
                                {routines[i].exerciseIds.length} Movs
                              </div>
                            </div>
                          ) : (
                            <span className="text-[8px] md:text-[10px] font-bold text-neutral-700 italic">Rest</span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                  
                  <div className="col-span-2 mt-2 md:mt-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-primary text-black flex items-center justify-center">
                        <ArrowLeftRight size={14} />
                      </div>
                      <div className="text-left">
                        <div className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-widest">Swap Source</div>
                        <div className="text-xs md:text-sm font-bold text-white">{days[isSwapping]}</div>
                      </div>
                    </div>
                    <div className="text-[8px] md:text-[10px] font-bold text-neutral-500">Pick target</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExerciseLib;
