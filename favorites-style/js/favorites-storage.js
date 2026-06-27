/**
 * 本地收藏夹存储（IndexedDB，不上传云端）
 */
const FavoritesStorage = (() => {
    const DB_NAME = 'favorites-style-db';
    const DB_VERSION = 1;
    const STORE_NAME = 'uploads';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
                }
            };
        });
    }

    async function getAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readonly')
                .objectStore(STORE_NAME)
                .index('uploadedAt')
                .getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const items = request.result.sort((a, b) => b.uploadedAt - a.uploadedAt);
                resolve(items);
            };
        });
    }

    async function getById(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readonly')
                .objectStore(STORE_NAME)
                .get(id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    }

    async function save(name, content) {
        const db = await openDB();
        const item = {
            id: generateId(),
            name,
            content,
            uploadedAt: Date.now(),
            size: new Blob([content]).size
        };

        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readwrite')
                .objectStore(STORE_NAME)
                .add(item);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(item);
        });
    }

    async function remove(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readwrite')
                .objectStore(STORE_NAME)
                .delete(id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    function generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'fav-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    return { getAll, getById, save, remove };
})();
