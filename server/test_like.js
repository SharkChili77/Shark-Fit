const db = require('./db');

// 1. 检查 likes 表是否存在
try {
  const tableInfo = db.prepare("PRAGMA table_info(likes)").all();
  console.log('1. likes 表结构:', tableInfo.length > 0 ? '存在' : '不存在');
  if (tableInfo.length > 0) {
    console.log('   列:', tableInfo.map(c => c.name).join(', '));
  }
} catch(e) {
  console.log('1. likes 表不存在:', e.message);
}

// 2. 获取一个用户的 token 信息
const users = db.prepare('SELECT id, username, email FROM users LIMIT 3').all();
console.log('\n2. 用户列表:', users);

// 3. 获取 PR 记录
const prs = db.prepare('SELECT id, exerciseId, weight, isPR, user_id FROM workout_sets WHERE isPR = 1 LIMIT 5').all();
console.log('\n3. PR 记录:', prs);

// 4. 模拟点赞
if (users.length > 0 && prs.length > 0) {
  const userId = users[0].id;
  const prId = prs[0].id;
  console.log(`\n4. 模拟点赞: 用户 ${userId} 点赞 PR ${prId}`);
  
  // 先检查是否已点赞
  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND pr_id = ?').get(userId, prId);
  if (existing) {
    console.log('   已点过赞，执行取消');
    db.prepare('DELETE FROM likes WHERE user_id = ? AND pr_id = ?').run(userId, prId);
    console.log('   取消成功');
  } else {
    console.log('   未点赞，执行点赞');
    db.prepare('INSERT INTO likes (user_id, pr_id) VALUES (?, ?)').run(userId, prId);
    console.log('   点赞成功');
  }
  
  // 5. 验证结果
  const count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE pr_id = ?').get(prId);
  console.log(`   当前该 PR 的点赞数: ${count.c}`);
}

// 6. 模拟完整的 recent-prs 查询（带点赞状态）
if (users.length > 0) {
  const currentUserId = users[0].id;
  console.log(`\n5. 模拟 recent-prs 查询 (当前用户 ID: ${currentUserId}):`);
  const result = db.prepare(`
    SELECT 
      ws.id as pr_id,
      u.username,
      e.name as exerciseName,
      ws.weight,
      ws.reps,
      ws.created_at as date,
      (SELECT COUNT(*) FROM likes WHERE pr_id = ws.id) as likesCount,
      (SELECT COUNT(*) FROM likes WHERE pr_id = ws.id AND user_id = ?) as hasLiked
    FROM workout_sets ws
    JOIN users u ON ws.user_id = u.id
    JOIN exercises e ON ws.exerciseId = e.id
    WHERE u.is_public = 1 AND ws.isPR = 1
    ORDER BY ws.created_at DESC
    LIMIT 5
  `).all(currentUserId);
  
  result.forEach(r => {
    console.log(`   ${r.exerciseName} ${r.weight}kg | likes: ${r.likesCount} | hasLiked: ${r.hasLiked} | pr_id: ${r.pr_id}`);
  });
}

process.exit();
