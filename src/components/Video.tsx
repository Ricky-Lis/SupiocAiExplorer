import React, { useState } from 'react';
import { Video, Play, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const VideoPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto p-8 h-full flex flex-col items-center justify-center text-center">
      <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center mb-6">
        <Video size={48} className="text-zinc-400" />
      </div>
      <h2 className="text-3xl font-bold dark:text-white mb-4">AI 视频生成</h2>
      <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-8">
        视频生成功能目前正在内测中。我们将很快推出基于 Veo 模型的视频创作工具，敬请期待。
      </p>
      <div className="flex gap-4">
        <button className="px-8 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full font-bold opacity-50 cursor-not-allowed">
          申请内测
        </button>
        <button className="px-8 py-3 border border-zinc-200 dark:border-zinc-700 dark:text-white rounded-full font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          查看演示
        </button>
      </div>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <p className="text-white text-xs font-medium">示例视频 {i}</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={32} className="text-white/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
