import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useFitnessStore from '../store/useFitnessStore';
import { getDayOfWeek, getTodayDateString } from '../utils/dateUtils';
import ActiveExerciseView from '../components/ActiveExerciseView';
import { getDynamicRoutineName } from '../utils/routineUtils';
import { Check, ChevronRight } from 'lucide-react';

const WorkoutFlow = () => {
  const navigate = useNavigate();
  const { routines, exercises, history, activeWorkoutSession, startWorkout, updateWorkoutSession, finishWorkout } = useFitnessStore();
  const { isActive, focusIndex, direction, inputCaches, overrides = {} } = activeWorkoutSession;

  const today = getDayOfWeek();
  const todayStr = getTodayDateString();
  const [selectedDay, setSelectedDay] = useState(today);
  const daysLabels = ['日', '一', '二', '三', '四', '五', '六'];

  // 1. 查看模式下的动作列表 (跟随顶部切换)
  const viewedRoutine = useMemo(
    () => routines.find(r => r.dayOfWeek === selectedDay) || null,
    [routines, selectedDay]
  );

  const viewedExercises = useMemo(() => {
    if (!viewedRoutine) return [];
    return viewedRoutine.exerciseIds
      .map(id => exercises.find(e => e.id === id))
      .filter(Boolean);
  }, [viewedRoutine, exercises]);

  // 2. 训练模式下的动作列表 (锁定在开练日期)
  const trainingDay = activeWorkoutSession.selectedDay;
  const trainingRoutine = useMemo(
    () => (isActive && trainingDay !== null) ? routines.find(r => r.dayOfWeek === trainingDay) : viewedRoutine,
    [routines, trainingDay, isActive, viewedRoutine]
  );

  const trainingExercises = useMemo(() => {
    if (!trainingRoutine) return [];
    return trainingRoutine.exerciseIds
      .map(id => overrides[id] ? overrides[id] : id)
      .map(id => exercises.find(e => e.id === id))
      .filter(Boolean);
  }, [trainingRoutine, exercises, overrides]);

  const getCache = useCallback((id) => inputCaches[id] || { weight: '', reps: '' }, [inputCaches]);

  const updateCache = useCallback((id, field, value) => {
    updateWorkoutSession({
      inputCaches: {
        ...inputCaches,
        [id]: { ...(inputCaches[id] || { weight: '', reps: '' }), [field]: value },
      }
    });
  }, [inputCaches, updateWorkoutSession]);

  const currentExercise = (isActive && focusIndex !== null && trainingExercises[focusIndex]) ? trainingExercises[focusIndex] : null;

  const enterFocus = (index, dir = 1) => {
    // 如果点击的是正在看的日期，但还没开练，则开始新训练
    if (!isActive) {
      startWorkout(selectedDay);
    } else if (selectedDay !== trainingDay) {
      // 如果正在练 A 日，却点击了 B 日的动作，建议先回到 A 日或直接切换到 A 日的焦点
      setSelectedDay(trainingDay);
      return;
    }
    updateWorkoutSession({ focusIndex: index, direction: dir });
  };

  const handlePrev = () => { if (focusIndex > 0) updateWorkoutSession({ focusIndex: focusIndex - 1, direction: -1 }); };
  const handleNext = () => {
    if (focusIndex < trainingExercises.length - 1) updateWorkoutSession({ focusIndex: focusIndex + 1, direction: 1 });
    else finishWorkout();
  };

  const getSetsToday = (exerciseId) => {
    const day = history.find(h => h.date === todayStr);
    const w = day?.workouts.find(wk => wk.exerciseId === exerciseId);
    return w?.sets?.length ?? 0;
  };

  return (
    <div className="relative h-full overflow-hidden bg-neutral-950">
      {currentExercise ? (
        <ActiveExerciseView
          key="active-exercise-container"
          exercise={currentExercise}
          index={focusIndex}
          total={trainingExercises.length}
          direction={direction}
          onPrev={handlePrev}
          onNext={handleNext}
          onBackToList={() => updateWorkoutSession({ focusIndex: null, direction: -1 })}
          inputCache={getCache(currentExercise.id)}
          onInputChange={(field, val) => updateCache(currentExercise.id, field, val)}
          onReplace={(newExId) => {
            const originalId = trainingRoutine.exerciseIds[focusIndex];
            updateWorkoutSession({ overrides: { ...overrides, [originalId]: newExId } });
          }}
        />
      ) : (
        <motion.div
          key="overview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-28 scrollbar-hide"
        >
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-3xl font-black text-white">训练流</h1>
          </div>

            <div className="flex justify-between items-center bg-neutral-900/40 p-1.5 rounded-2xl mb-6 border border-white/5">
              {daysLabels.map((label, index) => {
                const isTrainingThisDay = isActive && trainingDay === index;
                const isToday = index === today;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDay(index)}
                    className={`relative flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
                      selectedDay === index 
                        ? 'bg-primary text-white shadow-md' 
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <span className="text-xs font-black">{label}</span>
                    
                    {/* 状态小圆点容器 */}
                    <div className="absolute -bottom-1 flex gap-0.5">
                      {isToday && <div className="w-1 h-1 rounded-full bg-white/40" />}
                      {isTrainingThisDay && <div className="w-1 h-1 rounded-full bg-white animate-pulse shadow-[0_0_5px_white]" />}
                    </div>
                    
                    {/* 正在训练的外环 */}
                    {isTrainingThisDay && selectedDay !== index && (
                      <div className="absolute inset-0 border-2 border-primary/30 rounded-xl animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>

            {viewedRoutine && (
              <div className="text-center mb-5">
                <span className="inline-block text-[11px] bg-neutral-900 border border-white/5 text-primary px-4 py-1.5 rounded-full font-black uppercase tracking-widest">
                  {getDynamicRoutineName(viewedRoutine, exercises)}
                </span>
              </div>
            )}

            {viewedExercises.length > 0 ? (
              <div className="space-y-3">
                {viewedExercises.map((ex, idx) => {
                  const setsCount = getSetsToday(ex.id);
                  const isStarted = setsCount > 0;
                  const isClickable = !isActive || (isActive && selectedDay === trainingDay);
                  
                  return (
                    <button
                      key={ex.id}
                      onClick={() => isClickable && enterFocus(idx, 1)}
                      className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                        isClickable ? 'bg-neutral-900 border-white/5 active:scale-95' : 'bg-neutral-900/40 border-transparent opacity-60 grayscale'
                      }`}
                    >
                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${isStarted ? 'bg-primary/20 text-primary' : 'bg-neutral-800 text-neutral-500'}`}>
                        {isStarted ? <Check size={18} strokeWidth={3} /> : idx + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-bold text-white text-base">{ex.name}</div>
                        <div className="text-xs text-neutral-500 font-bold mt-0.5">{ex.sets}组 · {ex.reps}次</div>
                      </div>
                      {isClickable ? <ChevronRight size={18} className="text-neutral-600" /> : <div className="text-[10px] font-bold text-neutral-700">预览</div>}
                    </button>
                  );
                })}
                
                <div className="pt-4">
                  {isActive ? (
                    <div className="space-y-3">
                      {selectedDay === trainingDay ? (
                        <button onClick={() => enterFocus(focusIndex || 0, 1)} className="w-full py-4 bg-primary rounded-2xl font-black text-white text-lg shadow-lg shadow-primary/20 btn-scale">
                          ⚡ 恢复训练
                        </button>
                      ) : (
                        <button onClick={() => setSelectedDay(trainingDay)} className="w-full py-4 bg-neutral-800 border border-primary/30 text-primary rounded-2xl font-black text-lg btn-scale">
                          返回正在进行的训练 ({daysLabels[trainingDay]})
                        </button>
                      )}
                      <button onClick={finishWorkout} className="w-full py-3 rounded-2xl font-bold text-red-500 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">结束训练</button>
                    </div>
                  ) : (
                    <button onClick={() => enterFocus(0, 1)} className="w-full py-4 bg-primary rounded-2xl font-black text-white text-lg shadow-lg shadow-primary/20 btn-scale">
                      ⚡ 开始训练
                    </button>
                  )}
                </div>
              </div>
          ) : (
            <div className="flex flex-col items-center justify-center mt-24 text-neutral-500 space-y-4">
              <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center text-2xl">💤</div>
              <p>休息日，好好恢复！</p>
              <button onClick={() => navigate('/')} className="text-sm text-primary border border-primary/30 px-4 py-2 rounded-full">返回主页</button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default WorkoutFlow;
