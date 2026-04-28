import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Trophy, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

const SocialLeaderboard = () => {
  const navigate = useNavigate();
  const { socialPRs, fetchSocialPRs, isFetchingSocial, likePR, socialNotifications, fetchNotifications } = useFitnessStore();
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  useEffect(() => {
    fetchSocialPRs();
    fetchNotifications();
  }, [fetchSocialPRs, fetchNotifications]);

  const handleLike = async (pr_id) => {
    await likePR(pr_id);
    await fetchSocialPRs();
    await fetchNotifications();
  };

  const hasNotifications = socialNotifications.length > 0;
  
  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 active:scale-90 transition-all"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black flex items-center gap-2">
          <Trophy className="text-yellow-500" size={24} />
          荣耀排行榜
        </h1>
      </div>

      <div className="px-6 pt-6 space-y-6">
        {/* 通知区域 */}
        {hasNotifications && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 border border-primary/20 rounded-3xl overflow-hidden shadow-lg shadow-primary/5"
          >
            <div 
              onClick={() => setShowAllNotifications(!showAllNotifications)}
              className="p-4 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white">
                  <Flame size={16} fill="currentColor" />
                </div>
                <div className="text-sm font-bold text-primary">
                  {socialNotifications.length > 1 
                    ? `${socialNotifications[0].likerName} 等 ${socialNotifications.length} 人赞了你的突破`
                    : `${socialNotifications[0].likerName} 赞了你的突破`}
                </div>
              </div>
              {showAllNotifications ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-primary" />}
            </div>

            <AnimatePresence>
              {showAllNotifications && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-2 border-t border-primary/10 pt-4"
                >
                  {socialNotifications.map((note, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{note.likerName}</span>
                        <span className="text-neutral-500">赞了你的</span>
                        <span className="text-emerald-400 font-bold">{note.exerciseName}</span>
                      </div>
                      <span className="text-[9px] text-neutral-600">{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 顶部统计 */}
        <div className="relative h-32 rounded-[2.5rem] bg-gradient-to-br from-primary to-emerald-800 p-6 overflow-hidden shadow-lg shadow-primary/20">
          <div className="absolute top-0 right-0 p-4 opacity-20 rotate-12">
            <Trophy size={80} />
          </div>
          <div className="relative z-10">
            <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Total PRs</div>
            <div className="text-4xl font-black text-white">{socialPRs.length}</div>
            <div className="text-[10px] text-white/60 mt-1">全站共同见证每一个突破时刻</div>
          </div>
        </div>

        {/* 动态列表 */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {socialPRs.map((pr, idx) => {
              const isLiked = Boolean(pr.hasLiked);
              const likesCount = Number(pr.likesCount || 0);

              return (
                <motion.div
                  key={pr.pr_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-neutral-900/50 border border-white/5 rounded-[2.2rem] p-6 relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg ${
                        idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                        idx === 1 ? 'bg-neutral-300/20 text-neutral-300' : 
                        idx === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-neutral-800 text-neutral-500'
                      }`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white tracking-tight">{pr.username}</span>
                          <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">PR ACHIEVED</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">在 <span className="text-primary font-bold">{pr.exerciseName}</span> 取得突破</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-white leading-none">{pr.weight}<span className="text-xs text-neutral-600 ml-1">kg</span></div>
                      <div className="text-[10px] text-neutral-600 mt-1 font-mono uppercase opacity-50">{new Date(pr.date).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* 统一的激励按钮 */}
                  <div className="flex items-center pt-5 border-t border-white/5">
                    <button 
                      onClick={() => handleLike(pr.pr_id)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all duration-300 active:scale-95 ${
                        isLiked 
                          ? 'bg-orange-500/10 text-orange-500' 
                          : 'bg-white/5 text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      <Flame size={18} fill={isLiked ? "currentColor" : "none"} />
                      <span className="text-sm font-bold">{isLiked ? '已激励' : '激励'}</span>
                      {likesCount > 0 && (
                        <span className="text-sm font-black tabular-nums">{likesCount}</span>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {isFetchingSocial && socialPRs.length === 0 && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-neutral-900/50 rounded-3xl border border-white/5" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialLeaderboard;
