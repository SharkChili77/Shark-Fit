import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultExercises, defaultRoutines } from '../utils/defaultData';
import { getTodayDateString } from '../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════
// API 请求工具函数
// ═══════════════════════════════════════════════════════════════════════════

const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const { hostname, protocol, port } = window.location;
  // 本地开发 (localhost / 5173) 需要显式指定后端 3001 端口
  // 生产环境通过 Nginx 反向代理，直接用当前 origin 即可
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3001`;
  }
  // 生产环境：Nginx 反代，API 和页面同域同端口
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * 封装 fetch，自动拼接 base URL 并处理 JSON
 * 🆕 自动从 localStorage 读取 JWT Token，注入 Authorization 请求头
 * 如果后端不可达，静默失败（降级为本地模式）
 */
const apiRequest = async (path, options = {}) => {
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}${path}`;

    // 从 localStorage 读取当前的 JWT Token
    // AuthContext 在 login 时会把 token 存入 localStorage['sharkfit_token']
    const token = localStorage.getItem('sharkfit_token');

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // 如果有 Token，附加 Authorization 头；否则不附加（允许访问公开接口）
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        // 允许调用方覆盖 headers（options.headers 优先级最高）
        ...options.headers,
      },
    });

    // 401 表示 Token 失效或未登录，清除本地认证信息并刷新页面
    if (response.status === 401) {
      console.warn('[API] Token 已过期，请重新登录');
      localStorage.removeItem('sharkfit_token');
      localStorage.removeItem('sharkfit_user');
      localStorage.removeItem('fitness-pwa-storage');
      window.location.href = '/login';
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API 错误] ${options.method || 'GET'} ${path}:`, errorData);
      return null;
    }

    return await response.json();
  } catch (err) {
    // 网络不可达时静默失败，允许离线使用
    console.warn(`[API 离线] ${path}:`, err.message);
    return null;
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// Zustand Store
// ═══════════════════════════════════════════════════════════════════════════

const useFitnessStore = create(
  persist(
    (set, get) => ({
      // ── 核心数据 ─────────────────────────────────────────────────────────
      exercises: defaultExercises,
      routines: defaultRoutines,
      history: [], // 格式: { date: 'YYYY-MM-DD', workouts: [{ exerciseId, sets: [{id, weight, reps, isPR}] }] }
      trash: [],   // 回收站
      bodyWeight: [], // 体重记录 { date, weight }
      showConfetti: false,
      hasSeenWelcome: false, // 是否已看过开屏介绍
      isPulling: false,      // 是否正在同步数据
      socialPRs: [],         // 🆕 全站 PR 动态
      isFetchingSocial: false, // 🆕 社交数据加载状态
      isPublic: true,          // 🆕 隐私设置：是否公开展示 PR
      socialNotifications: [], // 🆕 被点赞通知
      modalOpen: false,        // 🆕 全局弹窗状态（用于隐藏底部导航栏）
      setModalOpen: (v) => set({ modalOpen: v }),
      announcement: null,      // 🆕 系统公告
      dismissedAnnouncementId: null, // 🆕 已点击“不再显示”的公告 ID

      // ── 全局灵动岛倒计时状态 ──────────────────────────────────────────────
      globalTimer: {
        isActive: false,
        timeLeft: 0,
        initialTime: 0,
        endTime: null, // 🆕 记录结束的时间戳
        label: '休息'
      },

      // ── 全局训练会话状态 (支持持久化恢复) ──────────────────────────────────
      activeWorkoutSession: {
        isActive: false,       // 是否正在进行训练
        focusIndex: null,      // 当前正在练的动作索引
        direction: 1,          // 翻页动画方向
        selectedDay: null,     // 当前训练所在的星期
        inputCaches: {}        // 打卡数据缓存 { [exerciseId]: { weight, reps } }
      },

      // ═══════════════════════════════════════════════════════════════════
      // 纯前端逻辑（计时器、撒花等，无需后端参与）
      // ═══════════════════════════════════════════════════════════════════

      triggerConfetti: () => {
        set({ showConfetti: true });
        setTimeout(() => set({ showConfetti: false }), 4000);
      },

      startGlobalTimer: (seconds, label = '休息') => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
        // 尝试解锁 AudioContext
        if (typeof window !== 'undefined') {
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!window.globalAudioCtx) {
              window.globalAudioCtx = new AudioContext();
            }
            if (window.globalAudioCtx.state === 'suspended') {
              window.globalAudioCtx.resume();
            }
          } catch(e) {}
        }
        
        const endTime = Date.now() + seconds * 1000;
        set({ 
          globalTimer: { 
            isActive: true, 
            timeLeft: seconds, 
            initialTime: seconds, 
            endTime, 
            label 
          } 
        });
      },
      stopGlobalTimer: () => {
        set({ globalTimer: { ...get().globalTimer, isActive: false, endTime: null } });
      },
      resetGlobalTimer: () => {
        const { initialTime, label } = get().globalTimer;
        const endTime = Date.now() + initialTime * 1000;
        set({ 
          globalTimer: { 
            isActive: true, 
            timeLeft: initialTime, 
            initialTime, 
            endTime, 
            label 
          } 
        });
      },
      tickGlobalTimer: () => {
        const { isActive, endTime, initialTime, label } = get().globalTimer;
        if (isActive && endTime) {
          const now = Date.now();
          const remaining = Math.max(0, Math.round((endTime - now) / 1000));
          
          set({ globalTimer: { ...get().globalTimer, timeLeft: remaining } });

          if (remaining === 0) {
            set({ globalTimer: { ...get().globalTimer, isActive: false, endTime: null } });
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 400]);
            }
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('FinFit 提醒', { body: '休息结束，准备下一组！', icon: '/pwa-192x192.png' });
            }
            // 播放提示音 (连续三声滴答)
            if (typeof window !== 'undefined' && window.globalAudioCtx) {
              try {
                const ctx = window.globalAudioCtx;
                if (ctx.state === 'suspended') ctx.resume();
                const playBeep = (freq, timeOffset) => {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);
                  gain.gain.setValueAtTime(0.15, ctx.currentTime + timeOffset);
                  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + timeOffset + 0.3);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start(ctx.currentTime + timeOffset);
                  osc.stop(ctx.currentTime + timeOffset + 0.3);
                };
                playBeep(800, 0);
                playBeep(800, 0.3);
                playBeep(1046.5, 0.6); // 高音收尾
              } catch(e) {}
            }
          }
        }
      },
      clearGlobalTimer: () => {
        set({ globalTimer: { isActive: false, timeLeft: 0, initialTime: 0, endTime: null, label: '' } });
      },

      // ═══════════════════════════════════════════════════════════════════
      // 训练会话逻辑（支持本地持久化防丢失）
      // ═══════════════════════════════════════════════════════════════════

      startWorkout: (selectedDay) => {
        set({
          activeWorkoutSession: {
            isActive: true,
            focusIndex: 0,
            direction: 1,
            selectedDay,
            inputCaches: {}
          }
        });
      },

      updateWorkoutSession: (updates) => {
        set({
          activeWorkoutSession: {
            ...get().activeWorkoutSession,
            ...updates
          }
        });
      },

      finishWorkout: () => {
        set({
          activeWorkoutSession: {
            isActive: false,
            focusIndex: null,
            direction: 1,
            selectedDay: null,
            inputCaches: {}
          }
        });
      },

      // ═══════════════════════════════════════════════════════════════════
      // 社交模块
      // ═══════════════════════════════════════════════════════════════════

      fetchSocialPRs: async () => {
        console.log('[SocialStore] 正在触发刷新...');
        set({ isFetchingSocial: true });
        try {
          const userStr = localStorage.getItem('sharkfit_user');
          const userId = userStr ? JSON.parse(userStr).id : 0;
          
          const data = await apiRequest(`/api/social/recent-prs?current_user_id=${userId}`);
          if (data && Array.isArray(data)) {
            set({ socialPRs: data });
            console.log(`[SocialStore] 刷新成功，获取到 ${data.length} 条动态`);
          }
        } catch (err) {
          console.error('[SocialStore] 刷新失败:', err);
        } finally {
          set({ isFetchingSocial: false });
        }
      },

      updatePublicStatus: async (is_public) => {
        set({ isPublic: is_public });
        await apiRequest('/api/auth/update-public', {
          method: 'POST',
          body: JSON.stringify({ is_public })
        });
      },

      likePR: async (pr_id) => {
        const result = await apiRequest('/api/social/like', {
          method: 'POST',
          body: JSON.stringify({ pr_id })
        });
        if (result) {
          // 重新抓取动态以更新点赞数
          get().fetchSocialPRs();
        }
      },

      fetchNotifications: async () => {
        const data = await apiRequest('/api/social/notifications');
        if (data) {
          set({ socialNotifications: data });
        }
      },

      // ═══════════════════════════════════════════════════════════════════
      // 动作库 CRUD  →  REST API + 本地同步
      // ═══════════════════════════════════════════════════════════════════

      /**
       * 新增动作
       * 1. 先乐观更新本地状态（确保 UI 秒响应）
       * 2. 异步推送到后端
       */
      addExercise: async (exercise) => {
        const id = uuidv4();
        const newExercise = { ...exercise, id };

        // 乐观更新
        set({ exercises: [...get().exercises, newExercise] });

        // 推送到后端
        const result = await apiRequest('/api/exercises', {
          method: 'POST',
          body: JSON.stringify(newExercise),
        });

        // 如果后端返回了数据，用后端版本覆盖（以后端为准）
        if (result) {
          set({
            exercises: get().exercises.map(e => e.id === id ? result : e),
          });
        }
      },

      /**
       * 删除动作 (移至回收站)
       */
      removeExercise: async (id) => {
        const exercise = get().exercises.find(e => e.id === id);
        if (!exercise) return;

        // 本地更新：从 exercises 移除，加入 trash
        set({
          exercises: get().exercises.filter(e => e.id !== id),
          trash: [exercise, ...get().trash]
        });

        // 异步通知后端 (如果后端支持回收站则调用专门接口，目前简单处理为通知删除)
        await apiRequest(`/api/exercises/${id}`, { method: 'DELETE' });
      },

      /**
       * 从回收站还原
       */
      restoreExercise: async (id) => {
        const exercise = get().trash.find(e => e.id === id);
        if (!exercise) return;

        // 本地更新
        set({
          trash: get().trash.filter(e => e.id !== id),
          exercises: [exercise, ...get().exercises]
        });

        // 同步回后端
        await apiRequest('/api/exercises', {
          method: 'POST',
          body: JSON.stringify(exercise),
        });
      },

      /**
       * 彻底删除
       */
      permanentDelete: (id) => {
        set({ trash: get().trash.filter(e => e.id !== id) });
      },

      /**
       * 更新动作属性（如图片 URL、注意事项等）
       */
      updateExercise: async (id, updatedData) => {
        // 乐观更新
        set({ exercises: get().exercises.map(e => e.id === id ? { ...e, ...updatedData } : e) });

        await apiRequest(`/api/exercises/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updatedData),
        });
      },

      // ═══════════════════════════════════════════════════════════════════
      // 周计划修改  →  REST API
      // ═══════════════════════════════════════════════════════════════════

      updateRoutine: async (dayOfWeek, exerciseIds) => {
        // 乐观更新
        set({ routines: get().routines.map(r => r.dayOfWeek === dayOfWeek ? { ...r, exerciseIds } : r) });

        await apiRequest(`/api/routines/${dayOfWeek}`, {
          method: 'PUT',
          body: JSON.stringify({ exerciseIds }),
        });
      },

      /**
       * 🆕 在训练过程中动态插入动作
       * @param {number} dayOfWeek - 星期几
       * @param {string} exerciseId - 要插入的动作 ID
       * @param {number} atIndex - 插入的位置
       */
      insertExerciseToRoutine: async (dayOfWeek, exerciseId, atIndex) => {
        const routines = get().routines;
        const targetRoutine = routines.find(r => r.dayOfWeek === dayOfWeek);
        if (!targetRoutine) return;

        const newIds = [...targetRoutine.exerciseIds];
        newIds.splice(atIndex, 0, exerciseId);

        // 调用现有的 updateRoutine 进行乐观更新和 API 同步
        await get().updateRoutine(dayOfWeek, newIds);
      },

      /**
       * 🆕 重新调整计划中动作的顺序
       */
      reorderRoutineExercise: async (dayOfWeek, fromIndex, toIndex) => {
        const routines = get().routines;
        const targetRoutine = routines.find(r => r.dayOfWeek === dayOfWeek);
        if (!targetRoutine) return;

        const newIds = [...targetRoutine.exerciseIds];
        const [movedItem] = newIds.splice(fromIndex, 1);
        newIds.splice(toIndex, 0, movedItem);

        await get().updateRoutine(dayOfWeek, newIds);
      },

      /**
       * 🆕 交换两天的训练计划
       */
      swapRoutineDays: async (dayA, dayB) => {
        const routines = [...get().routines];
        const idxA = routines.findIndex(r => r.dayOfWeek === dayA);
        const idxB = routines.findIndex(r => r.dayOfWeek === dayB);
        if (idxA === -1 || idxB === -1) return;

        // 交换内容（名称和动作列表），保留 dayOfWeek
        const temp = { name: routines[idxA].name, exerciseIds: routines[idxA].exerciseIds };
        routines[idxA].name = routines[idxB].name;
        routines[idxA].exerciseIds = routines[idxB].exerciseIds;
        routines[idxB].name = temp.name;
        routines[idxB].exerciseIds = temp.exerciseIds;

        set({ routines });

        // 同步到服务器
        await Promise.all([
          apiRequest(`/api/routines/${dayA}`, {
            method: 'PUT',
            body: JSON.stringify({ name: routines[idxA].name, exerciseIds: routines[idxA].exerciseIds }),
          }),
          apiRequest(`/api/routines/${dayB}`, {
            method: 'PUT',
            body: JSON.stringify({ name: routines[idxB].name, exerciseIds: routines[idxB].exerciseIds }),
          })
        ]);
      },

      // ═══════════════════════════════════════════════════════════════════
      // 打卡记录  →  REST API
      // ═══════════════════════════════════════════════════════════════════

      /**
       * 记录训练组
       * 前端仍然负责计算 isPR（用于即时触发撒花），同时后端也会独立计算并存储
       */
      logWorkoutSet: async (exerciseId, weight, reps) => {
        const date = getTodayDateString();
        const history = [...get().history];
        let todayLogIndex = history.findIndex(h => h.date === date);

        if (todayLogIndex === -1) {
          history.push({ date, workouts: [] });
          todayLogIndex = history.length - 1;
        }

        const todayLog = history[todayLogIndex];
        let workoutIndex = todayLog.workouts.findIndex(w => w.exerciseId === exerciseId);

        if (workoutIndex === -1) {
          todayLog.workouts.push({ exerciseId, sets: [] });
          workoutIndex = todayLog.workouts.length - 1;
        }

        // 前端计算 PR（用于即时 UI 反馈）
        let isPR = false;
        let prevMaxWeight = 0;
        history.forEach(day => {
          const w = day.workouts.find(wk => wk.exerciseId === exerciseId);
          if (w) {
            w.sets.forEach(s => {
              if (Number(s.weight) > prevMaxWeight) prevMaxWeight = Number(s.weight);
            });
          }
        });
        
        // 如果当前重量大于历史最高，或者之前从未有过记录，则视为新 PR
        if (Number(weight) > prevMaxWeight || prevMaxWeight === 0) {
          isPR = true;
        }

        const localId = uuidv4();
        todayLog.workouts[workoutIndex].sets.push({
          id: localId,
          weight: Number(weight),
          reps: Number(reps),
          isPR,
        });

        // 乐观更新本地
        set({ history });

        if (isPR) {
          get().triggerConfetti();
        }

        // 推送到后端
        const result = await apiRequest('/api/records', {
          method: 'POST',
          body: JSON.stringify({ exerciseId, date, weight: Number(weight), reps: Number(reps) }),
        });

        // 后端返回了真实 ID 和 isPR 判定，更新本地记录
        if (result) {
          const currentHistory = [...get().history];
          const dayLog = currentHistory.find(h => h.date === date);
          if (dayLog) {
            const workout = dayLog.workouts.find(w => w.exerciseId === exerciseId);
            if (workout) {
              const setIndex = workout.sets.findIndex(s => s.id === localId);
              if (setIndex !== -1) {
                workout.sets[setIndex] = {
                  id: result.id,
                  weight: result.weight,
                  reps: result.reps,
                  isPR: result.isPR === 1 || result.isPR === true,
                };
              }
            }
          }
          set({ history: currentHistory });
        }

        if (isPR) {
          get().triggerConfetti();
          // 🆕 立即抓取最新社交动态，让自己的 PR 瞬间出现在榜单上
          get().fetchSocialPRs();
        }

        return isPR;
      },

      /**
       * 删除某一组记录
       */
      removeWorkoutSet: async (date, exerciseId, setId) => {
        // 乐观更新
        const history = [...get().history];
        const dayIndex = history.findIndex(h => h.date === date);
        if (dayIndex !== -1) {
          const workout = history[dayIndex].workouts.find(w => w.exerciseId === exerciseId);
          if (workout) {
            workout.sets = workout.sets.filter(s => s.id !== setId);
            set({ history });
          }
        }

        // 推送到后端
        await apiRequest(`/api/records/${setId}`, { method: 'DELETE' });
      },

      // ═══════════════════════════════════════════════════════════════════
      // 数据同步：从后端全量拉取
      // ═══════════════════════════════════════════════════════════════════

      /**
       * 从后端一次性拉取全部数据
       * 后端 /api/sync/pull 会返回组装好的 { exercises, routines, history }
       */
      pullData: async () => {
        set({ isPulling: true });
        try {
          const data = await apiRequest('/api/sync/pull');
          if (data && data.exercises && data.routines) {
            set({
              exercises: data.exercises,
              routines: data.routines,
              history: data.history || [],
              bodyWeight: data.bodyWeight || [],
            });
            console.log('[同步] 数据拉取成功');
          }
        } catch (error) {
          console.error('[同步] 拉取数据失败:', error);
        } finally {
          set({ isPulling: false });
        }
      },

      /**
       * 记录体重（乐观更新：先更新本地状态，再推送后端）
       */
      addBodyWeight: async (weight, date) => {
        const numWeight = Number(weight);
        // 1. 立即更新本地状态（乐观更新，UI 秒响应）
        set(state => {
          const filtered = state.bodyWeight.filter(bw => bw.date !== date);
          const newEntry = { id: `temp-${Date.now()}`, weight: numWeight, date };
          const newList = [...filtered, newEntry].sort((a, b) => a.date.localeCompare(b.date));
          return { bodyWeight: newList };
        });

        // 2. 后台推送到后端
        try {
          const result = await apiRequest('/api/bodyweight', {
            method: 'POST',
            body: JSON.stringify({ weight: numWeight, date }),
          });
          // 用后端返回的真实 ID 替换临时 ID
          if (result) {
            set(state => {
              const updated = state.bodyWeight.map(bw => 
                bw.date === date && bw.id?.startsWith('temp-') ? { ...bw, id: result.id } : bw
              );
              return { bodyWeight: updated };
            });
          }
        } catch (error) {
          console.error('[体重] 后端同步失败:', error);
        }
      },
      
      /**
       * 删除体重记录
       */
      removeBodyWeight: async (id, date) => {
        // 1. 乐观更新
        set(state => ({
          bodyWeight: state.bodyWeight.filter(bw => bw.date !== date)
        }));

        // 2. 推送到后端
        try {
          await apiRequest(`/api/bodyweight/${date}`, { method: 'DELETE' });
        } catch (error) {
          console.error('[体重] 删除失败:', error);
        }
      },

      // ── 系统公告管理 ─────────────────────────────────────────────────────
      fetchAnnouncement: async () => {
        const data = await apiRequest('/api/announcement/latest');
        if (data) set({ announcement: data });
      },

      fetchAnnouncementHistory: async () => {
        return await apiRequest('/api/announcements');
      },

      publishAnnouncement: async (ann) => {
        const data = await apiRequest('/api/announcements', {
          method: 'POST',
          body: JSON.stringify(ann)
        });
        if (data?.success) {
          get().fetchAnnouncement(); // 刷新最新一条
          return { success: true };
        }
        return { success: false, error: '发布失败' };
      },

      deleteAnnouncement: async (id) => {
        const data = await apiRequest(`/api/announcements/${id}`, { method: 'DELETE' });
        if (data?.success) {
          get().fetchAnnouncement(); // 刷新最新一条
          // ⚠️ 这里必须手动触发一下历史记录的重新拉取，或者让组件感知到变化
          return true;
        }
        return false;
      },

      dismissAnnouncement: (id) => {
        set({ dismissedAnnouncementId: id });
      },

    }),
    {
      name: 'fitness-pwa-storage', // localStorage key (保留离线缓存能力)
      partialize: (state) => ({
        exercises: state.exercises,
        routines: state.routines,
        history: state.history,       // 持久化训练记录（离线缓存）
        activeWorkoutSession: state.activeWorkoutSession,
        trash: state.trash,
        hasSeenWelcome: state.hasSeenWelcome,
        bodyWeight: state.bodyWeight,
        isPublic: state.isPublic, // 🆕 持久化隐私设置，防止开关回弹
        dismissedAnnouncementId: state.dismissedAnnouncementId, // 🆕 持久化已读公告
      }),
    }
  )
);

export default useFitnessStore;
