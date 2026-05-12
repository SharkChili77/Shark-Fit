const Database = require('../server/db');

function inspect() {
  console.log('--- Database Inspection ---');
  
  const users = Database.prepare('SELECT id, email, role FROM users').all();
  console.log('Users:');
  console.table(users);
  
  const workoutSetsCount = Database.prepare('SELECT COUNT(*) as cnt FROM workout_sets').get();
  console.log('Total Workout Sets:', workoutSetsCount.cnt);
  
  const bodyWeightCount = Database.prepare('SELECT COUNT(*) as cnt FROM body_weight').get();
  console.log('Total Body Weight Records:', bodyWeightCount.cnt);
  
  const exercisesCount = Database.prepare('SELECT COUNT(*) as cnt FROM exercises').get();
  console.log('Total Exercises:', exercisesCount.cnt);

  // Check for records with NULL user_id
  const nullUserSets = Database.prepare('SELECT COUNT(*) as cnt FROM workout_sets WHERE user_id IS NULL').get();
  console.log('Workout Sets with NULL user_id:', nullUserSets.cnt);
  
  if (users.length > 0) {
    const userStats = Database.prepare(`
      SELECT u.id, u.email, 
             (SELECT COUNT(*) FROM workout_sets WHERE user_id = u.id) as sets_count
      FROM users u
    `).all();
    console.log('Stats per User:');
    console.table(userStats);
  }
}

inspect();
process.exit(0);
