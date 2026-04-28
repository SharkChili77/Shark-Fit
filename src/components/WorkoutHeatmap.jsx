import { useMemo } from 'react';
import { motion } from 'framer-motion';
import useFitnessStore from '../store/useFitnessStore';

const WorkoutHeatmap = () => {
  const { history } = useFitnessStore();

  // ── 1. 生成最近 105 天（15周）的日期序列 ──────────────────────────────
  const heatmapData = useMemo(() => {
    const days = [];
    const now = new Date();
    // 调整到本周六，确保布局整齐
    const end = new Date(now);
    end.setDate(now.getDate() + (6 - now.getDay()));
    
    for (let i = 104; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // 查找当天训练量
      const record = history.find(h => h.date === dateStr);
      const intensity = record ? record.workouts.length : 0;
      
      days.push({
        date: dateStr,
        intensity,
        dayOfWeek: d.getDay(),
      });
    }
    return days;
  }, [history]);

  // 按周分组 (每组 7 天)
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      w.push(heatmapData.slice(i, i + 7));
    }
    return w;
  }, [heatmapData]);

  const getLevelColor = (intensity) => {
    if (intensity === 0) return 'bg-neutral-900 border border-white/5';
    if (intensity <= 2) return 'bg-emerald-900/50 border border-emerald-800/30';
    if (intensity <= 4) return 'bg-emerald-600 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
    return 'bg-primary border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse-slow';
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-4 bg-primary rounded-full" />
          训练热力图
        </h3>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-neutral-900" />
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-900/50" />
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
          <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-[3px] overflow-x-auto pb-2 scrollbar-hide">
        {/* 星期标签列 */}
        <div className="flex flex-col gap-[3px] pr-2 justify-between py-1">
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((day, i) => (
            <span key={i} className="text-[9px] text-neutral-600 h-2.5 flex items-center font-bold">
              {day}
            </span>
          ))}
        </div>

        {/* 热力格子矩阵 */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px] shrink-0">
            {week.map((day, dayIdx) => (
              <motion.div
                key={day.date}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (weekIdx * 7 + dayIdx) * 0.002 }}
                className={`w-2.5 h-2.5 rounded-sm transition-all duration-500 ${getLevelColor(day.intensity)}`}
                title={`${day.date}: ${day.intensity}个动作`}
              />
            ))}
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-[10px] text-neutral-500 text-center font-medium italic">
        坚持就是胜利，不要让绿色中断！🔥
      </div>
    </div>
  );
};

export default WorkoutHeatmap;
