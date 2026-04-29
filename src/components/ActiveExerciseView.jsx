import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, List, Check, X, TrendingUp,
  Play, Square, Trophy, Plus
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import useFitnessStore from '../store/useFitnessStore';
import { getTodayDateString } from '../utils/dateUtils';
import ExercisePicker from './ExercisePicker';

const ActiveExerciseView = ({
  exercise,
  index,
  total,
  direction,
  onPrev,
  onNext,
  onBackToList,
  inputCache,
  onInputChange,
  onReplace,
  isTrainingMode,
  onStartWorkout,
  isActiveSession,
}) => {
  const { history, logWorkoutSet, globalTimer, startGlobalTimer, stopGlobalTimer, removeWorkoutSet, insertExerciseToRoutine, activeWorkoutSession } = useFitnessStore();
  const todayStr = getTodayDateString();
  const isLast = index === total - 1;
  const isResting = globalTimer.isActive && globalTimer.label === '组间休息';

  // ── 秒表逻辑 ────────────────────────────────────────────────────────────
  const [stopwatchActive, setStopwatchActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  const isBodyweightDefault = useMemo(() => {
    return ['有氧', '核心', '腹部'].includes(exercise.target) || 
           ['俯卧撑', '引体向上', '悬垂举腿', '卷腹', '平板支撑'].some(kw => exercise.name.includes(kw));
  }, [exercise]);

  const [showWeightInput, setShowWeightInput] = useState(!isBodyweightDefault);

  useEffect(() => {
    clearInterval(intervalRef.current);
    setStopwatchActive(false);
    setElapsed(0);
    setShowWeightInput(!isBodyweightDefault);
  }, [exercise.id, isBodyweightDefault]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const toggleStopwatch = () => {
    if (stopwatchActive) {
      clearInterval(intervalRef.current);
      setStopwatchActive(false);
    } else {
      setStopwatchActive(true);
      intervalRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── 数据与图表 ──────────────────────────────────────────────────────────
  const todayRecord = useMemo(() => {
    const day = history.find(h => h.date === todayStr);
    return day?.workouts.find(w => w.exerciseId === exercise.id) || null;
  }, [history, todayStr, exercise.id]);

  const setsLogged = todayRecord?.sets?.length ?? 0;

  const chartData = useMemo(() => {
    const data = [];
    history.forEach(day => {
      const w = day.workouts.find(wk => wk.exerciseId === exercise.id);
      if (w && w.sets.length > 0) {
        const maxW = Math.max(...w.sets.map(s => s.weight));
        data.push({ date: day.date.substring(5), weight: maxW });
      }
    });
    return data.slice(-10);
  }, [history, exercise.id]);

  // ── 音效系统 ────────────────────────────────────────────────────────────
  const playBeep = useCallback((freq = 800, duration = 0.2, vol = 0.1) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  const playSuccessSound = useCallback(() => {
    [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.4, 0.15), i * 120);
    });
  }, [playBeep]);

  // ── 杠铃片计算 ──────────────────────────────────────────────────────────
  const getPlates = (totalWeight) => {
    if (!totalWeight || totalWeight <= 20) return [];
    let sideWeight = (totalWeight - 20) / 2;
    const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
    const res = [];
    plates.forEach(p => {
      while (sideWeight >= p) { res.push(p); sideWeight -= p; }
    });
    return res;
  };

  const handleLog = () => {
    const { weight, reps } = inputCache;
    if ((showWeightInput && !weight) || !reps) return;
    logWorkoutSet(exercise.id, showWeightInput ? weight : 0, reps);
    startGlobalTimer(Number(exercise.rest) || 90, '组间休息');
  };

  const estimated1RM = useMemo(() => {
    const w = Number(inputCache.weight);
    const r = Number(inputCache.reps);
    if (w > 0 && r > 0) {
      return Math.round(w * (1 + r / 30));
    }
    return null;
  }, [inputCache.weight, inputCache.reps]);

  // ── 动作数据概览 ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let maxWeight = 0;
    let totalSets = 0;

    history.forEach(day => {
      const w = day.workouts.find(wk => wk.exerciseId === exercise.id);
      if (w) {
        w.sets.forEach(s => {
          totalSets++;
          if (s.weight > maxWeight) maxWeight = s.weight;
        });
      }
    });

    return { maxWeight, totalSets };
  }, [history, exercise.id]);

  // ── 插入动作逻辑 ────────────────────────────────────────────────────────
  const [showInsertPicker, setShowInsertPicker] = useState(false);
  const [showReplacePicker, setShowReplacePicker] = useState(false);

  const handleInsert = (targetExId) => {
    // 在当前索引的下一个位置插入
    insertExerciseToRoutine(activeWorkoutSession.selectedDay, targetExId, index + 1);
    setShowInsertPicker(false);
  };

  const handleReplace = (targetExId) => {
    if (onReplace) {
      onReplace(targetExId);
    }
    setShowReplacePicker(false);
  };

  // ── 动画定义 ────────────────────────────────────────────────────────────
  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-neutral-950 overflow-hidden">
      {/* 1. 静态顶栏 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 z-30 bg-neutral-950/80 backdrop-blur-md">
        <button onClick={onBackToList} className="flex items-center gap-1 text-sm text-neutral-400 btn-scale">
          <List size={16} /><span>总览</span>
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-primary' : i < index ? 'w-2 bg-primary/40' : 'w-2 bg-neutral-800'}`} />
          ))}
        </div>
        {isTrainingMode && (
          <button onClick={toggleStopwatch} className={`flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full border btn-scale ${stopwatchActive ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-primary text-primary'}`}>
            {stopwatchActive ? <Square size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
            {formatTime(elapsed)}
          </button>
        )}
      </div>

      {/* 2. 局部切换区 */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={exercise.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset }) => {
              if (offset.x < -80) onNext();
              else if (offset.x > 80 && index > 0) onPrev();
            }}
            className="absolute inset-0 flex flex-col px-4 pt-2 overflow-y-auto scrollbar-hide"
          >
            <div className="py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold px-2 py-0.5 bg-primary/20 text-primary rounded-full">{index+1}/{total}</span>
                <span className="text-[11px] px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded-full">{exercise.target}</span>
              </div>
              <div className="flex items-start justify-between mt-1">
                <h1 className="text-2xl font-black text-white leading-tight pr-4">{exercise.name}</h1>
                {isTrainingMode && (
                  <button onClick={() => setShowReplacePicker(true)} className="text-[11px] bg-neutral-800 text-primary border border-primary/20 px-3 py-1.5 rounded-full font-bold btn-scale shadow-sm shrink-0 mt-1">
                    替换动作
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-neutral-500 font-mono">建议: {exercise.sets}组 × {exercise.reps}次 | 休息 {exercise.rest}s</p>
                {isResting && (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-mono font-bold text-primary">{Math.floor(globalTimer.timeLeft/60)}:{ (globalTimer.timeLeft%60).toString().padStart(2,'0') }</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pb-10">
              {exercise.notes && <div className="glass-panel p-4 text-sm text-primary/90 rounded-xl border border-primary/20">{exercise.notes}</div>}
              {exercise.imageUrl && <div className="rounded-xl overflow-hidden border border-white/5"><img src={exercise.imageUrl} className="w-full h-40 object-cover" /></div>}
              
              {chartData.length > 1 && (
                <div className="glass-panel p-4 rounded-xl">
                  <div className="text-[10px] text-neutral-500 font-bold mb-3 uppercase tracking-wider">重量趋势</div>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" hide /><YAxis hide />
                        <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {todayRecord && todayRecord.sets.length > 0 && (
                <div className="glass-panel p-4 rounded-xl space-y-2">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase">今日已完成 {setsLogged} 组</div>
                  {todayRecord.sets.map((set, i) => (
                    <div key={set.id} className="flex items-center justify-between bg-neutral-900/50 rounded-lg px-3 py-2 text-sm">
                      <span className="font-bold text-white">{i+1}. {set.weight > 0 ? `${set.weight}kg × ` : ''}{set.reps}{exercise.target === '有氧' ? ' (距离/时长)' : '次'}</span>
                      <button onClick={() => removeWorkoutSet(todayStr, exercise.id, set.id)}><X size={14} className="text-neutral-600" /></button>
                    </div>
                  ))}
                </div>
              )}

              {isTrainingMode ? (
                <div className="glass-panel p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-3 text-[11px] font-bold text-neutral-500">
                    <div className="flex items-center gap-2">
                      <span>记录本组</span>
                      {estimated1RM && (
                        <span className="bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black">
                          预估 1RM: {estimated1RM}kg
                        </span>
                      )}
                    </div>
                    <button onClick={() => startGlobalTimer(Number(exercise.rest) || 90, '组间休息')} className="text-primary bg-primary/10 px-2 py-1 rounded">⏱️ 开始休息</button>
                  </div>
                  {inputCache.weight > 0 && (
                    <div className="mb-4 space-y-2 text-[10px]">
                      <div className="flex gap-2">
                        <span className="text-neutral-500">热身:</span>
                        {[0.4, 0.6].map(p => (
                          <button key={p} onClick={() => onInputChange('weight', Math.round(inputCache.weight*p/1.25)*1.25)} className="bg-neutral-800 text-white px-2 py-0.5 rounded">{p*100}%: {Math.round(inputCache.weight*p/1.25)*1.25}kg</button>
                        ))}
                      </div>
                      {getPlates(inputCache.weight).length > 0 && (
                        <div className="flex gap-1 items-center"><span className="text-neutral-500">单边:</span>
                          {getPlates(inputCache.weight).map((p,i) => <span key={i} className="bg-primary/20 text-primary px-1.5 rounded">{p}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 h-16">
                    <div className="flex-1 bg-neutral-900 rounded-xl flex border border-neutral-800">
                      {!showWeightInput ? (
                        <button onClick={() => setShowWeightInput(true)} className="w-full text-neutral-500 font-bold text-sm hover:text-primary transition-colors flex items-center justify-center gap-1">
                          <Plus size={16} /> 添加负重
                        </button>
                      ) : (
                        <input type="number" value={inputCache.weight} onChange={e => onInputChange('weight', e.target.value)} className="w-full bg-transparent text-center text-xl font-black text-white focus:outline-none" placeholder="kg" />
                      )}
                      <div className="w-px bg-neutral-800 my-2" />
                      <input type="number" value={inputCache.reps} onChange={e => onInputChange('reps', e.target.value)} className="w-full bg-transparent text-center text-xl font-black text-white focus:outline-none" placeholder={exercise.target === '有氧' ? '目标' : '次'} />
                    </div>
                    <button onClick={handleLog} disabled={(showWeightInput && !inputCache.weight) || !inputCache.reps} className="w-16 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-20 shadow-lg active:scale-95 transition-all">
                      <Check size={28} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-panel px-4 py-3 rounded-xl flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-3">
                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-wider">动作数据概览</span>
                  </div>
                  
                  <div className="w-full grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-neutral-900/40 rounded-xl py-2 flex flex-col items-center justify-center border border-white/5">
                      <span className="text-xl font-black text-white">{stats.maxWeight}<span className="text-[10px] text-neutral-500 font-normal ml-0.5">kg</span></span>
                      <span className="text-[9px] text-neutral-500 mt-0.5">历史最佳重量</span>
                    </div>
                    <div className="bg-neutral-900/40 rounded-xl py-2 flex flex-col items-center justify-center border border-white/5">
                      <span className="text-xl font-black text-white">{stats.totalSets}<span className="text-[10px] text-neutral-500 font-normal ml-0.5">组</span></span>
                      <span className="text-[9px] text-neutral-500 mt-0.5">累计完成</span>
                    </div>
                  </div>

                  {stats.maxWeight > 0 && !isBodyweightDefault && (
                    <div className="w-full mt-2 mb-1">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="h-px bg-white/5 flex-1" />
                         <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider text-center">推荐热身</span>
                         <div className="h-px bg-white/5 flex-1" />
                      </div>
                      <div className="flex gap-2 justify-center">
                        {[0.4, 0.6, 0.8].map(p => {
                          const w = Math.round(stats.maxWeight * p / 1.25) * 1.25;
                          if (w <= 0) return null;
                          return (
                            <div key={p} className="flex-1 bg-neutral-900/30 rounded-lg py-1.5 flex flex-col items-center justify-center border border-white/5">
                              <span className="text-white font-bold text-sm">{w}<span className="text-[9px] text-neutral-500 ml-0.5 font-normal">kg</span></span>
                              <span className="text-[8px] text-neutral-500 mt-0.5">{p * 100}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3. 静态底栏 */}
      <div className="shrink-0 px-4 py-4 border-t border-white/5 bg-neutral-950/80 backdrop-blur-md flex gap-3 z-30">
        <button onClick={onPrev} disabled={index === 0} className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-neutral-400 disabled:opacity-20 btn-scale shrink-0"><ChevronLeft size={22} /></button>
        {isTrainingMode ? (
          <>
            <button
              onClick={() => setShowInsertPicker(true)}
              className="flex items-center justify-center w-12 h-12 rounded-xl border border-primary/30 bg-primary/10 text-primary transition-all active:scale-95 btn-scale shrink-0"
              title="插入下一个动作"
            >
              <Plus size={22} />
            </button>
            <button 
              onClick={() => { if(isLast) playSuccessSound(); onNext(); }} 
              className={`flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2 ${isLast ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-primary/20 text-primary border border-primary/30'}`}
            >
              {isLast ? <><Trophy size={18} />完成训练！</> : <>下一个动作<ChevronRight size={18} /></>}
            </button>
          </>
        ) : (
          <>
            <button onClick={onStartWorkout} className="flex-1 h-12 bg-primary text-white rounded-xl font-black text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] btn-scale flex items-center justify-center gap-2">
              {isActiveSession ? '返回训练' : '⚡ 开始训练'}
            </button>
            <button onClick={onNext} disabled={isLast} className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-neutral-400 disabled:opacity-20 btn-scale shrink-0"><ChevronRight size={22} /></button>
          </>
        )}
      </div>

      {/* 4. 动作选择器弹窗 */}
      <ExercisePicker 
        isOpen={showInsertPicker}
        onClose={() => setShowInsertPicker(false)}
        onSelect={handleInsert}
        currentIndex={index}
      />

      {/* 5. 替换动作弹窗 */}
      <ExercisePicker 
        isOpen={showReplacePicker}
        onClose={() => setShowReplacePicker(false)}
        onSelect={handleReplace}
        title="选择替换的动作"
        defaultFilter={exercise.target === '腹部' ? '腹部' : exercise.target}
        excludedId={exercise.id}
      />
    </div>
  );
};

export default ActiveExerciseView;
