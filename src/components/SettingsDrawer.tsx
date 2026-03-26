import React, { useState } from 'react';
import { X, Sun, Moon, Key, Languages, Plus, Pencil, Trash2, Check, Cloud, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, ApiKeyItem } from '../types';
import { toast } from 'sonner';

type EditingItem = ApiKeyItem | { id: ''; name: string; key: string; group?: string; source?: 'platform' | 'manual' };

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

function generateId() {
  return `key-${Date.now()}`;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose, settings, setSettings }) => {
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const addNew = () => {
    setEditing({ id: '', name: '', key: '', group: 'default', source: 'manual' });
  };

  const startEdit = (item: ApiKeyItem) => {
    setEditing({ ...item });
  };

  const saveEditing = () => {
    if (!editing) return;
    const name = editing.name.trim();
    const keyRaw = editing.key.trim();
    const key = keyRaw.startsWith('sk-') ? keyRaw : `sk-${keyRaw}`;
    const group = (editing.group ?? 'default').trim() || 'default';
    if (!name) return;

    const existingByKey = settings.apiKeys.find(
      (k) => k.key.trim() === key && k.id !== editing.id
    );
    if (existingByKey) {
      toast.error('该 API Key 已存在，请勿重复添加。');
      return;
    }

    if (editing.id === '') {
      const newItem: ApiKeyItem = { id: generateId(), name, key, group, source: 'manual' };
      const nextKeys = [...settings.apiKeys, newItem];
      setSettings({
        ...settings,
        apiKeys: nextKeys,
        activeApiKeyId: settings.activeApiKeyId || newItem.id,
      });
    } else {
      const nextKeys = settings.apiKeys.map((k) =>
        k.id === editing.id ? { ...k, name, key, group } : k
      );
      setSettings({ ...settings, apiKeys: nextKeys });
    }
    setEditing(null);
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const deleteKey = (id: string) => {
    const nextKeys = settings.apiKeys.filter((k) => k.id !== id);
    const nextActive =
      settings.activeApiKeyId === id
        ? (nextKeys[0]?.id ?? '')
        : settings.activeApiKeyId;
    setSettings({
      ...settings,
      apiKeys: nextKeys,
      activeApiKeyId: nextActive,
    });
    if (editing?.id === id) setEditing(null);
  };

  const setActive = (id: string) => {
    setSettings({ ...settings, activeApiKeyId: id });
  };

  const refreshFromServer = async () => {
    const userId = settings.userId?.trim();
    const systemToken = settings.systemToken?.trim();
    if (!userId || !systemToken) {
      toast.error('请先在下方填写 User ID 和系统令牌后再刷新令牌列表。');
      return;
    }
    setIsRefreshing(true);
    try {
      const headers = new Headers();
      headers.append('new-api-user', userId);
      headers.append('Authorization', systemToken);
      // 开发环境走 Vite 代理，避免 CORS；生产环境直连（若遇 CORS 需服务端配置或自建代理）
      const tokenUrl = (import.meta as any).env.DEV
        ? '/api-proxy/api/token/?p=0&size=10'
        : 'https://api.supioc.com/api/token/?p=0&size=10';
      const res = await fetch(tokenUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`请求失败：${res.status} ${text}`);
      }
      const json = await res.json() as any;
      const items: any[] = json?.data?.items ?? [];
      const valid = items.filter(
        (it) => it && it.status === 1 && (it.DeletedAt === null || it.DeletedAt === undefined)
      );
      const apiKeysFromPlatform: ApiKeyItem[] = valid.map((it) => ({
        id: `platform-${it.id}`,
        name: it.name || '未命名',
        key: `sk-${it.key}`,
        group: it.group || 'default',
        source: 'platform',
      }));

      // 根据 key 建立平台 key 映射
      const platformByKey = new Map<string, ApiKeyItem>();
      for (const p of apiKeysFromPlatform) {
        platformByKey.set(p.key.trim(), p);
      }

      const prevActive = settings.apiKeys.find((k) => k.id === settings.activeApiKeyId);
      const prevActiveKey = prevActive?.key.trim() ?? '';

      const mergedKeys: ApiKeyItem[] = [];
      const seenKeys = new Set<string>();

      // 先遍历现有列表：有平台同 key 的标记为平台，否则标记为手动
      for (const existing of settings.apiKeys) {
        const key = existing.key.trim();
        if (!key) continue;
        if (seenKeys.has(key)) continue;

        const platformItem = platformByKey.get(key);
        if (platformItem) {
          mergedKeys.push(platformItem);
          platformByKey.delete(key);
        } else {
          mergedKeys.push({ ...existing, source: 'manual' });
        }
        seenKeys.add(key);
      }

      // 再补充平台新出现但本地没有的 key
      for (const p of platformByKey.values()) {
        const key = p.key.trim();
        if (!key || seenKeys.has(key)) continue;
        mergedKeys.push(p);
        seenKeys.add(key);
      }

      // 计算新的选中项：优先保持相同 id，其次保持相同 key，最后选第一条
      let nextActiveId = settings.activeApiKeyId;
      if (!mergedKeys.some((k) => k.id === nextActiveId)) {
        if (prevActiveKey) {
          const sameKey = mergedKeys.find((k) => k.key.trim() === prevActiveKey);
          nextActiveId = sameKey?.id ?? (mergedKeys[0]?.id ?? '');
        } else {
          nextActiveId = mergedKeys[0]?.id ?? '';
        }
      }

      setSettings({
        ...settings,
        apiKeys: mergedKeys,
        activeApiKeyId: nextActiveId,
      });
      toast.success('刷新令牌列表成功！');
    } catch (e) {
      console.error(e);
      toast.error('刷新令牌列表失败，请检查 User ID、系统令牌或网络。');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 max-w-[min(20rem,95vw)] bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col border-r border-zinc-200 dark:border-zinc-800 min-h-full"
          >
            <div className="flex-shrink-0 p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex justify-between items-center">
                <h2 className="text-lg sm:text-xl font-bold dark:text-white">设置</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full dark:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
              <div className="space-y-6 sm:space-y-8">
                {/* API Keys */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    <Key size={16} /> API Key
                  </label>

                  <AnimatePresence mode="wait">
                    {editing ? (
                      <motion.div
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
                      >
                        <input
                          type="text"
                          value={editing.name}
                          onChange={(e) =>
                            setEditing((prev) => prev && { ...prev, name: e.target.value })
                          }
                          placeholder="Key 名称（如：Supioc 生产）"
                          className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                        />
                        <input
                          type="text"
                          value={editing.key}
                          onChange={(e) =>
                            setEditing((prev) => prev && { ...prev, key: e.target.value })
                          }
                          placeholder="API Key 值（如 sk-xxx）"
                          className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                        />
                        <input
                          type="text"
                          value={editing.group ?? 'default'}
                          onChange={(e) =>
                            setEditing((prev) => prev && { ...prev, group: e.target.value })
                          }
                          placeholder="分组（如 default）"
                          className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditing}
                            disabled={!editing.name.trim()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-40"
                          >
                            <Check size={16} /> 保存
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            取消
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2"
                      >
                        <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-2 pr-1 scroll-smooth">
                          {settings.apiKeys.length === 0 && (
                            <p className="text-xs text-zinc-400 py-2">暂无 Key，请添加后选择使用</p>
                          )}
                          {settings.apiKeys.map((item) => {
                            const isPlatform = item.source === 'platform';
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-2 p-3 rounded-xl border transition-all shrink-0 ${
                                  settings.activeApiKeyId === item.id
                                    ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setActive(item.id)}
                                  className="flex-1 flex flex-col items-start text-left min-w-0"
                                >
                                  <span className="flex items-center gap-1.5 w-full">
                                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                      {item.name || '未命名'}
                                    </span>
                                    <span
                                      className={`shrink-0 flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                        isPlatform
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                      }`}
                                      title={isPlatform ? '来自平台刷新' : '手动添加'}
                                    >
                                      {isPlatform ? <Cloud size={10} /> : <UserPlus size={10} />}
                                      {isPlatform ? '平台' : '手动'}
                                    </span>
                                  </span>
                                  <span className="text-xs text-zinc-400 truncate w-full mt-0.5">
                                    {`${item.group || 'default'} · ${item.key ? 'sk-••••••' : '未填写'}`}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white shrink-0"
                                  title="编辑"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteKey(item.id)}
                                  className="p-2 rounded-lg text-zinc-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 shrink-0"
                                  title="删除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={addNew}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-all"
                        >
                          <Plus size={16} /> 添加新 Key
                        </button>
                        <button
                          type="button"
                          onClick={refreshFromServer}
                          disabled={isRefreshing}
                          className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium disabled:opacity-50"
                        >
                          {isRefreshing ? '正在刷新令牌列表…' : '从 Supioc 刷新令牌列表'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Theme */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    {settings.theme === 'light' ? <Sun size={16} /> : <Moon size={16} />} 样式模式
                  </label>
                  <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <button
                      onClick={() => setSettings({ ...settings, theme: 'light' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                        settings.theme === 'light'
                          ? 'bg-white shadow-sm font-medium dark:bg-zinc-700 dark:text-white'
                          : 'text-zinc-500'
                      }`}
                    >
                      <Sun size={16} /> 日间
                    </button>
                    <button
                      onClick={() => setSettings({ ...settings, theme: 'dark' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                        settings.theme === 'dark'
                          ? 'bg-zinc-700 text-white shadow-sm font-medium'
                          : 'text-zinc-500'
                      }`}
                    >
                      <Moon size={16} /> 夜间
                    </button>
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    <Languages size={16} /> 语言
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) =>
                      setSettings({ ...settings, language: e.target.value as 'zh' | 'en' })
                    }
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition-all appearance-none"
                  >
                    <option value="zh">简体中文</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Supioc 账户配置 */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Supioc 账户
                  </label>
                  <input
                    type="text"
                    value={settings.userId ?? ''}
                    onChange={(e) => setSettings({ ...settings, userId: e.target.value })}
                    placeholder="User ID（new-api-user）"
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition-all"
                  />
                  <input
                    type="password"
                    value={settings.systemToken ?? ''}
                    onChange={(e) => setSettings({ ...settings, systemToken: e.target.value })}
                    placeholder="系统令牌（Authorization）"
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition-all"
                  />
                  <p className="text-[11px] text-zinc-400">
                    请填写您的 User ID 和系统令牌。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 p-4 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                onClick={onClose}
                className="w-full py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                保存并关闭
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
