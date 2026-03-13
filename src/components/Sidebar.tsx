import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Home, 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  Bot,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageType, Settings } from '../types';

interface SidebarProps {
  activePage: PageType;
  setActivePage: (page: PageType) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, onOpenSettings }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const navItems = [
    { id: 'home', icon: Home, label: '首页' },
    { id: 'chat', icon: MessageSquare, label: '聊天' },
    { id: 'drawing', icon: ImageIcon, label: '绘图' },
    { id: 'video', icon: Video, label: '视频' },
    { id: 'agent', icon: Bot, label: 'Agent' },
  ];

  return (
    <div className={`h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300 z-20 shrink-0 w-20 ${isExpanded ? 'md:w-64' : 'md:w-20'}`}>
      {/* Top: Brand & Toggle */}
      <div className={`p-4 ${isExpanded ? 'md:p-8' : 'md:p-4'} flex items-center justify-between transition-all duration-300 relative`}>
        <a 
          href="https://api.supioc.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className={`flex items-center ${isExpanded ? 'md:gap-3' : ''} cursor-pointer hover:opacity-80 transition-opacity ${isExpanded ? 'justify-start' : 'justify-center w-full'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold text-xl shrink-0">
            S
          </div>
          <div className={`hidden md:block overflow-hidden transition-all duration-300 ${isExpanded ? 'w-[88px] opacity-100' : 'w-0 opacity-0'}`}>
            <h1 className="text-lg font-bold tracking-tight dark:text-white leading-none whitespace-nowrap">Supioc</h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mt-1 whitespace-nowrap">AI Hub</p>
          </div>
        </a>
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm transition-all absolute ${isExpanded ? 'right-4' : '-right-3'} top-6 z-30`}
          title={isExpanded ? "收起导航" : "展开导航"}
        >
          {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Middle: Navigation */}
      <div className="flex-1 flex flex-col gap-2 p-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id as PageType)}
            className={`flex items-center p-3 rounded-xl transition-all duration-200 group ${
              activePage === item.id 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold' 
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            } ${isExpanded ? 'justify-center md:justify-start' : 'justify-center'}`}
            title={!isExpanded ? item.label : undefined}
          >
            <item.icon size={20} className={`shrink-0 ${activePage === item.id ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
            <span className={`hidden md:block text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom: Settings */}
      <div className="p-4 mt-auto flex flex-col gap-2">
        <button 
          onClick={onOpenSettings}
          className={`flex items-center p-3 rounded-xl text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all ${isExpanded ? 'justify-center md:justify-start' : 'justify-center'}`}
          title={!isExpanded ? "设置" : undefined}
        >
          <SettingsIcon size={20} className="shrink-0" />
          <span className={`hidden md:block text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>设置</span>
        </button>
      </div>
    </div>
  );
};
