const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'sharkfit.db'));

const users = db.prepare("SELECT id, email, role FROM users").all();
console.log('Current Users:', users);
