const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sharkfit.db');
const db = new Database(DB_PATH);

db.transaction(() => {
  // 1. 删除所有饮食记录（因为它们关联了旧的食物ID）
  db.prepare('DELETE FROM diet_logs').run();
  
  // 2. 删除所有食物
  db.prepare('DELETE FROM foods').run();
  
  // 重置自增 ID
  db.prepare("DELETE FROM sqlite_sequence WHERE name='foods'").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='diet_logs'").run();

  // 3. 重新播种新的食物
  const defaultFoods = [
    ['鸡蛋', 155, 13.0, 1.1, 11.0],
    ['鸡蛋白', 52, 11.0, 0.7, 0.2],
    ['燕麦', 379, 13.0, 67.0, 6.5],
    ['纯土豆泥', 86, 1.6, 17.5, 0.2],
    ['黄瓜', 16, 0.7, 3.6, 0.1],
    ['西红柿', 18, 0.9, 3.9, 0.2],
  ];

  const insertFood = db.prepare(`
    INSERT INTO foods (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_by)
    VALUES (?, ?, ?, ?, ?, 'system')
  `);

  for (const [name, cal, protein, carbs, fat] of defaultFoods) {
    insertFood.run(name, cal, protein, carbs, fat);
  }
})();

console.log('✅ 数据库中旧的食物和饮食记录已被清空，并重新播种了指定的 6 种食物。');
