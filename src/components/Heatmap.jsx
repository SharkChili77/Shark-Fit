import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Trophy, Info } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

const Heatmap = () => {
  const { history } = useFitnessStore();
  const [selectedDay, setSelectedDay] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // ── 1. 生成最近 70 天的数据序列 ──────────────────────────────
  const days = useMemo(() => {
    const arr = [];
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + (6 - now.getDay()));
    
    for (let i = 69; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayData = history.find(h => h.date === dateStr);
      let intensity = 0;
      let totalVolume = 0;
      if (dayData) {
        intensity = dayData.workouts.length;
        dayData.workouts.forEach(w => {
          w.sets.forEach(s => {
            totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
          });
        });
      }
      arr.push({ date: dateStr, intensity, totalVolume, dayOfWeek: d.getDay() });
    }
    return arr;
  }, [history]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < days.length; i += 7) {
      w.push(days.slice(i, i + 7));
    }
    return w;
  }, [days]);

  const getLevelColor = (intensity) => {
    if (intensity === 0) return 'bg-neutral-900 border border-white/5';
    if (intensity <= 2) return 'bg-emerald-900/50 border border-emerald-800/30';
    if (intensity <= 4) return 'bg-emerald-600 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
    return 'bg-primary border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse-slow';
  };

  return (
    <div className="glass-panel p-5 rounded-2xl relative border border-white/5 overflow-hidden h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-4 bg-primary rounded-full" />
          训练热力图
        </h3>
        <div className="flex items-center gap-1 text-[9px] text-neutral-500 font-bold">
          <span>Less</span>
          {[0, 1, 3, 6].map(lvl => (
            <div key={lvl} className={`w-2.5 h-2.5 rounded-sm ${getLevelColor(lvl)}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-[6px] overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex flex-col gap-[6px] pr-2">
          {['', '周一', '', '周三', '', '周五', ''].map((day, i) => (
            <div key={i} className="h-3.5 flex items-center">
              <span className="text-[8px] text-neutral-600 font-black uppercase leading-none">{day}</span>
            </div>
          ))}
        </div>

        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[6px] shrink-0">
            {week.map((day) => (
              <motion.div
                key={day.date}
                whileHover={{ scale: 1.3, zIndex: 10 }}
                onClick={() => setSelectedDay(day)}
                className={`w-3.5 h-3.5 rounded-sm transition-all duration-500 cursor-pointer ${getLevelColor(day.intensity)}`}
              />
            ))}
          </div>
        ))}
      </div>

      <button 
        onClick={() => setShowExplanation(true)}
        className="absolute bottom-3 right-3 text-neutral-600 hover:text-primary transition-colors p-1"
      >
        <Info size={14} />
      </button>

      {/* ── 详情弹窗 (Portal) ── */}
      {createPortal(
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedDay(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-neutral-900 border border-white/10 p-6 rounded-3xl w-full max-w-[260px] shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-mono text-neutral-400">{selectedDay.date}</span>
                  <button onClick={() => setSelectedDay(null)}><X size={18} className="text-neutral-500" /></button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-neutral-800/50 p-3 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-primary"><Flame size={20} /></div>
                    <div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase">完成动作</div>
                      <div className="text-lg font-black text-white">{selectedDay.intensity} <span className="text-xs font-normal text-neutral-500">个</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-neutral-800/50 p-3 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400"><Trophy size={20} /></div>
                    <div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase">训练总量</div>
                      <div className="text-lg font-black text-white">{selectedDay.totalVolume} <span className="text-xs font-normal text-neutral-500">kg</span></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 说明弹窗 (Portal) ── */}
      {createPortal(
        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center"
              onClick={() => setShowExplanation(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                  <Info size={32} />
                </div>
                <h4 className="text-xl text-white font-black mb-4">训练热力图指南</h4>
                <div className="text-sm text-neutral-400 leading-relaxed space-y-4">
                  <p>
                    <span className="text-white font-bold">什么是方块？</span><br />
                    每一个方块代表一天。颜色越亮，代表训练动作越多。
                  </p>
                  <p>
                    <span className="text-primary font-bold">呼吸灯效果</span><br />
                    最亮的方块会律动，代表高强度突破！
                  </p>
                  <p className="text-neutral-500 pt-4 border-t border-white/5 italic">
                    看着矩阵被绿色填满，是健身路上最有成就感的事。
                  </p>
                </div>
                <button 
                  className="mt-8 w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                  onClick={() => setShowExplanation(false)}
                >
                  我知道了
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Heatmap;
