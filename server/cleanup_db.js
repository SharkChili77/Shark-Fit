const db = require('./db');
try {
  const result = db.prepare("UPDATE system_config SET value = '' WHERE value = 'undefined' OR value IS NULL").run();
  console.log('清理成功，影响行数:', result.changes);
} catch (e) {
  console.error('清理失败:', e.message);
}
process.exit(0);
