const db = require('./db');
try {
  console.log('--- 诊断开始 ---');
  
  // 1. 查总数
  const totalSets = db.prepare('SELECT COUNT(*) as count FROM workout_sets').get().count;
  console.log('1. 总打卡组数:', totalSets);

  // 2. 查 PR 总数
  const prSets = db.prepare('SELECT COUNT(*) as count FROM workout_sets WHERE isPR = 1').get().count;
  console.log('2. PR 组数:', prSets);

  // 3. 查用户公开状态
  const publicUsers = db.prepare('SELECT id, username, is_public FROM users').all();
  console.log('3. 用户公开状态:', publicUsers);

  // 4. 执行完整 JOIN 查询
  const result = db.prepare(`
    SELECT 
      u.username,
      e.name as exerciseName,
      ws.weight,
      ws.isPR,
      u.is_public
    FROM workout_sets ws
    JOIN users u ON ws.user_id = u.id
    JOIN exercises e ON ws.exerciseId = e.id
    WHERE ws.isPR = 1
  `).all();
  console.log('4. 关联查询结果 (未过滤 is_public):', result);

  const finalResult = result.filter(r => r.is_public === 1);
  console.log('5. 最终过滤后的结果:', finalResult);

} catch (e) {
  console.error('诊断失败:', e.message);
}
process.exit();
