/**
 * IndexedDB 封装：打开数据库、升级逻辑、Promise 化 CRUD
 */

import { DB_NAME, DB_VERSION, STORE_NAMES, type StoreName } from './config';

let dbInstance: IDBDatabase | null = null;

/**
 * 打开数据库，若已打开则返回同一实例
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAMES.KV)) {
        db.createObjectStore(STORE_NAMES.KV);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.RECORDS)) {
        const store = db.createObjectStore(STORE_NAMES.RECORDS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * 关闭数据库连接（一般无需主动调用）
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * 获取 KV Store 的 value（按 key）
 */
export async function get<T = unknown>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
}

/**
 * 写入 KV Store（key-value）
 */
export async function set(storeName: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 删除指定 key
 */
export async function remove(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 清空整个 Store
 */
export async function clear(storeName: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 获取 Store 中所有 key
 */
export async function getAllKeys(storeName: StoreName): Promise<IDBValidKey[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAllKeys();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * 获取 Store 中所有记录（KV 为 key-value 列表，Records 为对象数组）
 */
export async function getAll<T = unknown>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

// —————— Records Store 专用：keyPath 为 id，支持增删改查 ——————

export interface RecordWithId {
  id?: number;
  createdAt?: number;
  [key: string]: unknown;
}

/**
 * 向 Records Store 添加一条记录（自动生成 id 和 createdAt）
 */
export async function addRecord<T extends RecordWithId>(data: Omit<T, 'id' | 'createdAt'>): Promise<number> {
  const db = await openDB();
  const record = {
    ...data,
    createdAt: Date.now(),
  } as T;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES.RECORDS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.RECORDS);
    const request = store.add(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
}

/**
 * 按 id 更新 Records Store 中的记录
 */
export async function putRecord<T extends RecordWithId>(record: T): Promise<void> {
  const db = await openDB();
  const withTime = { ...record, updatedAt: Date.now() } as T & { updatedAt: number };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES.RECORDS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.RECORDS);
    const request = store.put(withTime);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 按 id 删除 Records Store 中的记录
 */
export async function deleteRecord(id: number): Promise<void> {
  return remove(STORE_NAMES.RECORDS, id);
}

/**
 * 按 id 获取 Records Store 中的单条记录
 */
export async function getRecord<T = RecordWithId>(id: number): Promise<T | undefined> {
  return get<T>(STORE_NAMES.RECORDS, id);
}
