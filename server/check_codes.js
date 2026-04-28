const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'sharkfit.db'));

const codes = db.prepare("SELECT email, code, used, expires_at FROM verification_codes").all();
console.log('All Verification Codes:', codes);
