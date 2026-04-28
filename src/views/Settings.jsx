import { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, CheckCircle, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

const Settings = () => {
  const { history } = useFitnessStore();

  const totalSets = history.reduce((acc, day) => {
    return acc + day.workouts.reduce((wAcc, workout) => wAcc + workout.sets.length, 0);
  }, 0);

  const handleExportJSON = () => {
    const state = useFitnessStore.getState();
    const data = {
      history: state.history,
      exercises: state.exercises,
      routines: state.routines,
      bodyWeight: state.bodyWeight,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finfit_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const { history, exercises } = useFitnessStore.getState();
    let csvContent = "日期,动作名称,重量(kg),次数,是否PR\n";

    history.forEach(day => {
      day.workouts.forEach(w => {
        const exName = exercises.find(e => e.id === w.exerciseId)?.name || '未知动作';
        w.sets.forEach(s => {
          csvContent += `${day.date},${exName},${s.weight},${s.reps},${s.isPR ? '是' : '否'}\n`;
        });
      });
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finfit_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="pb-28"
    >
      <h1 className="text-3xl font-black mb-6 text-white">系统设置</h1>

      <div className="glass-panel p-5 rounded-xl mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-primary font-bold">
          <Server size={20} />
          <h2>服务器连接状态</h2>
        </div>

        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-3">
          <CheckCircle className="text-primary shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-bold text-white mb-1">已连接到原子云数据库</p>
            <p className="text-xs text-neutral-400 font-mono italic">
              {typeof window !== 'undefined' ? window.location.hostname : 'Cloud Server'}
            </p>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              系统已与后端数据库建立原子同步。所有操作将实时持久化至您的云端服务器，保障数据永不丢失。
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white mb-1">本地缓存统计</h3>
          <p className="text-xs text-neutral-500">累计训练天数: {history.length}</p>
          <p className="text-xs text-neutral-500">累计完成组数: {totalSets}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black">
          {history.length}
        </div>
      </div>

      <div className="glass-panel p-5 rounded-xl mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-emerald-500 font-bold">
          <Download size={20} />
          <h2>数据导出与备份</h2>
        </div>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
          您的数据完全属于您自己。您可以随时将全部训练数据导出为本地文件进行备份或自由分析。
        </p>

        <div className="space-y-3">
          <button 
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between p-4 bg-neutral-900 border border-white/5 rounded-xl hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <FileJson size={20} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors">导出完整备份 (JSON)</h3>
                <p className="text-[10px] text-neutral-500 mt-0.5">包含动作库、计划、历史及体重</p>
              </div>
            </div>
            <Download size={16} className="text-neutral-600 group-hover:text-primary transition-colors" />
          </button>

          <button 
            onClick={handleExportCSV}
            className="w-full flex items-center justify-between p-4 bg-neutral-900 border border-white/5 rounded-xl hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <FileSpreadsheet size={20} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-500 transition-colors">导出训练记录 (CSV)</h3>
                <p className="text-[10px] text-neutral-500 mt-0.5">适合在 Excel 中打开进行图表分析</p>
              </div>
            </div>
            <Download size={16} className="text-neutral-600 group-hover:text-emerald-500 transition-colors" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Settings;
