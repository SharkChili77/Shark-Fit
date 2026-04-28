const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = new Database(path.join(__dirname, 'sharkfit.db'));
const { defaultExercises, defaultRoutines } = require('./seedData');

const targetEmail = '2803561339@qq.com';
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(targetEmail);

if (!user) {
    console.error(`User ${targetEmail} not found`);
    process.exit(1);
}

const targetUserId = user.id;

const resetTransaction = db.transaction(() => {
    // 1. 清空该用户现有的所有动作和计划
    db.prepare('DELETE FROM exercises WHERE user_id = ?').run(targetUserId);
    db.prepare('DELETE FROM routines WHERE user_id = ?').run(targetUserId);

    // 2. 重新插入标准的 31 个动作
    const idMap = {};
    const insertEx = db.prepare(`
        INSERT INTO exercises (id, name, target, sets, reps, rest, imageUrl, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ex of defaultExercises) {
        const newId = uuidv4();
        idMap[ex.id] = newId;
        insertEx.run(newId, ex.name, ex.target, ex.sets, ex.reps, ex.rest, ex.imageUrl, ex.notes, targetUserId);
    }

    // 3. 重新插入标准周计划
    const insertRt = db.prepare(`
        INSERT INTO routines (dayOfWeek, name, exerciseIds, user_id)
        VALUES (?, ?, ?, ?)
    `);

    for (const r of defaultRoutines) {
        const newIds = r.exerciseIds.map(oldId => idMap[oldId] || oldId);
        insertRt.run(r.dayOfWeek, r.name, JSON.stringify(newIds), targetUserId);
    }
});

resetTransaction();
console.log(`✅ 已成功重置用户 ${targetEmail} 的数据为 31 个标准动作。`);

// 最后的核验
const finalCount = db.prepare('SELECT COUNT(*) as cnt FROM exercises WHERE user_id = ?').get(targetUserId);
console.log(`目前该用户动作总数: ${finalCount.cnt}`);
