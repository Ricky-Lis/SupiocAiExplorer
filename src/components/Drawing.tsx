import React, { useState } from 'react';
import { Image as ImageIcon, Download, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { getAI } from '../services/gemini';

export const Drawing: React.FC<{ apiKey?: string }> = ({ apiKey }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setImage(null);

    try {
      const ai = getAI(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ text: prompt }],
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData) {
        setImage(`data:image/png;base64,${part.inlineData.data}`);
      }
    } catch (error) {
      console.error(error);
      alert('生成失败，请检查 API Key 或网络。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 h-full flex flex-col">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold tracking-tight dark:text-white mb-3">AI 创意绘图</h2>
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">将您的想象力转化为绚丽的视觉杰作</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-10 min-h-0">
        {/* Input Area */}
        <div className="w-full lg:w-1/3 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">创意描述</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：一个充满流动色彩的极光森林，梦幻般的渐变光影..."
              className="w-full h-48 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:text-white focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all resize-none text-sm font-medium shadow-sm"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading}
            className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            {isLoading ? '正在创作中...' : '开始生成'}
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex items-center justify-center relative overflow-hidden shadow-sm">
          {image ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative group w-full h-full p-6"
            >
              <img src={image} alt="Generated" className="w-full h-full object-contain rounded-2xl" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <a 
                  href={image} 
                  download="supioc-ai-art.png"
                  className="p-4 bg-white text-zinc-900 rounded-full hover:scale-110 transition-transform shadow-xl"
                >
                  <Download size={24} />
                </a>
              </div>
            </motion.div>
          ) : (
            <div className="text-center text-zinc-400 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Loader2 className="animate-spin text-zinc-400" size={24} />
                  </div>
                  <p className="text-sm font-bold animate-pulse">AI 正在为您调色...</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                    <ImageIcon size={32} className="text-zinc-300" />
                  </div>
                  <p className="text-sm font-medium">您的艺术作品将在这里绽放</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
