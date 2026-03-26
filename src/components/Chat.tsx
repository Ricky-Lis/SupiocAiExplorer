import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send, User, Bot, Settings, ChevronDown, Plus, Trash2,
  Search, Check, PenTool, BarChart, Pencil, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { get, set, STORE_NAMES, CHAT_KV_KEYS } from '../db';
import { chatWithModel } from '../services/chatApi';
import { fetchAvailableModels } from '../services/modelsApi';
import type { ApiModelItem } from '../services/modelsApi';
import type { CustomModel, ModelOption, LastSelectedModel, ChatProtocol } from '../types';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemInstruction: string;
  temperature: number;
  createdAt?: number;
}

/** 预设模型（协议均为 gemini，可按需改为 openai/anthropic） */
const PRESET_MODELS: ModelOption[] = [
];

const PROTOCOL_LABELS: Record<ChatProtocol, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

const MAX_CONTEXT_SIZE = 40000;

const DEFAULT_SYSTEM_INSTRUCTION = [
  '你是一个专业的 AI 助手，请遵守以下原则：',
  '1. 先快速确认用户需求，再开始详细回答。',
  '2. 回答尽量结构化（使用小标题、分点等），避免长篇大段无格式文本。',
  '3. 对于不清楚或缺失的信息，先提出 1~3 个澄清问题。',
  '4. 如果问题较复杂，先给出简短结论，再给出详细推理过程（必要时可省略部分推理细节）。',
  '5. 用户语言为中文时，统一使用简体中文作答。',
].join('\n');

const ContextIndicator = ({ used, max }: { used: number, max: number }) => {
  const percentage = Math.min((used / max) * 100, 100);
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">上下文使用</span>
          <span className={`text-[9px] font-bold ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-zinc-500'}`}>
            {used.toLocaleString()} / {max.toLocaleString()}
          </span>
        </div>
        <div className="w-32 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className={`h-full rounded-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'}`}
          />
        </div>
      </div>
    </div>
  );
};

