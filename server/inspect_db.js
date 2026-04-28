const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'sharkfit.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

for (const table of tables) {
    if (table.name === 'sqlite_sequence') continue;
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${table.name}`).get();
    console.log(`Table ${table.name}: ${count.cnt} rows`);
}
