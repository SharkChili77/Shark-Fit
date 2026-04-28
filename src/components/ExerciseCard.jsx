import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Check, Image as ImageIcon, TrendingUp, X, Timer, Play, Square } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import useFitnessStore from '../store/useFitnessStore';
import { getTodayDateString } from '../utils/dateUtils';

const ExerciseCard = ({ exercise, onLogSet }) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showImgInput, setShowImgInput] = useState(false);
  const [imgUrl, setImgUrl] = useState(exercise.imageUrl || '');
  
  // 计时器状态
  const [stopwatchActive, setStopwatchActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  const { history, updateExercise, removeWorkoutSet } = useFitnessStore();
  const todayStr = getTodayDateString();

  // 获取今天的记录
  const todayRecord = useMemo(() => {
    const day = history.find(h => h.date === todayStr);
    if (!day) return null;
    return day.workouts.find(w => w.exerciseId === exercise.id) || null;
  }, [history, todayStr, exercise.id]);

  // 生成图表数据：历史最大重量趋势
  const chartData = useMemo(() => {
    const data = [];
    // 简化：遍历所有历史记录，提取该动作的每天最大重量
    history.forEach(day => {
      const w = day.workouts.find(wk => wk.exerciseId === exercise.id);
      if (w && w.sets.length > 0) {
        const maxW = Math.max(...w.sets.map(s => s.weight));
        data.push({ date: day.date.substring(5), weight: maxW }); // 截取 MM-DD
      }
    });
    // 只取最近10次记录
    return data.slice(-10);
  }, [history, exercise.id]);

  const handleLog = () => {
    if (!weight || !reps) return;
    onLogSet(exercise.id, weight, reps, exercise.rest);
    // 可选：打卡后不清空输入，方便同重量继续打卡
  };

  const handleSaveImg = () => {
    updateExercise(exercise.id, { imageUrl: imgUrl });
    setShowImgInput(false);
  };

  const toggleStopwatch = (e) => {
    e.stopPropagation();
    if (stopwatchActive) {
      clearInterval(intervalRef.current);
      setStopwatchActive(false);
    } else {
      setStopwatchActive(true);
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
  };

  const resetStopwatch = (e) => {
    e.stopPropagation();
    clearInterval(intervalRef.current);
    setStopwatchActive(false);
    setElapsed(0);
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-surface rounded-xl overflow-hidden border border-neutral-800 shadow-sm mb-4 transition-all">
      {/* 头部信息区 */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer active:bg-neutral-800/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-white">{exercise.name}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
              {exercise.target}
            </span>
          </div>
          <p className="text-sm text-neutral-500 font-mono">
            建议: {exercise.sets}组 × {exercise.reps}次 | 休息 {exercise.rest}s
          </p>
        </div>
        
        {/* 顶部计时器按钮 */}
        <div className="flex items-center gap-2">
          {elapsed > 0 && !stopwatchActive && (
            <button onClick={resetStopwatch} className="text-xs text-neutral-500 hover:text-white px-2">重置</button>
          )}
          <button 
            onClick={toggleStopwatch}
            className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border transition-colors ${stopwatchActive ? 'border-danger text-danger bg-danger/10' : elapsed > 0 ? 'border-primary text-primary bg-primary/10' : 'border-neutral-700 text-neutral-400 bg-neutral-800'}`}
          >
            {stopwatchActive ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            {elapsed > 0 ? formatTime(elapsed) : '计时'}
          </button>
          <div className="text-neutral-500 ml-2">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* 展开区域：图表、图片、记录表单 */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-neutral-800/50 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* 详细说明与注意事项 */}
          {exercise.notes && (
            <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-primary/90 leading-relaxed whitespace-pre-wrap">
              {exercise.notes}
            </div>
          )}

          {/* 图片展示或设置 */}
          <div className="mb-4">
            {exercise.imageUrl && !showImgInput ? (
              <div className="relative group">
                <img src={exercise.imageUrl} alt={exercise.name} className="w-full h-32 object-cover rounded-lg bg-neutral-900 border border-neutral-800" />
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowImgInput(true); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-md text-white backdrop-blur-sm"
                >
                  <ImageIcon size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={imgUrl}
                  onChange={e => setImgUrl(e.target.value)}
                  placeholder="粘贴图片URL作为参考..."
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {showImgInput ? (
                  <>
                    <button onClick={handleSaveImg} className="bg-primary/20 text-primary px-3 rounded-lg"><Check size={16}/></button>
                    <button onClick={() => setShowImgInput(false)} className="bg-neutral-800 px-3 rounded-lg"><X size={16}/></button>
                  </>
                ) : (
                  <button onClick={handleSaveImg} className="bg-neutral-800 px-3 rounded-lg text-sm whitespace-nowrap">保存</button>
                )}
              </div>
            )}
          </div>

          {/* 趋势图表 */}
          {chartData.length > 1 && (
            <div className="mb-6 h-32 w-full">
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
          )}

          {/* 今日已完成记录列表 */}
          {todayRecord && todayRecord.sets.length > 0 && (
            <div className="mb-4 space-y-1">
              <div className="text-xs text-neutral-500 mb-2 font-bold">今日打卡</div>
              {todayRecord.sets.map((set, idx) => (
                <div key={set.id} className="flex items-center justify-between bg-neutral-900/50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500 font-mono w-4">{idx + 1}</span>
                    <span className="font-bold">{set.weight} <span className="text-neutral-500 font-normal">kg</span></span>
                    <span className="text-neutral-600">×</span>
                    <span className="font-bold">{set.reps} <span className="text-neutral-500 font-normal">次</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    {set.isPR && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black italic">PR!</span>}
                    <button 
                      onClick={() => removeWorkoutSet(todayStr, exercise.id, set.id)}
                      className="text-neutral-600 hover:text-danger p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 打卡输入区 (单手友好) */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 flex bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 focus-within:border-primary/50 transition-colors">
              <input 
                type="number" 
                placeholder="重量" 
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-1/2 bg-transparent text-center py-3 text-lg font-bold focus:outline-none placeholder:text-neutral-700"
              />
              <div className="w-[1px] bg-neutral-800"></div>
              <input 
                type="number" 
                placeholder="次数" 
                value={reps}
                onChange={e => setReps(e.target.value)}
                className="w-1/2 bg-transparent text-center py-3 text-lg font-bold focus:outline-none placeholder:text-neutral-700"
              />
            </div>
            <button 
              onClick={handleLog}
              disabled={!weight || !reps}
              className="w-14 h-[52px] bg-primary text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-neutral-800 active:scale-95 transition-all"
            >
              <Check size={24} strokeWidth={3} />
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default ExerciseCard;
