/**
 * Supioc /v1/models 接口：获取可调用模型列表
 * 支持缓存与定时刷新
 */

import { supiocUrl } from '../config/supiocApi';

/** 接口返回的单个模型项 */
export interface ApiModelItem {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  supported_endpoint_types: string[];
}

/** 接口返回结构 */
export interface ApiModelsResponse {
  data: ApiModelItem[];
  object: string;
  success: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

export interface FetchModelsOptions {
  apiKey: string;
  forceRefresh?: boolean;
  getCache: (key: string) => Promise<unknown>;
  setCache: (key: string, value: unknown) => Promise<void>;
  cacheKey: string;
  cacheTsKey: string;
}

/**
 * 获取可调用模型列表：优先使用缓存，过期或强制刷新时请求接口
 */
export async function fetchAvailableModels(
  options: FetchModelsOptions
): Promise<ApiModelItem[]> {
  const { apiKey, forceRefresh, getCache, setCache, cacheKey, cacheTsKey } = options;

  const now = Date.now();
  if (!forceRefresh) {
    const [cached, ts] = await Promise.all([
      getCache(cacheKey) as Promise<ApiModelItem[] | undefined>,
      getCache(cacheTsKey) as Promise<number | undefined>,
    ]);
    if (Array.isArray(cached) && typeof ts === 'number' && now - ts < CACHE_TTL_MS) {
      return cached;
    }
  }

  const token = apiKey?.trim() ? (apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`) : '';
  const res = await fetch(supiocUrl('/v1/models'), {
    method: 'GET',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`获取模型列表失败: ${res.status} ${text}`);
  }

  const json = (await res.json()) as ApiModelsResponse;
  const list = Array.isArray(json?.data) ? json.data : [];

  await Promise.all([
    setCache(cacheKey, list),
    setCache(cacheTsKey, now),
  ]);

  return list;
}
