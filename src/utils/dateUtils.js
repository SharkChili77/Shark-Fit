import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// 强制使用北京时间（Asia/Shanghai）
const TIMEZONE = 'Asia/Shanghai';

/**
 * 获取当前的北京时间 Date 对象
 */
export const getBeijingTime = () => {
  const now = new Date();
  return toZonedTime(now, TIMEZONE);
};

/**
 * 获取今天是星期几 (0: 周日, 1: 周一, ..., 6: 周六)
 * 根据北京时间计算
 */
export const getDayOfWeek = () => {
  const bjt = getBeijingTime();
  return bjt.getDay();
};

/**
 * 格式化今天的日期为 YYYY-MM-DD 格式，用于作为历史记录的 key
 */
export const getTodayDateString = () => {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
};

/**
 * 格式化显示日期
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  return formatInTimeZone(new Date(dateString), TIMEZONE, 'yyyy-MM-dd');
};
