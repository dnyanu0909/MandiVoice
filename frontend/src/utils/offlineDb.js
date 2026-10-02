const DB_NAME = 'MandiVoiceDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_trades';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function saveOfflineTrade(tradeData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      ...tradeData,
      synced: false,
      created_at: tradeData.created_at || new Date().toISOString(),
    };

    const request = store.add(record);

    request.onsuccess = (event) => {
      record.id = event.target.result;
      resolve(record);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function getUnsyncedTrades() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      const allTrades = event.target.result || [];
      const unsynced = allTrades.filter((t) => t.synced === false);
      resolve(unsynced);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function markTradesSynced(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const idSet = new Set(ids);
    const request = store.getAll();

    request.onsuccess = (event) => {
      const allTrades = event.target.result || [];
      for (const item of allTrades) {
        if (idSet.has(item.id)) {
          item.synced = true;
          store.put(item);
        }
      }
      resolve(true);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function getAllLocalTrades() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}
