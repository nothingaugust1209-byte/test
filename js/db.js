// IndexedDBラッパー。SRS状態・クイズ履歴・設定を端末内に保存する。
const DB_NAME = 'jouhouriron-db';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('srs')) {
        db.createObjectStore('srs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quizHistory')) {
        db.createObjectStore('quizHistory', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return reqToPromise(store.getAll());
  },
  async get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return reqToPromise(store.get(key));
  },
  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.put(value));
  },
  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.delete(key));
  },
  async add(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.add(value));
  },
  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.clear());
  }
};

// ---- Settings helpers ----
export async function getSetting(key, fallback = null) {
  const rec = await db.get('settings', key);
  return rec ? rec.value : fallback;
}
export async function setSetting(key, value) {
  return db.put('settings', { key, value });
}

// ---- Streak tracking ----
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordActivityToday() {
  const streakData = await getSetting('streak', { lastDate: null, count: 0 });
  const today = todayStr();
  if (streakData.lastDate === today) return streakData;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let count = 1;
  if (streakData.lastDate === yesterday) count = streakData.count + 1;
  const updated = { lastDate: today, count };
  await setSetting('streak', updated);
  return updated;
}

export async function getStreak() {
  const streakData = await getSetting('streak', { lastDate: null, count: 0 });
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (streakData.lastDate !== today && streakData.lastDate !== yesterday) {
    return 0;
  }
  return streakData.count;
}
