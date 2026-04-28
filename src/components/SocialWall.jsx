import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Award } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

const SocialWall = () => {
  const navigate = useNavigate();
  const { socialPRs, fetchSocialPRs, isFetchingSocial, likePR } = useFitnessStore();

  useEffect(() => {
    fetchSocialPRs();
  }, [fetchSocialPRs]);

  const handleLike = async (pr_id) => {
    await likePR(pr_id);       // 后端切换点赞状态
    await fetchSocialPRs();    // 重新拉取最新数据（包含最新的 hasLiked 和 likesCount）
  };

  if (isFetchingSocial && socialPRs.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map(i => (
          <div key={i} className="h-24 bg-neutral-900 rounded-2xl border border-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Award size={18} className="text-yellow-500" />
          全站 PR 荣耀墙
        </h3>
        <button 
          onClick={() => fetchSocialPRs()}
          disabled={isFetchingSocial}
          className={`text-[10px] font-bold px-2 py-1 rounded-md active:scale-95 transition-all flex items-center gap-1 ${
            isFetchingSocial ? 'bg-neutral-800 text-neutral-500' : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          {isFetchingSocial ? (
            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : null}
          {isFetchingSocial ? '正在刷新' : '刷新动态'}
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {socialPRs.slice(0, 3).map((pr, idx) => {
            const isLiked = Boolean(pr.hasLiked);
            const likesCount = Number(pr.likesCount || 0);

            return (
              <motion.div
                key={pr.pr_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass-panel p-4 rounded-2xl border border-white/5 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-lg shadow-inner">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🔥'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{pr.username}</span>
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black uppercase">NEW PR!</span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        在 <span className="text-emerald-400 font-bold">{pr.exerciseName}</span> 中创造了纪录
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-white tabular-nums">
                      {pr.weight}<span className="text-[10px] text-neutral-500 ml-0.5">kg</span>
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">{new Date(pr.date).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* 点赞区域：只保留一个统一的激励按钮 */}
                <div className="mt-3 pt-3 border-t border-white/5 relative z-10">
                  <button 
                    onClick={() => handleLike(pr.pr_id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 active:scale-95 ${
                      isLiked 
                        ? 'bg-orange-500/10 text-orange-500' 
                        : 'bg-white/5 text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <Flame size={14} fill={isLiked ? "currentColor" : "none"} />
                    <span className="text-xs font-bold">{isLiked ? '已激励' : '激励'}</span>
                    {likesCount > 0 && (
                      <span className="text-xs font-black tabular-nums ml-1">{likesCount}</span>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {socialPRs.length > 3 && (
        <button 
          onClick={() => navigate('/leaderboard')}
          className="w-full py-4 mt-2 bg-white/5 border border-white/5 rounded-2xl text-xs font-bold text-neutral-400 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
        >
          查看全站排行榜 →
        </button>
      )}

      {socialPRs.length === 0 && !isFetchingSocial && (
        <div className="text-center py-10 bg-neutral-900/50 rounded-2xl border border-dashed border-white/5">
          <p className="text-xs text-neutral-600">目前还没有动态，去创造属于你的 PR 吧！🚀</p>
        </div>
      )}
    </div>
  );
};

export default SocialWall;
