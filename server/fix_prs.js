const db = require('./db');
try {
  const result = db.prepare(`
    UPDATE workout_sets 
    SET isPR = 1 
    WHERE id IN (
      SELECT ws.id 
      FROM workout_sets ws 
      INNER JOIN (
        SELECT user_id, exerciseId, MAX(weight) as maxW 
        FROM workout_sets 
        GROUP BY user_id, exerciseId
      ) grouped 
      ON ws.user_id = grouped.user_id 
      AND ws.exerciseId = grouped.exerciseId 
      AND ws.weight = grouped.maxW
    )
  `).run();
  console.log('Successfully updated PRs count:', result.changes);
} catch (e) {
  console.error('Update failed:', e.message);
}
process.exit();
