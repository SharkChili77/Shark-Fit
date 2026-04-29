/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FinFit - 懒加载图表组件包装器 (LazyChart.jsx)
 *
 * 将 recharts 的所有组件通过动态 import() 异步加载，
 * 避免首屏加载时就拉取完整的 recharts 包（~200KB gzipped）。
 *
 * 使用方式：
 *   import { LazyLineChart, LazyAreaChart, ... } from './LazyChart';
 *   <Suspense fallback={<ChartSkeleton />}><LazyLineChart ... /></Suspense>
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { lazy } from 'react';

// 创建一个工厂函数，根据组件名从 recharts 中懒加载
const createLazyRechartsComponent = (componentName) =>
  lazy(() =>
    import('recharts').then((module) => ({
      default: module[componentName],
    }))
  );

// ── 导出所有 AnalyticsHub 需要的 recharts 组件 ──────────────────────────────
export const LazyLineChart = createLazyRechartsComponent('LineChart');
export const LazyLine = createLazyRechartsComponent('Line');
export const LazyAreaChart = createLazyRechartsComponent('AreaChart');
export const LazyArea = createLazyRechartsComponent('Area');
export const LazyBarChart = createLazyRechartsComponent('BarChart');
export const LazyBar = createLazyRechartsComponent('Bar');
export const LazyComposedChart = createLazyRechartsComponent('ComposedChart');
export const LazyXAxis = createLazyRechartsComponent('XAxis');
export const LazyYAxis = createLazyRechartsComponent('YAxis');
export const LazyCartesianGrid = createLazyRechartsComponent('CartesianGrid');
export const LazyTooltip = createLazyRechartsComponent('Tooltip');
export const LazyResponsiveContainer = createLazyRechartsComponent('ResponsiveContainer');
export const LazyLegend = createLazyRechartsComponent('Legend');

/**
 * 图表骨架屏：在 recharts 加载前显示的占位动画
 */
export const ChartSkeleton = ({ height = 220 }) => (
  <div
    style={{ width: '100%', height: `${height}px` }}
    className="flex items-center justify-center"
  >
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-[10px] text-neutral-600 font-bold">加载图表中...</span>
    </div>
  </div>
);
