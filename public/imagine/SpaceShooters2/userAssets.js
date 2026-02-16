// ==================== userAssets.js ====================
const DB_NAME = 'SpaceShootersDB';
const DB_VERSION = 1;
const STORE_NAME = 'userAssets';

let db = null;

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// Save a user asset (file) with a unique ID (e.g., 'user_bg_1')
async function saveUserAsset(id, file) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const asset = { id, file, name: file.name, type: file.type, lastModified: file.lastModified };
        const request = store.put(asset);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Load a user asset (returns a Blob)
async function loadUserAsset(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.file);
        request.onerror = () => reject(request.error);
    });
}

// Get all user assets (for listing in options)
async function getAllUserAssets() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Delete a user asset
async function deleteUserAsset(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Convert a Blob to an object URL (for use in <audio>/<video> or Image)
function blobToURL(blob) {
    return URL.createObjectURL(blob);
}

// Revoke an object URL when done
function revokeURL(url) {
    URL.revokeObjectURL(url);
}

// Expose functions globally
window.userAssets = {
    save: saveUserAsset,
    load: loadUserAsset,
    getAll: getAllUserAssets,
    delete: deleteUserAsset,
    blobToURL,
    revokeURL
};
