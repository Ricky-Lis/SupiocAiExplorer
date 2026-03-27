import type { Settings } from '../types';

/**
 * 聊天令牌 id 解析：
 * - 显式空字符串：用户已「取消」聊天专用令牌，聊天页不再使用任何 Key，直至重新选择
 * - 非空字符串：该 id 为聊天专用令牌
 * - undefined：未单独配置，回退到 activeApiKeyId（兼容旧版单一令牌）
 */
export function resolveChatKeyId(settings: Settings): string {
  if (settings.activeChatApiKeyId === '') return '';
  if (settings.activeChatApiKeyId) return settings.activeChatApiKeyId;
  return settings.activeApiKeyId;
}

/** 生图令牌 id，语义同 resolveChatKeyId */
export function resolveImageKeyId(settings: Settings): string {
  if (settings.activeImageApiKeyId === '') return '';
  if (settings.activeImageApiKeyId) return settings.activeImageApiKeyId;
  return settings.activeApiKeyId;
}
