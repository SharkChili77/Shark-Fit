export const getDynamicRoutineName = (routine, exercises) => {
  if (!routine || !routine.exerciseIds || routine.exerciseIds.length === 0) {
    return '休息';
  }

  const targets = new Set();
  routine.exerciseIds.forEach(id => {
    const ex = exercises.find(e => e.id === id);
    if (ex && ex.target) {
      // 统一命名，如将"腹部"简称为"腹"
      let targetName = ex.target;
      if (targetName === '腹部') targetName = '腹';
      targets.add(targetName);
    }
  });

  if (targets.size === 0) return '未命名计划';

  return Array.from(targets).join(' + ');
};
