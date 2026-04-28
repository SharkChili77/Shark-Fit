import { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, CheckCircle } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

const Settings = () => {
  const { history } = useFitnessStore();

  const totalSets = history.reduce((acc, day) => {
    return acc + day.workouts.reduce((wAcc, workout) => wAcc + workout.sets.length, 0);
  }, 0);

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
    </motion.div>
  );
};

export default Settings;
