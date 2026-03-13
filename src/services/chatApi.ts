/**
 * 统一聊天 API：支持 OpenAI / Anthropic / Gemini 三种协议
 * 统一使用 supioc 网关：https://api.supioc.com
 * API Key 使用设置中存储的 key，每次进入页面从本地加载后传入
 */

import type { ChatProtocol } from '../types';

const API_BASE = 'https://api.supioc.com';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestOptions {
  apiKey: string;
  protocol: ChatProtocol;
  modelId: string;
  messages: ChatMessage[];
  systemInstruction?: string;
  temperature?: number;
}

/** OpenAI 格式：POST /v1/chat/completions（supioc） */
async function requestOpenAI(options: ChatRequestOptions): Promise<string> {
  const { apiKey, modelId, messages, systemInstruction, temperature = 0.7 } = options;
  const openaiMessages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    openaiMessages.push({ role: 'system', content: systemInstruction });
  }
  messages.forEach((m) => {
    openaiMessages.push({ role: m.role, content: m.content });
  });

  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: openaiMessages,
      temperature,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API 错误: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (text == null) throw new Error('OpenAI 返回格式异常');
  return text;
}

/** Anthropic 格式：POST /v1/messages（supioc） */
async function requestAnthropic(options: ChatRequestOptions): Promise<string> {
  const { apiKey, modelId, messages, systemInstruction, temperature = 0.7 } = options;
  const anthropicMessages: { role: 'user' | 'assistant'; content: string }[] = messages.map(
    (m) => ({ role: m.role, content: m.content })
  );

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: 4096,
    messages: anthropicMessages,
    temperature,
    stream: false,
  };
  if (systemInstruction) body.system = systemInstruction;

  const res = await fetch(`${API_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API 错误: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const block = data.content?.find((c) => c.type === 'text');
  const text = block?.text;
  if (text == null) throw new Error('Anthropic 返回格式异常');
  return text;
}

/** Gemini 格式：POST /v1beta/models/{modelId}:generateContent（supioc REST） */
async function requestGemini(options: ChatRequestOptions): Promise<string> {
  const { apiKey, modelId, messages, systemInstruction, temperature = 0.7 } = options;
  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      topP: 1,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
    tools: [],
  };
  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
      role: 'user',
    };
  }

  const res = await fetch(`${API_BASE}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 错误: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini 未返回文本');
  return text;
}

/**
 * 根据协议调用对应 supioc 接口，返回助手回复文本
 * apiKey 应由上层从设置（本地持久化）中读取并传入
 */
export async function chatWithModel(options: ChatRequestOptions): Promise<string> {
  const { protocol } = options;
  if (protocol === 'openai') return requestOpenAI(options);
  if (protocol === 'anthropic') return requestAnthropic(options);
  if (protocol === 'gemini') return requestGemini(options);
  throw new Error(`不支持的协议: ${protocol}`);
}
