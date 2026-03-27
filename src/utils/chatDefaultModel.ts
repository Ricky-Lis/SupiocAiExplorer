import { get, STORE_NAMES, CHAT_KV_KEYS } from '../db';
import type { ChatProtocol, CustomModel, LastSelectedModel } from '../types';

/**
 * 与聊天页「默认模型」逻辑对齐：读 DEFAULT_MODEL → LAST_SELECTED → 首条自定义 → gemini 兜底。
 * 用于绘图生成器提示词润色等不挂载 Chat 组件的场景。
 */
export async function resolveDefaultChatModelForPolish(): Promise<{
  modelId: string;
  protocol: ChatProtocol;
}> {
  try {
    const [defaultModel, customModels, lastSelected] = await Promise.all([
      get<string>(STORE_NAMES.KV, CHAT_KV_KEYS.DEFAULT_MODEL),
      get<CustomModel[]>(STORE_NAMES.KV, CHAT_KV_KEYS.CUSTOM_MODELS),
      get<LastSelectedModel>(STORE_NAMES.KV, CHAT_KV_KEYS.LAST_SELECTED_MODEL),
    ]);

    const customs = Array.isArray(customModels) ? customModels : [];
    const pickId =
      (typeof defaultModel === 'string' && defaultModel.trim()) ||
      (lastSelected?.modelId?.trim() ?? '');

    if (pickId) {
      const custom = customs.find((c) => c.id === pickId);
      if (custom) {
        return { modelId: custom.modelId, protocol: custom.protocol };
      }
      const raw = pickId;
      if (/gemini|gemma|bison|palm|imagen/i.test(raw)) {
        return { modelId: raw, protocol: 'gemini' };
      }
      if (/claude|anthropic/i.test(raw)) {
        return { modelId: raw, protocol: 'anthropic' };
      }
      return { modelId: raw, protocol: 'openai' };
    }

    const first = customs[0];
    if (first) {
      return { modelId: first.modelId, protocol: first.protocol };
    }
  } catch {
    // fall through
  }
  return { modelId: 'gemini-3-flash-latest', protocol: 'gemini' };
}
