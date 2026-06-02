import Dexie from 'dexie';

const db = new Dexie('QuestDoDB');

db.version(1).stores({
  tasks: '++id, userId, due_date, completed, category, difficulty, important, [userId+due_date], updated_at, version, sync_status, temp_id',
  user: 'username, updated_at, version, sync_status',
  achievements: '++id, userId, name, unlocked_at, [userId+name], version, sync_status',
  rare_drops: '++id, userId, name, obtained_at, [userId+name], version, sync_status',
  syncQueue: '++id, endpoint, method, status, created_at',
  rankings: 'type, updated_at, version, sync_status'
});

export default db;
