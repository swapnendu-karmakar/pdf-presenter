const DB_NAME = 'pdf_slide_presenter_db';
const DB_VERSION = 1;
const STORE_NAME = 'presentations';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete('active_presentation');
      } catch {}
      resolve(db);
    };

    request.onerror = () => reject(request.error || new Error('Failed to open database'));
  });
}

export async function savePresentation(sessionId, meta, blob) {
  if (!sessionId) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: sessionId,
        meta,
        blob,
        savedAt: new Date().toISOString(),
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to save presentation'));
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not save presentation to local storage:', err);
  }
}

export async function getPresentation(sessionId) {
  if (!sessionId) return null;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(sessionId);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          resolve({
            meta: result.meta,
            blob: result.blob,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error || new Error('Failed to read presentation'));
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not read presentation from local storage:', err);
    return null;
  }
}

export async function clearPresentation(sessionId) {
  if (!sessionId) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(sessionId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to clear presentation'));
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not clear presentation from local storage:', err);
  }
}
