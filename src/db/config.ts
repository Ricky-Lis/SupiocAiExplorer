/**
 * IndexedDB 配置
 * 纯前端数据存储，用于替代或补充 localStorage，支持更大容量与结构化数据
 */

/** 数据库名称 */
export const DB_NAME = 'supioc-ai-platform';

/** 当前数据库版本，升级 schema 时递增 */
export const DB_VERSION = 1;

/** 对象仓库（表）名称 */
export const STORE_NAMES = {
  /** 键值存储，适合设置、缓存等 */
  KV: 'kv',
  /** 可扩展：聊天/会话等带索引的列表数据 */
  RECORDS: 'records',
} as const;

/** KV 中用于聊天的 key */
export const CHAT_KV_KEYS = {
  /** 用户自定义模型列表 */
  CUSTOM_MODELS: 'chat-custom-models',
  /** 上次选中的模型（用于新会话/恢复） */
  LAST_SELECTED_MODEL: 'chat-last-selected-model',
  /** 默认模型 id（新会话优先使用） */
  DEFAULT_MODEL: 'chat-default-model',
  /** 会话列表（含对话记录） */
  SESSIONS: 'chat-sessions',
  /** 当前选中的会话 id */
  ACTIVE_SESSION_ID: 'chat-active-session-id',
  /** 可调用模型列表缓存（/v1/models 返回的 data） */
  AVAILABLE_MODELS_CACHE: 'chat-available-models-cache',
  /** 可调用模型列表缓存时间戳 */
  AVAILABLE_MODELS_CACHE_TS: 'chat-available-models-cache-ts',
} as const;

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];
