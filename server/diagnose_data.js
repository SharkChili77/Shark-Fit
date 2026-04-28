const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'sharkfit.db'));

// 查询所有用户及其动作数量
const report = db.prepare(`
  SELECT 
    u.id, 
    u.email, 
    u.role,
    (SELECT COUNT(*) FROM exercises WHERE user_id = u.id) as exercise_count
  FROM users u
`).all();

console.log('User Data Report:', report);

// 随机抽查一个新用户的动作名称，看看是不是那 31 个里的
const newUser = report.find(u => u.role === 'user');
if (newUser) {
    const samples = db.prepare('SELECT name FROM exercises WHERE user_id = ? LIMIT 5').all(newUser.id);
    console.log(`Sample exercises for ${newUser.email}:`, samples);
}
