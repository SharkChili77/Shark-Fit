/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CircularProgress - 环形进度条组件
 *
 * 用于展示"已摄入 / 每日目标"的进度。
 * 使用 SVG 绘制圆环，Framer Motion 驱动动画。
 *
 * 核心算法说明：
 *   - SVG 圆的周长 = 2 × π × 半径
 *   - 通过 stroke-dasharray（描边虚线长度）和 stroke-dashoffset（虚线偏移）
 *     来控制"画了多少"，从而呈现百分比进度效果
 *   - dasharray 设为整个周长，dashoffset 从周长减到 0 就是从 0% 到 100%
 *
 * Props:
 *   - value:    当前值（已摄入）
 *   - max:      目标值（每日目标）
 *   - label:    标签文字（如"蛋白质"）
 *   - unit:     单位文字（如"g" 或 "kcal"）
 *   - size:     组件尺寸（默认 100）
 *   - color:    正常颜色（默认 emerald）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { motion } from 'framer-motion';

const CircularProgress = ({
  value = 0,
  max = 100,
  label = '',
  unit = 'g',
  size = 100,
  color = '#10b981',  // 默认 emerald-500
}) => {
  // ── 计算进度百分比 ──────────────────────────────────────────────────────
  // 百分比 = 当前值 / 目标值
  // Math.min 确保不超过 100%（虽然超标时视觉上会变色，但进度条最多画满）
  // Math.max 确保不低于 0%
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  // ── 判断是否超标 ───────────────────────────────────────────────────────
  // 超标 = 实际摄入超过了每日目标
  const isOver = value > max;

  // ── SVG 圆环参数计算 ──────────────────────────────────────────────────
  const strokeWidth = 6;                        // 圆环描边宽度
  const radius = (size - strokeWidth) / 2;       // 圆的半径 = (总尺寸 - 描边宽度) / 2
  const circumference = 2 * Math.PI * radius;    // 圆的周长 = 2πr
  // dashoffset 控制进度：
  //   - 当 offset = circumference 时，圆环完全不可见（0%）
  //   - 当 offset = 0 时，圆环完全可见（100%）
  //   - 所以 offset = circumference × (1 - 百分比/100)
  const strokeDashoffset = circumference * (1 - percentage / 100);

  // ── 动态颜色：正常绿色 → 超标时变为警告红色 ─────────────────────────────
  const activeColor = isOver ? '#ef4444' : color;       // 进度条颜色
  const glowColor = isOver ? 'rgba(239,68,68,0.3)' : `${color}33`; // 发光效果

  return (
    <div className="flex flex-col items-center gap-1.5 mx-auto" style={{ width: size }}>
      {/* SVG 圆环容器 */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          // 旋转 -90 度让进度从顶部（12点钟方向）开始
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* 背景圆环（灰色底环） */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />

          {/* 进度圆环（带动画） */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"               // 圆角端点
            strokeDasharray={circumference}      // 虚线总长 = 周长
            initial={{ strokeDashoffset: circumference }}  // 初始状态：完全隐藏
            animate={{ strokeDashoffset }}                   // 动画到目标进度
            transition={{ duration: 1, ease: 'easeOut' }}    // 1秒缓出动画
            style={{
              // 超标时添加发光效果，提醒用户已超出目标
              filter: isOver ? `drop-shadow(0 0 6px ${glowColor})` : `drop-shadow(0 0 4px ${glowColor})`,
            }}
          />
        </svg>

        {/* 中心文字：显示当前值 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={`progress-value-${value}`}  // value 变化时触发重新动画
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-black tabular-nums leading-none ${
              size >= 100 ? 'text-lg' : 'text-sm'
            } ${isOver ? 'text-red-400' : 'text-white'}`}
          >
            {Math.round(value)}
          </motion.span>
          <span className="text-[9px] text-neutral-500 font-bold mt-0.5">
            / {Math.round(max)}{unit}
          </span>
        </div>
      </div>

      {/* 底部标签 */}
      <span className={`text-[10px] font-black uppercase tracking-widest ${
        isOver ? 'text-red-400' : 'text-neutral-500'
      }`}>
        {label}
      </span>
    </div>
  );
};

export default CircularProgress;
