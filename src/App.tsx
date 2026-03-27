import React, { useState, useEffect, type ReactNode } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Home } from './components/Home';
import { Chat } from './components/Chat';
import { Drawing } from './components/Drawing';
import { VideoPage } from './components/Video';
import { Agent } from './components/Agent';
import { PageType, Settings } from './types';
import { resolveChatKeyId, resolveImageKeyId } from './utils/apiKeySelection';
import { Toaster } from 'sonner';

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
      ...(typeof parsed.activeChatApiKeyId === 'string'
        ? { activeChatApiKeyId: parsed.activeChatApiKeyId }
        : {}),
      ...(typeof parsed.activeImageApiKeyId === 'string'
        ? { activeImageApiKeyId: parsed.activeImageApiKeyId }
        : {}),
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

  const chatKeyId = resolveChatKeyId(settings);
  const imageKeyId = resolveImageKeyId(settings);
  const chatKey = settings.apiKeys.find((k) => k.id === chatKeyId)?.key ?? '';
  const imageKey = settings.apiKeys.find((k) => k.id === imageKeyId)?.key ?? '';

  const pageWrap = (page: PageType, node: ReactNode) => {
    const visible = activePage === page;
    const scrollPages: PageType[] = ['home', 'video', 'agent'];
    const outerClass = visible
      ? `h-full min-h-0 flex flex-col ${scrollPages.includes(page) ? 'overflow-y-auto' : 'overflow-hidden'}`
      : 'hidden';
    return (
      <div className={outerClass} aria-hidden={!visible}>
        {node}
      </div>
    );
  };

  return (
    <div className="flex h-screen transition-colors duration-300 overflow-hidden font-sans bg-zinc-50 dark:bg-zinc-950 relative">
      <Toaster position="top-center" richColors />
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
      />
      
      <main className="flex-1 min-h-0 overflow-hidden relative z-10 flex flex-col">
        {pageWrap('home', <Home />)}
        {pageWrap('chat', <Chat apiKey={chatKey} apiKeyId={chatKeyId} />)}
        {pageWrap('drawing', <Drawing apiKey={imageKey} chatApiKey={chatKey} />)}
        {pageWrap('video', <VideoPage />)}
        {pageWrap('agent', <Agent />)}
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
