/**
 * 只用于“生图”的 Gemini REST 接口（supioc 网关）。
 * 返回值为 data URL，直接用于 <img src="..."/>
 */

const API_BASE = '/api';

export type GeminiImageResolution = '1K' | '2K' | '4K';
export type GeminiAspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export interface GeminiImageGenerateOptions {
  apiKey: string;
  modelId: string;
  prompt: string;
  aspectRatio: GeminiAspectRatio;
  imageSize: GeminiImageResolution;
  /**
   * 可选：作为 inline_data 传入的图片。
   * 图片顺序与调用方提示词中的“输入图片1/2”保持一致最稳。
   */
  images?: Array<{
    mimeType: string;
    dataBase64: string;
  }>;
  temperature?: number;
}

export async function generateGeminiImage(options: GeminiImageGenerateOptions): Promise<{
  dataUrl: string;
  mimeType: string;
}> {
  const { apiKey, modelId, prompt, aspectRatio, imageSize, images = [], temperature = 0.7 } = options;
  if (!apiKey) throw new Error('缺少 apiKey');
  if (!prompt.trim()) throw new Error('prompt 不能为空');

  const requestParts: Array<Record<string, unknown>> = [
    { text: prompt },
    ...images.map((img) => ({
      inline_data: {
        mime_type: img.mimeType,
        data: img.dataBase64,
      },
    })),
  ];

  const res = await fetch(`${API_BASE}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: requestParts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize,
        },
        temperature,
        topP: 1,
      },
      // 兼容网关常见用法：关闭安全拦截，避免图片生成被拦
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
      ],
      tools: [],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini 生图失败: ${res.status} ${err}`);
  }

  const data = (await res.json()) as any;

  const responseParts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const inlinePart: any = responseParts.find((p: any) => p?.inlineData || p?.inline_data);
  const inline: any = inlinePart?.inlineData ?? inlinePart?.inline_data;

  const base64: string | undefined = inline?.data ?? inline?.base64 ?? inline?.data_base64;
  const mimeType: string = inline?.mimeType ?? inline?.mime_type ?? 'image/png';

  if (!base64) throw new Error('Gemini 未返回图片（inlineData 缺失）');

  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
}

