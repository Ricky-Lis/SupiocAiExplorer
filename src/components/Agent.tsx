import React from 'react';
import { Bot, Plus, Zap, Code, Search, Database } from 'lucide-react';
import { motion } from 'motion/react';

export const Agent: React.FC = () => {
  const agents = [
    { name: '代码专家', icon: Code, desc: '精通多种编程语言，协助您编写、调试和优化代码。', color: 'bg-blue-500' },
    { name: '搜索助手', icon: Search, desc: '实时联网搜索，为您提供最准确的时事资讯。', color: 'bg-emerald-500' },
    { name: '数据分析师', icon: Database, desc: '处理复杂表格与数据，生成可视化洞察报告。', color: 'bg-purple-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-black tracking-tighter dark:text-white mb-2">智能 Agent</h2>
          <p className="text-zinc-500 dark:text-zinc-400">定制化 AI 助手，为特定场景提供专业支持</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl font-bold hover:scale-105 transition-transform shadow-lg">
          <Plus size={20} /> 创建新 Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {agents.map((agent, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 rounded-[2.5rem] bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm hover:shadow-2xl transition-all cursor-pointer group"
          >
            <div className={`w-16 h-16 rounded-3xl ${agent.color} flex items-center justify-center text-white mb-6 group-hover:rotate-6 transition-transform`}>
              <agent.icon size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-3 dark:text-white">{agent.name}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              {agent.desc}
            </p>
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white group-hover:gap-4 transition-all">
              立即对话 <Zap size={16} className="fill-current" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 p-10 rounded-[3rem] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 text-center">
        <h3 className="text-xl font-bold mb-4 dark:text-white">需要专属 Agent？</h3>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
          您可以上传自己的文档、连接 API，并为 AI 设定特定的性格与目标。
        </p>
        <button className="text-zinc-900 dark:text-white font-bold underline underline-offset-8 decoration-2 hover:text-zinc-500 transition-colors">
          查看开发者文档
        </button>
      </div>
    </div>
  );
};
