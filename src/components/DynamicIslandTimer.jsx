import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Minimize2, X } from 'lucide-react';
import useFitnessStore from '../store/useFitnessStore';

const BALL_SIZE = 56;

const DynamicIslandTimer = () => {
  const { globalTimer, stopGlobalTimer, startGlobalTimer, clearGlobalTimer, resetGlobalTimer, tickGlobalTimer } = useFitnessStore();
  const { isActive, timeLeft, initialTime, label } = globalTimer;

  const [isExpanded, setIsExpanded] = useState(false);
  const [animState, setAnimState] = useState('hidden'); // hidden | entering | visible | expanding | expanded | collapsing
  const [pos, setPos] = useState({ x: 16, y: 100 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // ── 心跳 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const interval = setInterval(() => tickGlobalTimer(), 1000);
    return () => clearInterval(interval);
  }, [isActive, timeLeft, tickGlobalTimer]);

  // ── 归零震动 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialTime > 0 && timeLeft === 0 && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [timeLeft, initialTime]);

  // ── 滴滴提示音 (Web Audio API) ──────────────────────────────────────────
  const playBeep = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime); // 频率 800Hz，清脆
      gain.gain.setValueAtTime(0.1, ctx.currentTime);   // 音量 0.1，不要太大
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }, []);

  // 监听倒计时最后 5 秒
  useEffect(() => {
    if (isActive && timeLeft <= 5 && timeLeft > 0) {
      playBeep();
    }
  }, [timeLeft, isActive, playBeep]);

  // ── 悬浮球进入/退出动画 ───────────────────────────────────────────────
  const isVisible = initialTime > 0;

  useEffect(() => {
    if (isVisible && !isExpanded) {
      setAnimState('entering');
      const t = setTimeout(() => setAnimState('visible'), 50);
      return () => clearTimeout(t);
    } else if (!isVisible) {
      setAnimState('hidden');
    }
  }, [isVisible, isExpanded]);

  // ── 展开/收起 ────────────────────────────────────────────────────────
  const expand = () => {
    setAnimState('expanding');
    setTimeout(() => {
      setIsExpanded(true);
      setAnimState('expanded');
    }, 150);
  };

  const collapse = () => {
    setAnimState('collapsing');
    setTimeout(() => {
      setIsExpanded(false);
      setAnimState('entering');
      setTimeout(() => setAnimState('visible'), 50);
    }, 250);
  };

  // ── 拖拽 ──────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    draggingRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    const handleMove = (me) => {
      const dx = me.clientX - dragStartRef.current.x;
      const dy = me.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) draggingRef.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - BALL_SIZE - 80, dragStartRef.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - BALL_SIZE - 100, dragStartRef.current.posY + dy)),
      });
    };
    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      if (!draggingRef.current) expand();
    };
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [pos]);

  // ── 计算 ──────────────────────────────────────────────────────────────
  const isDanger = timeLeft <= 5 && timeLeft > 0;
  const isFinished = timeLeft === 0;
  const progress = initialTime > 0 ? ((initialTime - timeLeft) / initialTime) * 100 : 0;
  const timeStr = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;
  const strokeColor = isDanger || isFinished ? '#ef4444' : '#10b981';

  // ── 弹性动画样式 ──────────────────────────────────────────────────────
  const ballStyle = {
    position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
    touchAction: 'none', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
    transform: animState === 'entering' ? 'scale(0.3) translateX(-30px)' :
               animState === 'visible' ? 'scale(1) translateX(0)' :
               animState === 'expanding' ? 'scale(1.2)' : 'scale(1)',
    opacity: animState === 'entering' ? 0 : animState === 'hidden' ? 0 : 1,
  };

  if (!isVisible) return null;

  return (
    <>
      {/* ═══ 悬浮球 + 快捷按钮 ═══ */}
      {!isExpanded && (
        <div style={ballStyle}>
          <div
            onPointerDown={handlePointerDown}
            style={{ width: BALL_SIZE, height: BALL_SIZE, flexShrink: 0 }}
            className="rounded-full cursor-grab active:cursor-grabbing"
          >
            <div
              className={`w-full h-full relative flex items-center justify-center rounded-full shadow-2xl backdrop-blur-xl border ${
                isDanger ? 'border-red-500/50 bg-red-900/40' : 'border-white/15 bg-neutral-900/85'
              }`}
              style={{
                boxShadow: isDanger
                  ? '0 0 20px rgba(239,68,68,0.5)'
                  : '0 0 12px rgba(16,185,129,0.3)',
              }}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="50" cy="50" r="44" fill="none" stroke={strokeColor} strokeWidth="8"
                  strokeDasharray="276" strokeDashoffset={276 - (276 * progress) / 100}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div className="flex flex-col items-center pointer-events-none">
                {isFinished ? (
                  <span className="text-red-400 font-black text-base animate-pulse">GO!</span>
                ) : (
                  <>
                    <span className={`text-[8px] font-bold leading-none mb-0.5 ${isDanger ? 'text-red-400' : 'text-emerald-400'}`}>{label}</span>
                    <span className={`font-mono font-bold text-xs leading-none ${isDanger ? 'text-red-400' : 'text-white'}`}>{timeStr}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* 快捷按钮 */}
          <div className="flex flex-col gap-1.5"
            style={{
              transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
              transform: animState === 'visible' ? 'scale(1) translateX(0)' : 'scale(0) translateX(-10px)',
              opacity: animState === 'visible' ? 1 : 0,
            }}
          >
            <button onClick={() => isActive ? stopGlobalTimer() : startGlobalTimer(timeLeft, label)}
              className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border active:scale-75 transition-transform ${
                isActive ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              }`}>
              {isActive ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            </button>
            <button onClick={() => clearGlobalTimer()}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-800/80 backdrop-blur-xl border border-white/10 text-neutral-400 active:scale-75 transition-transform">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ 全屏展开面板 ═══ */}
      {isExpanded && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10000 }}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={collapse}
            style={{
              animation: 'fadeIn 0.25s ease forwards',
            }}
          />
          <div
            className={`relative w-80 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center border ${
              isDanger ? 'border-red-500/30 bg-neutral-900/95' : 'border-white/10 bg-neutral-900/95'
            }`}
            style={{
              backdropFilter: 'blur(24px)',
              animation: 'bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            <button onClick={collapse}
              className="absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors p-1 active:scale-75 transition-transform">
              <Minimize2 size={20} />
            </button>

            <h3 className={`text-xs font-bold tracking-[0.2em] uppercase mb-8 ${isDanger ? 'text-red-400' : 'text-emerald-400'}`}>
              {label}
            </h3>

            <div className="relative w-52 h-52 flex items-center justify-center mb-10">
              <div className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: isDanger
                    ? '0 0 40px rgba(239,68,68,0.25), inset 0 0 40px rgba(239,68,68,0.05)'
                    : '0 0 40px rgba(16,185,129,0.15), inset 0 0 40px rgba(16,185,129,0.03)',
                }} />
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                <circle cx="50" cy="50" r="45" fill="none" stroke={strokeColor} strokeWidth="5"
                  strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div className="flex flex-col items-center">
                <span className={`text-5xl font-black font-mono tracking-tight ${
                  isDanger ? 'text-red-400 animate-pulse' : isFinished ? 'text-emerald-400' : 'text-white'
                }`}>
                  {isFinished ? 'GO!' : timeStr}
                </span>
                {!isFinished && (
                  <span className="text-[10px] text-neutral-500 mt-1 font-mono">
                    / {Math.floor(initialTime / 60)}:{(initialTime % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 w-full">
              <button onClick={resetGlobalTimer}
                className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 bg-neutral-800 text-white font-bold active:scale-90 transition-transform border border-white/5">
                <RotateCcw size={18} /> 重置
              </button>
              <button onClick={() => isActive ? stopGlobalTimer() : startGlobalTimer(timeLeft, label)}
                className="flex-[2] h-14 rounded-2xl flex items-center justify-center gap-2 bg-emerald-500 text-white font-black active:scale-90 transition-transform"
                style={{ boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
                {isActive ? <><Pause size={20} fill="currentColor" /> 暂停</> : <><Play size={20} fill="currentColor" /> 继续</>}
              </button>
            </div>

            <button onClick={() => { clearGlobalTimer(); setIsExpanded(false); setAnimState('hidden'); }}
              className="w-full mt-4 py-3 text-sm font-bold text-neutral-500 hover:text-red-400 transition-colors">
              结束并关闭
            </button>
          </div>
        </div>
      )}

      {/* 内联 keyframes */}
      <style>{`
        @keyframes bounceIn {
          0%   { transform: scale(0.3); opacity: 0; }
          50%  { transform: scale(1.08); opacity: 1; }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default DynamicIslandTimer;
