import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Home } from './components/Home';
import { Chat } from './components/Chat';
import { Drawing } from './components/Drawing';
import { VideoPage } from './components/Video';
import { Agent } from './components/Agent';
import { PageType, Settings } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activePage, setActivePage] = useState<PageType>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    // 每次进入页面从本地自动加载设置（含 apiKeys），供聊天/绘图等全局使用
    const saved = localStorage.getItem('supioc-settings');
    if (!saved) {
      return {
        apiKeys: [],
        activeApiKeyId: '',
        userId: '',
        systemToken: '',
        theme: 'light',
        language: 'zh',
      };
    }
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    // 兼容旧版：原先只有 apiKey 字符串时，迁移为 apiKeys + activeApiKeyId
    if (parsed.apiKey !== undefined && !Array.isArray(parsed.apiKeys)) {
      const key = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
      const id = 'default';
      parsed.apiKeys = [{ id, name: '默认', key }];
      parsed.activeApiKeyId = key ? id : '';
      delete parsed.apiKey;
    }
    return {
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
      activeApiKeyId: typeof parsed.activeApiKeyId === 'string' ? parsed.activeApiKeyId : '',
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      systemToken: typeof parsed.systemToken === 'string' ? parsed.systemToken : '',
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      language: parsed.language === 'en' ? 'en' : 'zh',
    };
  });

  useEffect(() => {
    localStorage.setItem('supioc-settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const renderPage = () => {
    const currentKey = settings.apiKeys.find((k) => k.id === settings.activeApiKeyId)?.key ?? '';
    switch (activePage) {
      case 'home': return <Home />;
      case 'chat': return <Chat apiKey={currentKey} apiKeyId={settings.activeApiKeyId} />;
      case 'drawing': return <Drawing apiKey={currentKey} />;
      case 'video': return <VideoPage />;
      case 'agent': return <Agent />;
      default: return <Home />;
    }
  };

  return (
    <div className="flex h-screen transition-colors duration-300 overflow-hidden font-sans bg-zinc-50 dark:bg-zinc-950 relative">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
      />
      
      <main className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <SettingsDrawer 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        setSettings={setSettings} 
      />
    </div>
  );
}
