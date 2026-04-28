const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('server/sharkfit.db');

const email = '1501677369@qq.com';
const codes = db.prepare('SELECT * FROM verification_codes WHERE email = ?').all(email);
console.log('Codes for', email);
console.log(JSON.stringify(codes, null, 2));

const now = db.prepare("SELECT datetime('now') as now").get().now;
console.log('Current DB time:', now);
