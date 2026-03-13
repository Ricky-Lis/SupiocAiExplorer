export type PageType = 'home' | 'chat' | 'drawing' | 'video' | 'agent';

/** 单个 API Key 配置（名称 + 密钥 + 分组 + 来源） */
export interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  /** Supioc 上的分组名（可选） */
  group?: string;
  /** 来源：平台刷新 / 手动添加，缺省视为手动 */
  source?: 'platform' | 'manual';
}

export interface Settings {
  /** 多个 API Key，支持添加/编辑名称和 key */
  apiKeys: ApiKeyItem[];
  /** 当前选中的 API Key 的 id */
  activeApiKeyId: string;
  /** Supioc 用户 ID，用于自动刷新令牌 */
  userId?: string;
  /** Supioc 系统令牌（系统令牌/后端令牌） */
  systemToken?: string;
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
}

/** 聊天模型请求协议 */
export type ChatProtocol = 'openai' | 'anthropic' | 'gemini';

/** 预设模型项 */
export interface PresetModel {
  id: string;
  name: string;
  desc: string;
  protocol: ChatProtocol;
}

/** 用户自定义模型（需持久化） */
export interface CustomModel {
  id: string;
  name: string;
  /** 请求时使用的模型 ID（如 gpt-4o、claude-3-5-sonnet） */
  modelId: string;
  protocol: ChatProtocol;
}

/** 用于下拉/选择的统一模型项 */
export interface ModelOption {
  id: string;
  name: string;
  desc?: string;
  /** 请求时使用的模型 ID（预设为 id，自定义为 custom.modelId） */
  modelId: string;
  protocol: ChatProtocol;
  isCustom: boolean;
}

/** 上次选中的模型（持久化） */
export interface LastSelectedModel {
  modelId: string;
  isCustom: boolean;
}
