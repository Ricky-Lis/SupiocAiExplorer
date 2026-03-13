/**
 * IndexedDB 统一导出
 *
 * 使用示例：
 *   import { get, set, STORE_NAMES, addRecord, getAll } from '@/db';
 *   await set(STORE_NAMES.KV, 'settings', { theme: 'dark' });
 *   const settings = await get(STORE_NAMES.KV, 'settings');
 *   const id = await addRecord({ type: 'chat', title: 'New Chat' });
 *   const list = await getAll(STORE_NAMES.RECORDS);
 */

export { DB_NAME, DB_VERSION, STORE_NAMES, CHAT_KV_KEYS } from './config';
export type { StoreName } from './config';

export {
  openDB,
  closeDB,
  get,
  set,
  remove,
  clear,
  getAllKeys,
  getAll,
  addRecord,
  putRecord,
  deleteRecord,
  getRecord,
} from './indexedDB';

export type { RecordWithId } from './indexedDB';