const ModelSelector = ({
  modelOptions,
  activeModelId,
  onSelect,
  onAddModel,
  onSetDefault,
  onDeleteModel,
}: {
  modelOptions: ModelOption[];
  activeModelId: string;
  onSelect: (id: string) => void;
  onAddModel: () => void;
  onSetDefault?: (id: string) => void;
  onDeleteModel?: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = modelOptions.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.desc && m.desc.toLowerCase().includes(search.toLowerCase()))
  );

  const activeOption = modelOptions.find((m) => m.id === activeModelId) ?? modelOptions[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all shadow-sm"
      >
        <div
          className={`w-2 h-2 rounded-full ${
            activeOption?.protocol === 'anthropic' ? 'bg-amber-500' : activeOption?.protocol === 'openai' ? 'bg-emerald-500' : 'bg-blue-500'
          } shadow-[0_0_8px_rgba(59,130,246,0.5)]`}
        />
        <span className="text-xs font-bold text-zinc-900 dark:text-white">{activeOption?.name}</span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-0 w-72 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索模型..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 rounded-xl text-xs dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              {filteredOptions.map((m) => (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelect(m.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(m.id);
                      setIsOpen(false);
                      setSearch('');
                    }
                  }}
                  className={`w-full flex flex-col gap-0.5 p-3 rounded-xl text-left transition-all cursor-pointer ${
                    activeModelId === m.id
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold">{m.name}</span>
                      <p className={`text-[10px] leading-tight ${activeModelId === m.id ? 'opacity-70' : 'text-zinc-400'}`}>
                        {m.desc ?? PROTOCOL_LABELS[m.protocol]}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.isCustom && onDeleteModel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteModel(m.id);
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="删除该自定义模型"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {activeModelId === m.id && <Check size={14} />}
                    </div>
                  </div>
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <div className="p-4 text-center text-xs text-zinc-400 font-medium">未找到相关模型</div>
              )}
            </div>
            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSearch('');
                  onAddModel();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs font-bold transition-all"
              >
                <Plus size={14} />
                新增模型
              </button>
              {onSetDefault && activeModelId && (
                <button
                  type="button"
                  onClick={() => {
                    onSetDefault(activeModelId);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs font-medium transition-all"
                >
                  将当前选中设为默认模型
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


export const Chat: React.FC<{ apiKey?: string; apiKeyId?: string }> = ({ apiKey, apiKeyId }) => {
  const [sessions, setSessions] = useState<Session[]>(() => [
    {
      id: Date.now().toString(),
      title: '新会话',
      messages: [],
      model: 'gemini-3-flash-latest',
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      temperature: 0.7,
      createdAt: Date.now(),
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasTruncatedContext, setHasTruncatedContext] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const [addModelProtocol, setAddModelProtocol] = useState<ChatProtocol>('openai');
  const [addModelName, setAddModelName] = useState('');
  const [addModelSearch, setAddModelSearch] = useState('');
  const [apiModels, setApiModels] = useState<ApiModelItem[]>([]);
  const [apiModelsLoading, setApiModelsLoading] = useState(false);
  const [apiModelsError, setApiModelsError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelsRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modelOptions: ModelOption[] = useMemo(
    () => [
      ...PRESET_MODELS,
      ...customModels.map((c) => ({
        id: c.id,
        name: c.name,
        modelId: c.modelId,
        protocol: c.protocol,
        isCustom: true,
      })),
    ],
    [customModels]
  );

  const loadApiModels = useCallback(async (forceRefresh = false) => {
    if (!apiKey?.trim()) {
      setApiModels([]);
      setApiModelsError('请先配置 API Key');
      return;
    }
    const keySuffix = apiKeyId?.trim() || 'default';
    const cacheKey = `${CHAT_KV_KEYS.AVAILABLE_MODELS_CACHE}-${keySuffix}`;
    const cacheTsKey = `${CHAT_KV_KEYS.AVAILABLE_MODELS_CACHE_TS}-${keySuffix}`;
    setApiModelsLoading(true);
    setApiModelsError(null);
    try {
      const list = await fetchAvailableModels({
        apiKey,
        forceRefresh,
        getCache: (key) => get(STORE_NAMES.KV, key),
        setCache: (key, value) => set(STORE_NAMES.KV, key, value),
        cacheKey,
        cacheTsKey,
      });
      setApiModels(list);
    } catch (e) {
      console.error(e);
      setApiModelsError(e instanceof Error ? e.message : '获取模型列表失败');
      setApiModels([]);
    } finally {
      setApiModelsLoading(false);
    }
  }, [apiKey, apiKeyId]);

  useEffect(() => {
    if (!apiKey?.trim()) {
      setApiModels([]);
      setApiModelsError(null);
      return;
    }
    setApiModels([]);
    loadApiModels(false);
    const intervalMs = 5 * 60 * 1000;
    modelsRefreshTimerRef.current = setInterval(() => loadApiModels(false), intervalMs);
    return () => {
      if (modelsRefreshTimerRef.current) {
        clearInterval(modelsRefreshTimerRef.current);
        modelsRefreshTimerRef.current = null;
      }
    };
  }, [apiKey, apiKeyId, loadApiModels]);

  useEffect(() => {
    if (isAddModelOpen && apiKey?.trim() && apiModels.length === 0 && !apiModelsLoading) {
      loadApiModels(false);
    }
  }, [isAddModelOpen, apiKey, apiModels.length, apiModelsLoading, loadApiModels]);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      try {
        const [savedSessions, activeId, defaultModel, savedCustom, lastSelected] = await Promise.all([
          get<Session[]>(STORE_NAMES.KV, CHAT_KV_KEYS.SESSIONS),
          get<string>(STORE_NAMES.KV, CHAT_KV_KEYS.ACTIVE_SESSION_ID),
          get<string>(STORE_NAMES.KV, CHAT_KV_KEYS.DEFAULT_MODEL),
          get<CustomModel[]>(STORE_NAMES.KV, CHAT_KV_KEYS.CUSTOM_MODELS),
          get<LastSelectedModel>(STORE_NAMES.KV, CHAT_KV_KEYS.LAST_SELECTED_MODEL),
        ]);
        if (Array.isArray(savedCustom) && savedCustom.length > 0) {
          setCustomModels(savedCustom);
        }
        if (typeof defaultModel === 'string' && defaultModel) {
          setDefaultModelId(defaultModel);
        }
        const hasValidSessions = Array.isArray(savedSessions) && savedSessions.length > 0;
        const modelOptionsForCheck = [
          ...PRESET_MODELS,
          ...(Array.isArray(savedCustom) ? savedCustom.map((c) => ({ id: c.id })) : []),
        ];
        const isValidModel = (id: string) =>
          modelOptionsForCheck.some((m) => m.id === id);
        if (hasValidSessions) {
          const sorted = [...savedSessions].sort(
            (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
          );
          const withModel = lastSelected?.modelId && isValidModel(lastSelected.modelId)
            ? sorted.map((s, i) => (i === 0 ? { ...s, model: lastSelected.modelId } : s))
            : sorted;
          setSessions(withModel);
          const firstId = withModel[0]?.id;
          if (typeof activeId === 'string' && withModel.some((s) => s.id === activeId)) {
            setActiveSessionId(activeId);
          } else if (firstId) {
            setActiveSessionId(firstId);
          }
        } else {
          const defaultSession: Session = {
            id: Date.now().toString(),
            title: '新会话',
            messages: [],
            model:
              (typeof defaultModel === 'string' && defaultModel) ||
              (lastSelected?.modelId && isValidModel(lastSelected.modelId) ? lastSelected.modelId : null) ||
              'gemini-3-flash-latest',
            systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
            temperature: 0.7,
            createdAt: Date.now(),
          };
          setSessions([defaultSession]);
          setActiveSessionId(defaultSession.id);
        }
      } catch {
        if (sessions.length > 0 && activeSessionId === null) {
          setActiveSessionId(sessions[0].id);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (activeSessionId === null && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions.length, activeSessionId]);

  // 持久化：会话列表与当前选中 id（防抖）
  useEffect(() => {
    if (!initDone.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      set(STORE_NAMES.KV, CHAT_KV_KEYS.SESSIONS, sessions).catch(() => {});
      if (activeSessionId) {
        set(STORE_NAMES.KV, CHAT_KV_KEYS.ACTIVE_SESSION_ID, activeSessionId).catch(() => {});
      }
      persistTimerRef.current = null;
    }, 400);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [sessions, activeSessionId]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  const usedContext = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.messages.reduce((acc, msg) => acc + msg.content.length, 0);
  }, [activeSession]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [activeSession?.messages, isLoading]);

  const persistLastSelected = (modelId: string) => {
    const isCustom = customModels.some((c) => c.id === modelId);
    set(STORE_NAMES.KV, CHAT_KV_KEYS.LAST_SELECTED_MODEL, { modelId, isCustom }).catch(() => {});
  };

  const startNewSession = () => {
    if (sessions.length >= 3) {
      toast.error('最多只能同时开启 3 个会话，请先删除旧会话。');
      return;
    }
    const resolvedModel =
      (defaultModelId && modelOptions.some((m) => m.id === defaultModelId) ? defaultModelId : null) ||
      activeSession?.model ||
      'gemini-3-flash-latest';
    const newSession: Session = {
      id: Date.now().toString(),
      title: '新会话',
      messages: [],
      model: resolvedModel,
      systemInstruction: activeSession?.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION,
      temperature: activeSession?.temperature ?? 0.7,
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter((s) => s.id !== id);
    const resolvedModel =
      (defaultModelId && modelOptions.some((m) => m.id === defaultModelId) ? defaultModelId : null) ||
      'gemini-3-flash-latest';
    if (updatedSessions.length === 0) {
      const newSession: Session = {
        id: Date.now().toString(),
        title: '新会话',
        messages: [],
        model: resolvedModel,
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        temperature: 0.7,
        createdAt: Date.now(),
      };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
    } else {
      setSessions(updatedSessions);
      if (activeSessionId === id) {
        setActiveSessionId(updatedSessions[0].id);
      }
    }
    if (editingSessionId === id) {
      setEditingSessionId(null);
      setEditingTitle('');
    }
  };

  const handleSetDefaultModel = (id: string) => {
    setDefaultModelId(id);
    set(STORE_NAMES.KV, CHAT_KV_KEYS.DEFAULT_MODEL, id).catch(() => {});
  };

  const handleDeleteModel = (id: string) => {
    const target = customModels.find((c) => c.id === id);
    if (!target) return;
    if (!window.confirm(`确定要删除自定义模型「${target.name || target.modelId}」吗？`)) return;

    const nextCustom = customModels.filter((c) => c.id !== id);
    setCustomModels(nextCustom);
    set(STORE_NAMES.KV, CHAT_KV_KEYS.CUSTOM_MODELS, nextCustom).catch(() => {});

    const fallbackModelId =
      (defaultModelId && modelOptions.some((m) => m.id === defaultModelId) ? defaultModelId : null) ||
      PRESET_MODELS[0]?.id ||
      'gemini-3-flash-latest';

    // 更新会话中使用已删除模型的配置
    setSessions((prev) =>
      prev.map((s) => (s.model === id ? { ...s, model: fallbackModelId } : s))
    );

    // 若当前默认模型已被删除，则重置为 fallback
    if (defaultModelId === id) {
      setDefaultModelId(fallbackModelId);
      set(STORE_NAMES.KV, CHAT_KV_KEYS.DEFAULT_MODEL, fallbackModelId).catch(() => {});
    }

    // 更新最近选择的模型
    persistLastSelected(fallbackModelId);
  };

  const clearCurrentSessionMessages = () => {
    if (!activeSession) return;
    updateActiveSession({ messages: [] });
    setHasTruncatedContext(false);
  };

  const startNewSessionFromCurrent = () => {
    if (!activeSession) {
      startNewSession();
      return;
    }
    if (sessions.length >= 3) {
      toast.error('最多只能同时开启 3 个会话，请先删除旧会话。');
      return;
    }
    const resolvedModel =
      (defaultModelId && modelOptions.some((m) => m.id === defaultModelId) ? defaultModelId : null) ||
      activeSession.model ||
      'gemini-3-flash-latest';
    const newSession: Session = {
      id: Date.now().toString(),
      title: `${activeSession.title || '新会话'} - 新话题`,
      messages: [],
      model: resolvedModel,
      systemInstruction: activeSession.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
      temperature: activeSession.temperature,
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setHasTruncatedContext(false);
  };

  const startEditTitle = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditingTitle(s.title);
  };

  const saveEditTitle = (sessionId: string) => {
    const title = editingTitle.trim() || '新会话';
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const updateActiveSession = (updates: Partial<Session>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, ...updates } : s))
    );
  };

  const handleModelSelect = (id: string) => {
    updateActiveSession({ model: id });
    persistLastSelected(id);
  };

  const openAddModel = () => {
    setAddModelName('');
    setAddModelSearch('');
    setAddModelProtocol('openai');
    setIsAddModelOpen(true);
  };

  const saveAddModel = () => {
    const name = addModelName.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    const newCustom: CustomModel = {
      id,
      name,
      modelId: name,
      protocol: addModelProtocol,
    };
    const next = [...customModels, newCustom];
    setCustomModels(next);
    set(STORE_NAMES.KV, CHAT_KV_KEYS.CUSTOM_MODELS, next).catch(() => {});
    updateActiveSession({ model: id });
    persistLastSelected(id);
    setIsAddModelOpen(false);
  };

  const getTruncatedMessages = (messages: Message[]) => {
    let totalLength = 0;
    const truncated: Message[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (totalLength + msg.content.length > MAX_CONTEXT_SIZE) break;
      truncated.unshift(msg);
      totalLength += msg.content.length;
    }
    return truncated;
  };

  const sendMessage = async (userMsg: string) => {
    if (!activeSession || !userMsg.trim() || isLoading) return;

    const updatedMessages: Message[] = [
      ...activeSession.messages,
      { role: 'user', content: userMsg },
    ];
    updateActiveSession({ messages: updatedMessages });
    setIsLoading(true);

    if (!apiKey) {
      updateActiveSession({
        messages: [
          ...updatedMessages,
          {
            role: 'assistant',
            content: '请先在设置中配置对应协议的 API Key 后再发送消息。',
          },
        ],
      });
      setIsLoading(false);
      return;
    }

    const option = modelOptions.find((m) => m.id === activeSession.model);
    if (!option) {
      updateActiveSession({
        messages: [
          ...updatedMessages,
          { role: 'assistant', content: '未找到当前模型配置，请重新选择模型。' },
        ],
      });
      setIsLoading(false);
      return;
    }

    try {
      const truncatedMessages = getTruncatedMessages(updatedMessages);
      setHasTruncatedContext(truncatedMessages.length < updatedMessages.length);

      const assistantMsg = await chatWithModel({
        apiKey,
        protocol: option.protocol,
        modelId: option.modelId,
        messages: truncatedMessages,
        systemInstruction: activeSession.systemInstruction,
        temperature: activeSession.temperature,
      });
      updateActiveSession({
        messages: [...updatedMessages, { role: 'assistant', content: assistantMsg }],
      });
    } catch (error) {
      console.error(error);
      let friendlyMessage =
        '发生错误，请检查 API Key、模型名称或网络连接，稍后再试。';

      if (error instanceof Error) {
        const msg = error.message || '';
        if (msg.includes('429')) {
          if (msg.includes('当前分组上游负载已饱和')) {
            friendlyMessage =
              '当前分组上游模型负载已饱和，网关返回 429。请稍后再试，或尝试切换模型 / 分组 / 降低并发请求。';
          } else {
            friendlyMessage =
              '上游模型返回 429（请求过多或负载过高），请稍后再试，或尝试减少请求频率。';
          }
        }
      }

      updateActiveSession({
        messages: [
          ...updatedMessages,
          {
            role: 'assistant',
            content: friendlyMessage,
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    await sendMessage(userMsg);
  };

  return (
    <div className="flex h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Session Sidebar */}
      <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 shadow-[20px_0_50px_rgba(0,0,0,0.02)]">
        <div className="flex-1 overflow-y-auto px-4 space-y-2 pt-6">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">活跃会话 ({sessions.length}/3)</span>
          </div>
          {sessions.map((s) => {
            const isActive = activeSessionId === s.id;
            const isEditing = editingSessionId === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`group flex items-center justify-between p-4 rounded-[20px] cursor-pointer transition-all duration-300 ${
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  />
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => saveEditTitle(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEditTitle(s.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingSessionId(null);
                          setEditingTitle('');
                        }
                      }}
                      className="text-sm font-bold truncate bg-transparent border-b border-zinc-300 dark:border-zinc-600 outline-none px-1 py-0.5 text-zinc-900 dark:text-white"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => startEditTitle(s, e)}
                      className="flex items-center gap-1 text-sm font-bold truncate text-left text-zinc-700 dark:text-zinc-100 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <span className="truncate">{s.title}</span>
                      <Pencil
                        size={14}
                        className="opacity-0 group-hover:opacity-80 text-zinc-400 shrink-0"
                      />
                    </button>
                  )}
                </div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
          
          {sessions.length < 3 && (
            <button
              onClick={() => startNewSession()}
              className="w-full flex items-center gap-3 p-4 rounded-[20px] border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:hover:border-zinc-600 transition-all mt-4"
            >
              <Plus size={18} />
              <span className="text-sm font-bold">开启新会话</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-zinc-900">
        {/* Header */}
        <header className="h-20 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              modelOptions.find(m => m.id === activeSession?.model)?.protocol === 'anthropic' ? 'bg-amber-500' :
              modelOptions.find(m => m.id === activeSession?.model)?.protocol === 'openai' ? 'bg-emerald-500' : 'bg-blue-500'
            } text-white shadow-lg shadow-current/20`}>
              <Bot size={24} />
            </div>
            <div>
              <h2 className="font-bold dark:text-white text-lg tracking-tight">{activeSession?.title}</h2>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {modelOptions.find(m => m.id === activeSession?.model)?.name ?? activeSession?.model}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={startNewSessionFromCurrent}
              className="px-4 py-2 rounded-2xl text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              基于当前对话新话题
            </button>
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-3 rounded-2xl transition-all ${isSettingsOpen ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <Settings size={22} />
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-24 right-8 w-96 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.2)] z-20 p-8 space-y-8"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">角色设定 (System Instruction)</label>
                  <PenTool size={14} className="text-zinc-300" />
                </div>
                <textarea
                  value={activeSession?.systemInstruction}
                  onChange={(e) => updateActiveSession({ systemInstruction: e.target.value })}
                  placeholder="设定 AI 的身份和行为准则..."
                  className="w-full h-32 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all resize-none font-medium"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">温度设置 (Temperature: {activeSession?.temperature})</label>
                  <BarChart size={14} className="text-zinc-300" />
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={activeSession?.temperature || 0.7}
                  onChange={(e) => updateActiveSession({ temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                  <span>精准 (0.0)</span>
                  <span>平衡 (1.0)</span>
                  <span>创意 (2.0)</span>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-sm shadow-xl hover:opacity-90 transition-all"
              >
                保存配置
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 新增模型弹窗 */}
        <AnimatePresence>
          {isAddModelOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center p-4"
              onClick={() => setIsAddModelOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">新增模型</h3>

                {/* 从接口获取的可选模型列表 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">可选模型（从 API 获取）</label>
                    <button
                      type="button"
                      onClick={() => loadApiModels(true)}
                      disabled={apiModelsLoading || !apiKey?.trim()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium disabled:opacity-50 transition-all"
                      title="手动刷新模型列表"
                    >
                      <RefreshCw size={12} className={apiModelsLoading ? 'animate-spin' : ''} />
                      {apiModelsLoading ? '刷新中…' : '刷新列表'}
                    </button>
                  </div>
                  {apiModelsError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{apiModelsError}</p>
                  )}
                  {apiModels.length > 0 ? (
                    <>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={addModelSearch}
                          onChange={(e) => setAddModelSearch(e.target.value)}
                          placeholder="搜索模型名称…"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
                        {(() => {
                          const q = addModelSearch.trim().toLowerCase();
                          const filtered = q
                            ? apiModels.filter((m) => m.id.toLowerCase().includes(q))
                            : apiModels;
                          if (filtered.length === 0) {
                            return (
                              <div className="px-4 py-3 text-xs text-zinc-400 text-center">
                                未找到匹配的模型
                              </div>
                            );
                          }
                          return (
                            <div className="p-1.5 space-y-0.5">
                              {filtered.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setAddModelName(m.id);
                                    setAddModelSearch('');
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    addModelName === m.id
                                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                  }`}
                                >
                                  {m.id}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-zinc-400 py-1">暂无缓存，请先配置 API Key 后点击「刷新列表」</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">协议类型</label>
                  <div className="flex gap-2">
                    {(['openai', 'anthropic', 'gemini'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAddModelProtocol(p)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          addModelProtocol === p
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {PROTOCOL_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">模型名称 / ID</label>
                  <input
                    type="text"
                    value={addModelName}
                    onChange={(e) => setAddModelName(e.target.value)}
                    placeholder="例如 gpt-4o、claude-3-5-sonnet、gemini-2.0-flash 或从上拉框选择"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModelOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={saveAddModel}
                    disabled={!addModelName.trim()}
                    className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    添加
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
          {activeSession?.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700 space-y-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-[32px] bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center"
              >
                <Bot size={48} strokeWidth={1} />
              </motion.div>
              <div className="text-center space-y-3">
                <div className="space-y-1">
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">开始对话</p>
                  <p className="text-sm font-medium text-zinc-400">输入任何问题，AI 将为您提供专业的解答</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {[
                    '帮我写一段产品介绍文案，适合官网使用，字数控制在 150 字左右。',
                    '这段文字帮我润色成更专业的商务邮件语气：\n',
                    '下面这段代码有什么可以优化的地方？请一步步说明你的思路。\n',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="px-3 py-2 rounded-2xl text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/70 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors max-w-xs text-left"
                    >
                      {q.length > 30 ? `${q.slice(0, 30)}...` : q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeSession?.messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm ${
                m.role === 'user' 
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' 
                  : 'bg-white dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-700'
              }`}>
                {m.role === 'user' ? <User size={22} /> : <Bot size={22} />}
              </div>
              <div className={`p-5 rounded-[24px] max-w-[80%] shadow-sm ${
                m.role === 'user' 
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-tr-none' 
                  : 'bg-zinc-50 dark:bg-zinc-800/50 dark:text-white border border-zinc-100 dark:border-zinc-800 rounded-tl-none'
              }`}>
                <div className="flex items-start gap-2">
                  <p className="whitespace-pre-wrap leading-relaxed text-[15px] font-medium tracking-tight flex-1">
                    {m.content}
                  </p>
                  {m.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!activeSession) return;
                        const messages = activeSession.messages;
                        let lastUser: Message | null = null;
                        for (let idx = i - 1; idx >= 0; idx--) {
                          if (messages[idx]?.role === 'user') {
                            lastUser = messages[idx];
                            break;
                          }
                        }
                        if (lastUser) {
                          sendMessage(lastUser.content);
                        }
                      }}
                      className="ml-2 mt-0.5 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                      title="基于上一次提问重新生成本条回答"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex gap-5">
              <div className="w-11 h-11 rounded-[14px] bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center shadow-sm">
                <Bot size={22} className="text-zinc-400" />
              </div>
              <div className="p-5 rounded-[24px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-tl-none flex items-center gap-2">
                <span className="flex gap-1">
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-3 px-1">
              <ModelSelector
                modelOptions={modelOptions}
                activeModelId={activeSession?.model ?? 'gemini-3-flash-latest'}
                onSelect={handleModelSelect}
                onAddModel={openAddModel}
                onSetDefault={handleSetDefaultModel}
                onDeleteModel={handleDeleteModel}
              />
              <div className="flex items-center gap-3">
                <ContextIndicator used={usedContext} max={MAX_CONTEXT_SIZE} />
                {hasTruncatedContext && (
                  <span className="text-[10px] font-medium text-amber-500">
                    为避免超过上下文限制，部分较早对话已被自动省略。
                  </span>
                )}
                {activeSession?.messages.length
                  ? (
                    <button
                      type="button"
                      onClick={clearCurrentSessionMessages}
                      className="text-[10px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline-offset-2 hover:underline"
                    >
                      清空本会话上下文
                    </button>
                  )
                  : null}
              </div>
            </div>
            
            <div className="relative group">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入消息，Shift + Enter 换行..."
                className="w-full p-5 pr-20 rounded-[28px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 dark:text-white focus:ring-4 focus:ring-zinc-900/5 dark:focus:ring-white/5 outline-none transition-all text-[15px] font-medium shadow-sm resize-none overflow-hidden"
                style={{ height: 'auto', minHeight: '64px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 top-3 bottom-3 px-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[20px] hover:opacity-90 disabled:opacity-30 transition-all shadow-xl flex items-center justify-center"
              >
                <Send size={20} />
              </button>
            </div>
            {!apiKey?.trim() && (
              <p className="text-[11px] text-center text-red-500 font-medium">
                未配置 API Key，当前对话无法调用模型，请先前往左侧「设置」中添加并选择要使用的 Key。
              </p>
            )}
            <p className="text-[10px] text-center text-zinc-400 font-medium uppercase tracking-widest">
              AI 可能会产生错误信息，请核实重要内容
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

