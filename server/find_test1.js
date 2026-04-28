const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'sharkfit.db'));

// 全局搜索所有名为 'test1' 的动作
const results = db.prepare(`
  SELECT 
    e.id as exercise_id, 
    e.name, 
    e.user_id, 
    u.email, 
    u.role 
  FROM exercises e
  JOIN users u ON e.user_id = u.id
  WHERE e.name LIKE '%test1%'
`).all();

console.log('--- "test1" 动作全量搜索结果 ---');
console.log(results);

// 同时检查 seedData.js 导入后的内存对象，看看里面有没有脏数据
const { defaultExercises } = require('./seedData');
const seedConflict = defaultExercises.filter(ex => ex.name.includes('test1'));
console.log('--- seedData.js 中包含 "test1" 的项 ---');
console.log(seedConflict);
