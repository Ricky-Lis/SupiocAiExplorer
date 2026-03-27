import type { ApiKeyItem } from '../types';

/**
 * 从 Supioc / New API 风格的 GET /api/token/ 响应中取出令牌数组。
 * 不同部署可能使用 data.items、data.list、或 data 即为数组等形态。
 */
export function extractTokenListItems(json: unknown): unknown[] {
  if (json == null || typeof json !== 'object') return [];
  const root = json as Record<string, unknown>;
  const data = root.data;
  if (Array.isArray(data)) return data;
  if (data != null && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.list)) return d.list;
    if (Array.isArray(d.records)) return d.records;
  }
  if (Array.isArray(root.items)) return root.items;
  return [];
}

/** 是否已软删除（兼容 deleted_at / DeletedAt） */
function isTokenDeleted(it: Record<string, unknown>): boolean {
  const d = it.deleted_at ?? it.DeletedAt;
  return d != null && d !== '';
}

/**
 * 是否视为可用：未删除且非明确禁用（status=2）。
 * 兼容仅返回 status=1 的旧逻辑，也接受省略 status 的响应。
 */
function isTokenUsable(it: Record<string, unknown>): boolean {
  if (isTokenDeleted(it)) return false;
  const s = it.status;
  if (s === 2 || s === '2' || s === false) return false;
  return true;
}

/** 将平台单条记录转为 ApiKeyItem；无法解析则返回 null */
export function mapRawTokenToApiKeyItem(raw: unknown): ApiKeyItem | null {
  if (raw == null || typeof raw !== 'object') return null;
  const it = raw as Record<string, unknown>;
  if (!isTokenUsable(it)) return null;
  const id = it.id;
  if (id == null || id === '') return null;
  const rawKey = String(it.key ?? it.token ?? it.sk ?? '').trim();
  if (!rawKey) return null;
  const key = rawKey.startsWith('sk-') ? rawKey : `sk-${rawKey}`;
  const group = String(it.group ?? it.Group ?? 'default').trim() || 'default';
  const name = String(it.name ?? '未命名').trim() || '未命名';
  return {
    id: `platform-${id}`,
    name,
    key,
    group,
    source: 'platform',
  };
}

export function mapTokenListToApiKeys(items: unknown[]): ApiKeyItem[] {
  const out: ApiKeyItem[] = [];
  for (const raw of items) {
    const mapped = mapRawTokenToApiKeyItem(raw);
    if (mapped) out.push(mapped);
  }
  return out;
}
