import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Scale, Minus, Plus, Check, RefreshCw, BarChart2, ChevronRight } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';
import { getDayOfWeek, getTodayDateString } from '../utils/dateUtils';
import Heatmap from '../components/Heatmap';
import SocialWall from '../components/SocialWall';

const Dashboard = () => {
  const navigate = useNavigate();
  const { routines, exercises, bodyWeight, addBodyWeight, pullData, isPulling, setModalOpen } = useFitnessStore();

  const dayOfWeek = getDayOfWeek();
  const todayStr = getTodayDateString();

  // ── 刷新 ──────────────────────────────────────────────────────────────
  const [isSpinning, setIsSpinning] = useState(false);
  const handleRefresh = () => {
    setIsSpinning(true);
    pullData().finally(() => {
      window.location.reload();
    });
  };

  // ── 体重快捷录入 ─────────────────────────────────────────────────────
  const [isWeightOpen, setIsWeightOpen] = useState(false);
  const [displayVal, setDisplayVal] = useState('');
  
  const lastWeight = useMemo(() => bodyWeight.length === 0 ? 70.0 : bodyWeight[bodyWeight.length - 1].weight, [bodyWeight]);
  const todayWeight = useMemo(() => bodyWeight.find(bw => bw.date === todayStr), [bodyWeight, todayStr]);

  const openWeightModal = () => {
    const initVal = todayWeight ? todayWeight.weight : lastWeight;
    setDisplayVal(String(initVal));
    setIsWeightOpen(true);
    setModalOpen(true);
  };

  const adjust = (delta) => {
    setDisplayVal(prev => {
      const current = parseFloat(prev) || 0;
      const next = Math.round((current + delta) * 10) / 10;
      return String(next);
    });
  };

  // ── 今日训练数据 ──────────────────────────────────────────────────────
  const todayRoutine = useMemo(() => routines.find(r => r.dayOfWeek === dayOfWeek) || null, [routines, dayOfWeek]);
  const todayExercises = useMemo(() => {
    if (!todayRoutine) return [];
    return todayRoutine.exerciseIds.map(id => exercises.find(e => e.id === id)).filter(Boolean);
  }, [todayRoutine, exercises]);

  const weekMap = ['日', '一', '二', '三', '四', '五', '六'];

  // ── 精准跳转至今日训练动作 ──────────────────────────────────────────
  const { startWorkout, updateWorkoutSession, activeWorkoutSession } = useFitnessStore();
  const handleExerciseClick = (exId, idx) => {
    // 1. 如果没开始训练，先开始
    if (!activeWorkoutSession.isActive) {
      startWorkout(dayOfWeek);
    }
    // 2. 设置当前聚焦的动作索引
    updateWorkoutSession({ focusIndex: idx, direction: 1 });
    // 3. 跳转至训练流页面
    navigate('/workout');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-32 px-4"
    >
      {/* 1. 头部：Dashboard + 体重 - 压缩间距 */}
      <div className="flex items-center justify-between py-2 mb-4">
        <h1 className="text-2xl font-black text-white tracking-tighter italic">DASHBOARD</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="w-9 h-9 flex items-center justify-center bg-neutral-900 border border-white/5 rounded-xl active:scale-90 transition-all">
            <RefreshCw size={14} className={`text-primary ${isSpinning ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openWeightModal} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-white/5 rounded-xl active:scale-95 transition-all">
            <Scale size={14} className="text-blue-400" />
            <span className="text-sm font-black text-white">{todayWeight ? todayWeight.weight : lastWeight}<span className="text-[10px] text-neutral-500 ml-1">kg</span></span>
          </button>
        </div>
      </div>

      {/* 2. 热力图区域 - 紧凑布局 */}
      <div className="flex items-stretch gap-2 mb-4">
        <div className="flex-1 min-w-0 scale-[0.98] origin-left">
          <Heatmap />
        </div>
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(57,255,20,0.05)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/analytics')}
          className="w-14 bg-neutral-900 border border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center gap-5 py-6 transition-colors shadow-xl group"
        >
          <div className="writing-vertical text-[10px] font-black text-neutral-500 group-hover:text-primary transition-colors tracking-[0.4em] uppercase" style={{ writingMode: 'vertical-lr' }}>
            Analytics
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
            <BarChart2 size={16} />
          </div>
        </motion.button>
      </div>

      {/* 3. 核心训练中枢 - 椭圆排列优化 */}
      <div className="relative mt-12 pt-12 pb-4 mb-8 flex flex-col items-center justify-center min-h-[300px]">
        {/* 顶部当前计划名称 */}
        <div className="absolute -top-10 text-center z-30">
          <div className="text-[10px] text-primary/60 font-black tracking-widest uppercase mb-1">
            周{weekMap[dayOfWeek]} PLAN
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {todayRoutine ? todayRoutine.name : 'RECOVERY DAY'}
          </h2>
        </div>

        {/* 背景装饰：发光圆环 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute w-60 h-60 border border-primary/10 rounded-full" 
          />
        </div>

        {/* 核心开始按钮 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/workout')}
          className="relative z-20 w-36 h-36 bg-primary rounded-full flex flex-col items-center justify-center shadow-[0_0_40px_rgba(57,255,20,0.4)] group active:shadow-none transition-shadow"
        >
          <div className="absolute inset-2 border-2 border-white/20 rounded-full group-hover:scale-110 transition-transform" />
          <Play size={48} fill="white" className="text-white ml-2 drop-shadow-md" />
          <span className="text-[10px] font-black text-white mt-1 tracking-[0.3em] uppercase opacity-80">Start</span>
        </motion.button>

        {/* 环绕训练计划：卫星式布局 - 椭圆算法 */}
        <div className="absolute inset-0 z-10">
          {todayExercises.length > 0 ? (
            todayExercises.map((ex, i) => {
              const total = todayExercises.length;
              // 1. 椭圆半径微调：增加水平宽度防止底部重叠
              const radiusX = 145;
              const radiusY = 115; 
              const angle = (i * (360 / total)) - 90;
              const radian = (angle * Math.PI) / 180;
              const x = Math.cos(radian) * radiusX;
              const y = Math.sin(radian) * radiusY;

              return (
                <motion.button
                  key={ex.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1, x, y }}
                  whileHover={{ scale: 1.1, zIndex: 30, backgroundColor: 'rgba(57,255,20,0.1)', borderColor: 'rgba(57,255,20,0.3)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleExerciseClick(ex.id, i)}
                  transition={{ delay: i * 0.1 + 0.5, type: 'spring' }}
                  // 2. 居中偏移：w-24 (48px) h-14 (28px) 的偏移
                  style={{ left: 'calc(50% - 3rem)', top: 'calc(50% - 1.75rem)' }}
                  className="absolute w-24 h-14 p-2 bg-neutral-900/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center group transition-all"
                >
                  <div className="text-[9px] font-black text-primary uppercase leading-tight line-clamp-2 group-hover:text-white transition-colors">{ex.name}</div>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{ex.sets} SETS</div>
                </motion.button>
              );
            })
          ) : (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-32 text-center">
              <p className="text-neutral-500 text-xs font-bold italic">今天是休息日，彻底恢复吧</p>
            </div>
          )}
        </div>

      </div>

      {/* 4. PR 荣誉墙：整体下移 */}
      <div className="mt-12 pt-12 border-t border-white/5">
        <SocialWall />
      </div>

      {/* ── 体重录入弹窗（Portal 到 body，避免被持久化视图的 overflow-hidden / stacking context 遮挡） ── */}
      {createPortal(
        <AnimatePresence>
          {isWeightOpen && (
            <div className="fixed inset-0 z-[1100] flex items-end justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsWeightOpen(false); setModalOpen(false); }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 pb-10 shadow-2xl">
                <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Scale className="text-blue-400" size={20} /> 记录体重</h2>
                  <span className="text-xs text-neutral-500">{todayStr}</span>
                </div>
                <div className="flex items-center justify-center gap-4 mb-10">
                  <button onClick={() => adjust(-0.1)} className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-white active:scale-90"><Minus size={18} /></button>
                  <div className="text-center">
                    <input type="text" inputMode="decimal" value={displayVal} onChange={(e) => setDisplayVal(e.target.value.replace(/[^0-9.]/g, ''))} className="w-28 text-center text-5xl font-black text-white bg-transparent border-b-2 border-neutral-700 outline-none tabular-nums pb-1" />
                    <div className="text-xs text-neutral-500 mt-2">kg</div>
                  </div>
                  <button onClick={() => adjust(0.1)} className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-white active:scale-90"><Plus size={18} /></button>
                </div>
                <button onClick={() => { addBodyWeight(parseFloat(displayVal), todayStr); setIsWeightOpen(false); setModalOpen(false); }} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95">确认保存</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};

export default Dashboard;
