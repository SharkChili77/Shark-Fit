import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Scale, BarChart3, 
  Plus, ArrowLeft, Trophy, Flame
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subMonths, parseISO, startOfWeek } from 'date-fns';
import useFitnessStore from '../store/useFitnessStore';
import { useNavigate } from 'react-router-dom';

const AnalyticsHub = () => {
  const navigate = useNavigate();
  const { exercises, history, bodyWeight, addBodyWeight, isPulling, pullData } = useFitnessStore();
  
  // ── 状态管理 ──────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState('3m');
  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0]?.id || '');
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [volumeViewMode, setVolumeViewMode] = useState('weight'); // 'weight' or 'sets'
  const [hiddenMuscles, setHiddenMuscles] = useState([]);

  // 当动作库加载后，如果没有选中动作，则默认选中第一个
  useEffect(() => {
    if (!selectedExerciseId && exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id);
    }
  }, [exercises, selectedExerciseId]);

  // ── 时间范围过滤 ──────────────────────────────────────────────────────
  const dateLimit = useMemo(() => {
    const now = new Date();
    if (timeRange === '1m') return subMonths(now, 1);
    if (timeRange === '3m') return subMonths(now, 3);
    if (timeRange === '6m') return subMonths(now, 6);
    return new Date(0);
  }, [timeRange]);

  const isInRange = (dateStr) => {
    try { return parseISO(dateStr) >= dateLimit; } 
    catch { return false; }
  };

  // ── 1. 力量增长趋势数据 ──────────────────────────────────────────────
  const strengthData = useMemo(() => {
    if (!selectedExerciseId) return [];
    return history
      .filter(day => isInRange(day.date))
      .map(day => {
        const workout = day.workouts.find(w => w.exerciseId === selectedExerciseId);
        if (!workout || workout.sets.length === 0) return null;
        const maxW = Math.max(...workout.sets.map(s => s.weight));
        const bestSet = workout.sets.reduce((best, s) => s.weight > best.weight ? s : best, workout.sets[0]);
        const est1RM = bestSet.reps > 0 ? bestSet.weight / (1.0278 - 0.0278 * bestSet.reps) : bestSet.weight;
        return {
          dateKey: day.date,
          date: day.date,
          displayDate: format(parseISO(day.date), 'MM/dd'),
          weight: maxW,
          oneRM: Math.round(est1RM * 10) / 10
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [history, selectedExerciseId, dateLimit]);

  // ── 2. 体重趋势数据 ──────────────────────────────────────────────────
  const weightData = useMemo(() => {
    return bodyWeight
      .filter(bw => isInRange(bw.date))
      .map(bw => ({
        ...bw,
        displayDate: format(parseISO(bw.date), 'MM/dd'),
        hasWorkout: history.some(h => h.date === bw.date && h.workouts.length > 0)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyWeight, history, dateLimit]);

  // ── 3. 训练容量分布 (按日聚合，按肌群堆叠) ──────────────────────────
  const volumeData = useMemo(() => {
    const days = {};
    history.forEach(day => {
      if (!isInRange(day.date)) return;
      const dateKey = day.date;
      if (!days[dateKey]) {
        days[dateKey] = { 
          dateKey,
          displayDate: format(parseISO(dateKey), 'MM/dd'),
          totalWeight: 0,
          totalSets: 0
        };
      }
      day.workouts.forEach(w => {
        const exercise = exercises.find(ex => ex.id === w.exerciseId);
        const target = exercise?.target || '其他';
        const weightSum = w.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
        const setNum = w.sets.length;

        // 初始化该肌群的统计
        if (!days[dateKey][`${target}_weight`]) days[dateKey][`${target}_weight`] = 0;
        if (!days[dateKey][`${target}_sets`]) days[dateKey][`${target}_sets`] = 0;

        days[dateKey][`${target}_weight`] += weightSum;
        days[dateKey][`${target}_sets`] += setNum;
        days[dateKey].totalWeight += weightSum;
        days[dateKey].totalSets += setNum;
      });
    });
    return Object.values(days).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [history, exercises, dateLimit]);

  // ── 4. 概览指标汇总 ──────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalVolume = history
      .filter(day => isInRange(day.date))
      .reduce((acc, day) => acc + day.workouts.reduce((sum, w) => sum + w.sets.reduce((sAcc, s) => sAcc + s.weight * s.reps, 0), 0), 0);
    const prCount = history
      .filter(day => isInRange(day.date))
      .reduce((acc, day) => acc + day.workouts.reduce((sum, w) => sum + w.sets.filter(s => s.isPR).length, 0), 0);
    return { volume: Math.round(totalVolume / 1000), prCount };
  }, [history, dateLimit]);

  // ── 体重录入 ──────────────────────────────────────────────────────────
  const handleWeightSubmit = async () => {
    if (!weightInput || !dateInput) return;
    await addBodyWeight(parseFloat(weightInput), dateInput);
    setIsWeightModalOpen(false);
    setWeightInput('');
  };

  // 获取所有出现的肌群，用于堆叠柱状图
  const muscleGroups = useMemo(() => {
    return Array.from(new Set(exercises.map(ex => ex.target)));
  }, [exercises]);

  const muscleColorMap = {
    '胸': '#ef4444',    // 红色
    '背': '#10b981',    // 绿色
    '肩': '#8b5cf6',    // 紫色
    '腿': '#f59e0b',    // 橙黄色
    '二头': '#3b82f6',  // 蓝色
    '三头': '#06b6d4',  // 青色
    '腹部': '#ec4899',  // 粉色
    '核心': '#ec4899',
    '其他': '#737373'   // 灰色
  };

  const getMuscleColor = (name) => muscleColorMap[name] || '#14b8a6';

  const toggleMuscle = (name) => {
    setHiddenMuscles(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  // 空状态组件
  const EmptyChart = ({ message }) => (
    <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
      {message || '暂无数据，开始训练后这里将展示你的进步轨迹'}
    </div>
  );

  return (
    <div className="space-y-5 pb-28">
      {/* ── 头部 ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors active:scale-95"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">返回</span>
        </button>
        <div className="flex bg-neutral-900 p-1 rounded-xl border border-white/5">
          {[
            { key: '1m', label: '1月' },
            { key: '3m', label: '3月' },
            { key: '6m', label: '半年' },
            { key: 'all', label: '全部' },
          ].map(r => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === r.key 
                  ? 'bg-primary text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-black text-white">📊 分析中心</h1>
        {isPulling && (
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="text-primary"
          >
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
          </motion.div>
        )}
      </div>

      {/* ── 概览卡片 (两列并排) ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Trophy size={12} className="text-primary" /> 总容量
          </div>
          <div className="text-2xl font-black text-white">
            {summary.volume} <span className="text-xs font-normal text-neutral-500">吨</span>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Flame size={12} className="text-orange-500" /> 新记录
          </div>
          <div className="text-2xl font-black text-white">
            {summary.prCount} <span className="text-xs font-normal text-neutral-500">PR</span>
          </div>
        </div>
      </div>

      {/* ── 力量增长图表 ────────────────────────────────────────────── */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <TrendingUp size={16} className="text-primary" /> 力量增长
          </div>
        </div>
        <select 
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-neutral-300 mb-4 focus:outline-none focus:border-primary/50 appearance-none"
        >
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name} ({ex.target})</option>
          ))}
        </select>
        
        <div style={{ width: '100%', height: '220px' }}>
          {strengthData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={strengthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="displayDate" stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#525252" fontSize={10} tickLine={false} axisLine={false} unit="kg" width={40} />
                <Tooltip 
                  formatter={(value) => [`${value} kg`, '']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(23, 23, 23, 0.8)', 
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '12px', 
                    fontSize: '11px' 
                  }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  name="最大重量"
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} 
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="oneRM" 
                  name="估算 1RM"
                  stroke="#3b82f6" 
                  strokeWidth={1.5} 
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="选择动作后将展示力量增长趋势" />
          )}
        </div>
        {strengthData.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-neutral-500 justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div> 当日最大重量</div>
            <div className="flex items-center gap-1"><div className="w-6 h-0 border-t border-dashed border-blue-500"></div> 估算 1RM</div>
          </div>
        )}
      </div>

      {/* ── 体重监控图表 ────────────────────────────────────────────── */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Scale size={16} className="text-blue-500" /> 体重趋势
          </div>
          <button 
            onClick={() => setIsWeightModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-lg active:scale-95 transition-all border border-blue-500/20"
          >
            <Plus size={14} /> 记录
          </button>
        </div>

        <div style={{ width: '100%', height: '200px' }}>
          {weightData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="displayDate" stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#525252" fontSize={10} tickLine={false} axisLine={false} unit="kg" width={40} />
                <Tooltip 
                  formatter={(value) => [`${value} kg`, '体重']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(23, 23, 23, 0.8)', 
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '12px', 
                    fontSize: '11px' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="weight" 
                  name="体重"
                  stroke="#3b82f6" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorWeight)" 
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle 
                        cx={cx} cy={cy} 
                        r={payload.hasWorkout ? 4 : 2} 
                        fill={payload.hasWorkout ? '#10b981' : '#3b82f6'} 
                        stroke="none" 
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="点击右上角 '+' 开始记录体重" />
          )}
        </div>
        {weightData.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-neutral-500 justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> 体重</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div> 训练日</div>
          </div>
        )}
      </div>

      {/* ── 容量分布图表 ────────────────────────────────────────────── */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <BarChart3 size={16} className="text-purple-500" /> 训练负荷分析
          </div>
          <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-white/5">
            <button 
              onClick={() => setVolumeViewMode('weight')}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${volumeViewMode === 'weight' ? 'bg-purple-500 text-white' : 'text-neutral-500'}`}
            >
              容量
            </button>
            <button 
              onClick={() => setVolumeViewMode('sets')}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${volumeViewMode === 'sets' ? 'bg-purple-500 text-white' : 'text-neutral-500'}`}
            >
              组数
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: '260px' }}>
          {volumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="displayDate" stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#525252" fontSize={10} tickLine={false} axisLine={false} width={45} />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name.includes('total')) return [null, null];
                    const muscleName = name.replace(`_${volumeViewMode}`, '');
                    return value > 0 ? [`${value} ${volumeViewMode === 'weight' ? 'kg' : '组'}`, muscleName] : [null, null];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(23, 23, 23, 0.8)', 
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '12px', 
                    fontSize: '11px' 
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Legend 
                  onClick={(e) => toggleMuscle(e.dataKey.replace(`_${volumeViewMode}`, ''))}
                  content={(props) => {
                    const { payload } = props;
                    if (!payload) return null;
                    return (
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-4">
                        {payload.filter(p => p.dataKey && !p.dataKey.includes('total')).map((entry, index) => {
                          const muscleName = entry.dataKey.replace(`_${volumeViewMode}`, '');
                          const isHidden = hiddenMuscles.includes(muscleName);
                          return (
                            <div 
                              key={`item-${index}`}
                              onClick={() => toggleMuscle(muscleName)}
                              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${isHidden ? 'opacity-30' : 'opacity-100'}`}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                              <span className="text-[10px] text-neutral-400 font-bold">{muscleName}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {muscleGroups.map((target) => (
                  <Bar 
                    key={target} 
                    dataKey={`${target}_${volumeViewMode}`} 
                    stackId="a" 
                    hide={hiddenMuscles.includes(target)}
                    fill={getMuscleColor(target)} 
                    radius={[0, 0, 0, 0]} 
                    barSize={20}
                  />
                ))}
                {/* 总量趋势线 */}
                <Line 
                  type="monotone" 
                  dataKey={volumeViewMode === 'weight' ? 'totalWeight' : 'totalSets'} 
                  stroke="#ffffff" 
                  strokeWidth={1} 
                  dot={{ r: 2, fill: '#fff' }}
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="训练数据积累后将展示各肌群容量分布" />
          )}
        </div>
      </div>

      {/* ── 体重录入弹窗 ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isWeightModalOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWeightModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Scale className="text-blue-500" size={20} /> 记录体重
              </h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1.5">体重 (kg)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    autoFocus
                    placeholder="例如 75.5"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-xl font-black text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1.5">日期</label>
                  <input 
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleWeightSubmit}
                  disabled={!weightInput}
                  className="flex-1 py-3.5 bg-blue-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-30"
                >
                  确认
                </button>
                <button 
                  onClick={() => setIsWeightModalOpen(false)}
                  className="flex-1 py-3.5 bg-neutral-800 text-white font-bold rounded-2xl active:scale-[0.98] transition-all"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalyticsHub;
