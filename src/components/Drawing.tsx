import React, { useState, useCallback, useRef, useEffect, useContext, createContext } from 'react';
import { 
  Image as ImageIcon, Download, Loader2, Sparkles, ArrowLeft, 
  Palette, ImagePlus, Wand2, Package, Upload, History, Info, ChevronRight, X, Plus, Settings, Play, Square,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateGeminiImage } from '../services/imageGenApi';
import { ReactFlow, Background, Controls, addEdge, Handle, Position, useNodesState, useEdgesState, Connection, Edge, useReactFlow, SelectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';

const FlowContext = createContext<{
  runNode: (id: string) => void;
  onPreview: (src: string) => void;
} | null>(null);

/** 自定义绘图固定模型（展示名 → Gemini 模型 ID） */
const CUSTOM_DRAW_IMAGE_MODELS = [
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2' },
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana' },
] as const;

type CustomDrawResolution = '1K' | '2K' | '4K';

const getCustomDrawModelLabel = (modelId?: string) => {
  if (!modelId) return '';
  return CUSTOM_DRAW_IMAGE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
};

/**
 * 将 base64 data URL 转为 Blob URL，显著降低存储在 React 状态中的字符串体积。
 * Blob URL 只是一个短字符串引用（如 blob:http://...），实际数据由浏览器管理。
 */
const dataUrlToBlobUrl = (dataUrl: string): string => {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;
    const meta = dataUrl.slice(0, commaIdx);
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] || 'image/png';
    const b64 = dataUrl.slice(commaIdx + 1);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u8], { type: mime }));
  } catch {
    return dataUrl;
  }
};

/**
 * 生成缩略图：节点显示区域仅 176×176 CSS px，考虑 2x 高清屏取 384px 上限。
 * 使用 createImageBitmap（异步、不阻塞主线程）+ OffscreenCanvas 生成。
 * 返回 Blob URL 而非 base64 data URL，极大减小 React 状态体积。
 */
const generateThumbnail = async (src: string, maxSize = 384): Promise<string> => {
  try {
    let bitmap: ImageBitmap;
    if (src.startsWith('blob:') || src.startsWith('http')) {
      const resp = await fetch(src);
      const blob = await resp.blob();
      bitmap = await createImageBitmap(blob);
    } else {
      const commaIdx = src.indexOf(',');
      if (commaIdx === -1) return src;
      const meta = src.slice(0, commaIdx);
      const mimeMatch = meta.match(/data:([^;]+)/);
      const mime = mimeMatch?.[1] || 'image/png';
      const b64 = src.slice(commaIdx + 1);
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      bitmap = await createImageBitmap(blob);
    }

    let { width, height } = bitmap;
    if (width > height) {
      if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
    } else {
      if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
    }

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    if (!ctx) { bitmap.close(); return src; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.88 });
    return URL.createObjectURL(blob);
  } catch {
    return src;
  }
};

const CustomDrawing: React.FC<{ apiKey?: string; onBack: () => void }> = ({ apiKey, onBack }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(CUSTOM_DRAW_IMAGE_MODELS[2].id);
  const [resolution, setResolution] = useState<CustomDrawResolution>('2K');
  const [aspectRatio, setAspectRatio] = useState('1:1');

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setImage(null);

    try {
      const result = await generateGeminiImage({
        apiKey: apiKey || '',
        modelId: selectedModel,
        prompt,
        aspectRatio,
        imageSize: resolution,
      });
      setImage(result.dataUrl);
    } catch (error) {
      console.error(error);
      toast.error('生成失败，请检查 API Key 或网络。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 h-full flex flex-col">
      <div className="flex items-center mb-8">
        <button 
          onClick={onBack}
          className="p-2 mr-4 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight dark:text-white">自定义绘图</h2>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">将您的想象力转化为绚丽的视觉杰作</p>
        </div>
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

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">模型</label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoading}
                className="w-full appearance-none p-4 pr-10 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 disabled:opacity-60"
              >
                {CUSTOM_DRAW_IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}（{m.id}）
                  </option>
                ))}
              </select>
              <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none rotate-90" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">画面比例</label>
            <div className="grid grid-cols-5 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
              {(['1:1', '4:3', '3:4', '16:9', '9:16'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                    aspectRatio === ratio
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">分辨率</label>
            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
              {(['1K', '2K', '4K'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setResolution(res)}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${
                    resolution === res
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
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

const ImageNode = React.memo(({ id, data }: any) => {
  const { setNodes, deleteElements } = useReactFlow();
  const flowContext = useContext(FlowContext);
  const [showControls, setShowControls] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleHistoryClick = useCallback(async (historySrc: string) => {
    const thumbnail = await generateThumbnail(historySrc);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, src: historySrc, thumbnail } };
        }
        return n;
      })
    );
  }, [id, setNodes]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  const handlePreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.src) {
      flowContext?.onPreview(data.src);
    }
  }, [data.src, flowContext]);

  const onMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowControls(true);
    }, 1500);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowControls(false);
  }, []);

  const onMouseDown = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowControls(false);
  }, []);

  const downloadSrc = typeof data?.src === 'string' ? data.src : '';
  const displaySrc = data.thumbnail || data.src;

  return (
    <div 
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      className="bg-white dark:bg-zinc-800 p-2.5 rounded-2xl shadow-md border border-zinc-200 dark:border-zinc-700 relative group min-w-[200px] flex flex-col items-center hover:shadow-xl hover:border-indigo-500/50"
    >
      <Handle type="target" position={Position.Left} className="w-6 h-6 bg-zinc-300 border-4 border-white dark:border-zinc-800 hover:scale-125 hover:bg-zinc-400 transition-transform shadow-md cursor-crosshair" />
      
      <div className="w-44 h-44 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 relative group/img shadow-inner border border-zinc-100 dark:border-zinc-800">
        <img 
          src={displaySrc} 
          alt="uploaded" 
          className="w-full h-full object-cover" 
          draggable={false}
          referrerPolicy="no-referrer"
        />
        
        <div 
          className={`absolute inset-0 cursor-pointer flex flex-col items-center justify-center gap-3 ${
            showControls ? 'bg-black/40 opacity-100' : 'bg-black/0 opacity-0 pointer-events-none'
          }`}
        >
          <button 
            onClick={handleDelete} 
            className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-md text-white rounded-full p-1.5 hover:bg-red-600 hover:scale-110 active:scale-95 z-10"
            title="删除"
          >
            <X size={14} />
          </button>

          <div className={`absolute bottom-2 left-0 right-0 flex justify-center gap-3 ${showControls ? '' : 'translate-y-2'}`}>
            {downloadSrc && (
              <a
                href={downloadSrc}
                download="supioc-ai-art.png"
                onClick={(e) => e.stopPropagation()}
                className="bg-white/20 backdrop-blur-md text-white rounded-lg px-3 py-1 text-[10px] font-bold border border-white/30 hover:bg-white/40 transition-colors flex items-center gap-1"
                title="下载"
              >
                <Download size={12} />
                下载
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(e);
              }}
              className="bg-white/20 backdrop-blur-md text-white rounded-lg px-3 py-1 text-[10px] font-bold border border-white/30 hover:bg-white/40 transition-colors flex items-center gap-1"
              title="预览"
            >
              <Eye size={12} />
              预览
            </button>
          </div>
        </div>
      </div>
      
      {data.history && data.history.length > 1 && (
        <div className="flex gap-1 mt-2">
          {data.history.map((hSrc: string, i: number) => (
            <img 
              key={i} 
              src={hSrc} 
              alt={`history-${i}`} 
              onClick={() => handleHistoryClick(hSrc)}
              draggable={false}
              className={`w-8 h-8 object-cover rounded cursor-pointer border-2 ${data.src === hSrc ? 'border-indigo-500' : 'border-transparent hover:border-zinc-400'}`}
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      )}

      <input
        value={data.label ?? '图片节点'}
        onChange={(e) => {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === id) {
                return { ...n, data: { ...n.data, label: e.target.value } };
              }
              return n;
            })
          );
        }}
        className="nodrag mt-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-transparent border-none text-center outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 w-full"
      />
      <Handle type="source" position={Position.Right} className="w-6 h-6 bg-indigo-500 border-4 border-white dark:border-zinc-800 hover:scale-125 hover:bg-indigo-400 transition-transform shadow-md cursor-crosshair" />
    </div>
  );
});

const GeneratorNode = React.memo(({ id, data }: any) => {
  const flowContext = useContext(FlowContext);
  const { deleteElements } = useReactFlow();

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xl border-2 border-indigo-500 w-48 transition-all hover:shadow-indigo-500/20 group relative">
      <button onClick={handleDelete} className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50 hover:bg-red-600">
        <X size={12} />
      </button>
      {/* Run Button */}
      <div className="absolute top-2 right-2 z-10">
        {data.status === 'running' ? (
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); flowContext?.runNode(id); }}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
            title="单节点运行"
          >
            <Play size={14} fill="currentColor" />
          </button>
        )}
      </div>

      {/* Reference Image Handle */}
      <Handle type="target" position={Position.Left} id="reference" style={{ top: '30%' }} className="peer/ref w-6 h-6 bg-yellow-500 border-4 border-white dark:border-zinc-900 hover:scale-125 hover:bg-yellow-400 transition-transform shadow-md cursor-crosshair" />
      <div className="absolute left-2 top-[30%] -translate-y-1/2 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 peer-hover/ref:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">参考图入口</div>
      
      {/* Product Image Handle */}
      <Handle type="target" position={Position.Left} id="product" style={{ top: '70%' }} className="peer/prod w-6 h-6 bg-blue-500 border-4 border-white dark:border-zinc-900 hover:scale-125 hover:bg-blue-400 transition-transform shadow-md cursor-crosshair" />
      <div className="absolute left-2 top-[70%] -translate-y-1/2 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 peer-hover/prod:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">商品图入口</div>
      
      <div className="flex flex-col items-center justify-center py-4 text-indigo-500">
        <Sparkles size={32} className="mb-2" />
        <span className="font-bold text-sm">生成器节点</span>
        <span className="text-[10px] text-zinc-400 mt-1 dark:text-zinc-500 text-center px-2">单击配置 / 双击删除</span>

        {/* Configuration Preview */}
        <div className="mt-3 w-full flex flex-col gap-1.5 px-1">
          <div className="flex justify-center gap-1 flex-wrap">
            {data.resolution && <span className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded font-medium">{data.resolution}</span>}
            {data.aspectRatio && <span className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded font-medium">{data.aspectRatio}</span>}
            {data.selectedModel && (
              <span
                className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded font-medium max-w-[90px] truncate"
                title={data.selectedModel}
              >
                {getCustomDrawModelLabel(data.selectedModel)}
              </span>
            )}
          </div>
          {data.productInfo && (
            <div className="text-[9px] text-zinc-500 dark:text-zinc-400 text-center line-clamp-2 leading-tight bg-zinc-50 dark:bg-zinc-800/50 p-1.5 rounded border border-zinc-100 dark:border-zinc-700/50">
              {data.productInfo}
            </div>
          )}
        </div>

        {data.status === 'success' && (
          <span className="mt-3 text-[10px] bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 px-3 py-1 rounded-full font-bold flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 已生成
          </span>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} className="w-6 h-6 bg-indigo-500 border-4 border-white dark:border-zinc-900 hover:scale-125 hover:bg-indigo-400 transition-transform shadow-md cursor-crosshair" />
    </div>
  );
});

const nodeTypes = {
  imageNode: ImageNode,
  generatorNode: GeneratorNode,
};

const ProductSuiteDrawing: React.FC<{ apiKey?: string; onBack: () => void }> = ({ apiKey, onBack }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeGenNodeId, setActiveGenNodeId] = useState<string | null>(null);
  const [isGlobalRunning, setIsGlobalRunning] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const cancelRef = useRef(false);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Modal form state
  const [productInfo, setProductInfo] = useState('');
  const [selectedModel, setSelectedModel] = useState<(typeof CUSTOM_DRAW_IMAGE_MODELS)[number]['id']>(
    CUSTOM_DRAW_IMAGE_MODELS[2].id
  );
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onConnect = useCallback((params: Connection | Edge) => {
    let strokeColor = '#6366f1'; // default indigo
    if (params.targetHandle === 'reference') strokeColor = '#eab308'; // yellow
    else if (params.targetHandle === 'product') strokeColor = '#3b82f6'; // blue
    
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: strokeColor, strokeWidth: 2 } } as any, eds));
  }, [setEdges]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(async (file: File, index) => {
      const blobUrl = URL.createObjectURL(file);
      const thumbnail = await generateThumbnail(blobUrl);
      const newNode = {
        id: `img-${Date.now()}-${index}`,
        type: 'imageNode',
        position: { x: Math.random() * 100 + 50, y: Math.random() * 100 + 100 },
        data: { src: blobUrl, thumbnail },
      };
      setNodes((nds) => [...nds, newNode]);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setNodes]);

  const addGeneratorNode = () => {
    const newNode = {
      id: `gen-${Date.now()}`,
      type: 'generatorNode',
      position: { x: 400, y: 200 },
      data: {
        resultImage: null,
        productInfo: '',
        selectedModel: CUSTOM_DRAW_IMAGE_MODELS[2].id,
        resolution: '2K',
        aspectRatio: '1:1',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onNodeClick = (event: React.MouseEvent, node: any) => {
    if (node.type === 'generatorNode') {
      setActiveGenNodeId(node.id);
      setProductInfo(node.data.productInfo || '');
      setSelectedModel(node.data.selectedModel || CUSTOM_DRAW_IMAGE_MODELS[2].id);
      setResolution(node.data.resolution || '2K');
      setAspectRatio(node.data.aspectRatio || '1:1');
      setIsModalOpen(true);
    }
  };

  const onNodesDelete = useCallback((deletedNodes: any[]) => {
    const deletedIds = deletedNodes.map(n => n.id);
    if (activeGenNodeId && deletedIds.includes(activeGenNodeId)) {
      setIsModalOpen(false);
      setActiveGenNodeId(null);
    }
  }, [activeGenNodeId]);

  const executeNode = async (nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n));

    try {
      for (let i = 0; i < 20; i++) {
        if (cancelRef.current) {
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle' } } : n));
          throw new Error('Cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const activeNode = nodesRef.current.find(n => n.id === nodeId);
      const ratio = activeNode?.data?.aspectRatio || '1:1';
      const resolutionValue = activeNode?.data?.resolution || '2K';
      const modelId = activeNode?.data?.selectedModel || CUSTOM_DRAW_IMAGE_MODELS[2].id;
      const safeModelId = CUSTOM_DRAW_IMAGE_MODELS.some((m) => m.id === modelId) ? modelId : CUSTOM_DRAW_IMAGE_MODELS[2].id;
      const promptValue = activeNode?.data?.productInfo || '生成一张高质量图片';

      const outgoingEdges = edgesRef.current.filter(e => e.source === nodeId);
      let targetImageNodeId = null;
      for (const edge of outgoingEdges) {
        const targetNode = nodesRef.current.find(n => n.id === edge.target);
        if (targetNode && targetNode.type === 'imageNode') {
          targetImageNodeId = targetNode.id;
          break;
        }
      }

      if (cancelRef.current) {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle' } } : n));
        throw new Error('Cancelled');
      }

      const parseImageSrc = async (src?: unknown): Promise<{ mimeType: string; dataBase64: string } | null> => {
        if (typeof src !== 'string') return null;
        if (src.startsWith('data:')) {
          const commaIndex = src.indexOf(',');
          if (commaIndex === -1) return null;
          const meta = src.slice(5, commaIndex);
          const base64 = src.slice(commaIndex + 1);
          const mimeType = meta.split(';')[0] || 'image/png';
          return { mimeType, dataBase64: base64 };
        }
        if (src.startsWith('blob:')) {
          try {
            const resp = await fetch(src);
            const blob = await resp.blob();
            const mimeType = blob.type || 'image/png';
            const buf = await blob.arrayBuffer();
            const u8 = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
            return { mimeType, dataBase64: btoa(binary) };
          } catch { return null; }
        }
        return null;
      };

      const incomingEdges = edgesRef.current.filter((e: any) => e.target === nodeId);
      const referenceEdge = incomingEdges.find((e: any) => e.targetHandle === 'reference');
      const productEdge = incomingEdges.find((e: any) => e.targetHandle === 'product');

      const referenceSourceNode = referenceEdge ? nodesRef.current.find((n: any) => n.id === referenceEdge.source) : undefined;
      const productSourceNode = productEdge ? nodesRef.current.find((n: any) => n.id === productEdge.source) : undefined;

      const referenceSrc = referenceSourceNode
        ? referenceSourceNode.type === 'imageNode'
          ? referenceSourceNode.data?.src
          : referenceSourceNode.data?.resultImage
        : undefined;
      const productSrc = productSourceNode
        ? productSourceNode.type === 'imageNode'
          ? productSourceNode.data?.src
          : productSourceNode.data?.resultImage
        : undefined;

      const [referenceImage, productImage] = await Promise.all([
        parseImageSrc(referenceSrc),
        parseImageSrc(productSrc),
      ]);

      const hasReference = !!referenceImage;
      const hasProduct = !!productImage;

      // 在用户提示词基础上追加“输入图片含义”，让模型知道两张图分别代表参考图和产品图。
      let finalPrompt = promptValue;
      if (hasReference && hasProduct) {
        finalPrompt =
          `${promptValue}\n\n你有两张输入图片：\n` +
          `- 输入图片1：参考图（参考图，用于借鉴风格、构图、光影等）\n` +
          `- 输入图片2：产品图（产品图，作为主要主体形象）\n\n` +
          `请综合参考图的视觉风格，并以产品图为主体生成一张新的成品图。`;
      } else if (hasProduct || hasReference) {
        finalPrompt =
          `${promptValue}\n\n你只有一张输入图片：\n` +
          `- 输入图片1：用于“提示词图生图”（图像输入+提示词共同决定成品）\n\n` +
          `请根据提示词与输入图片生成一张成品图。`;
      } else {
        finalPrompt =
          `${promptValue}\n\n当前没有任何输入图片，这是纯文本生图任务。请仅根据提示词生成图像。`;
      }

      const genResult = await generateGeminiImage({
        apiKey: apiKey || '',
        modelId: safeModelId,
        prompt: finalPrompt,
        aspectRatio: ratio,
        imageSize: resolutionValue,
        images: hasReference && hasProduct
          ? [referenceImage!, productImage!]
          : hasReference
            ? [referenceImage!]
            : hasProduct
              ? [productImage!]
              : [],
      });

      const resultImage = dataUrlToBlobUrl(genResult.dataUrl);
      const resultThumbnail = await generateThumbnail(resultImage);

      if (targetImageNodeId) {
        setNodes(nds => nds.map(n => {
          if (n.id === nodeId) {
            return { ...n, data: { ...n.data, status: 'success', resultImage } };
          }
          if (n.id === targetImageNodeId) {
            const currentHistory = n.data.history || [n.data.src];
            const newHistory = [resultImage, ...currentHistory.filter((src: string) => src !== resultImage)].slice(0, 3);
            return {
              ...n,
              data: { ...n.data, src: resultImage, thumbnail: resultThumbnail, history: newHistory }
            };
          }
          return n;
        }));
      } else {
        const newImageNodeId = `img-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        setNodes(nds => {
          const activeNode = nds.find(n => n.id === nodeId);
          const newImageNode = {
            id: newImageNodeId,
            type: 'imageNode',
            position: { 
              x: activeNode ? activeNode.position.x + 350 : 400, 
              y: activeNode ? activeNode.position.y : 200 
            },
            data: { src: resultImage, thumbnail: resultThumbnail, history: [resultImage] }
          };

          const updatedNodes = nds.map(n => {
            if (n.id === nodeId) {
              return { ...n, data: { ...n.data, status: 'success', resultImage } };
            }
            return n;
          });

          return [...updatedNodes, newImageNode];
        });

        setEdges(eds => [
          ...eds,
          {
            id: `edge-${nodeId}-${newImageNodeId}`,
            source: nodeId,
            target: newImageNodeId,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 }
          }
        ]);
      }
    } catch (error) {
      console.error(error);
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle' } } : n));
    }
  };

  const runAllNodes = async () => {
    cancelRef.current = false;
    setIsGlobalRunning(true);

    const genNodes = nodesRef.current
      .filter(n => n.type === 'generatorNode')
      .sort((a, b) => a.position.x - b.position.x);

    for (const node of genNodes) {
      if (cancelRef.current) break;
      await executeNode(node.id);
    }

    setIsGlobalRunning(false);
  };

  const stopAllNodes = () => {
    cancelRef.current = true;
    setIsGlobalRunning(false);
    setNodes(nds => nds.map(n => n.data?.status === 'running' ? { ...n, data: { ...n.data, status: 'idle' } } : n));
  };

  const handleSaveConfig = () => {
    if (!activeGenNodeId) return;
    setIsModalOpen(false);
    
    setNodes(nds => nds.map(n => {
      if (n.id === activeGenNodeId) {
        return {
          ...n,
          data: { ...n.data, productInfo, selectedModel, resolution, aspectRatio }
        };
      }
      return n;
    }));
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-6 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <button 
          onClick={onBack}
          className="p-2 mr-4 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">无限画布创作</h2>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative group">
            <button className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              <Info size={18} />
            </button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-zinc-600 dark:text-zinc-300 space-y-2 pointer-events-none text-left">
              <p className="font-bold text-zinc-800 dark:text-zinc-100">画布使用指南：</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>上传图片作为节点，支持键盘Delete键或滑入点击X删除</li>
                <li>添加生成器节点，单击配置参数</li>
                <li>将图片连线至生成器：<br/>
                  <span className="text-yellow-500 font-bold">黄环</span> = 参考图入口<br/>
                  <span className="text-blue-500 font-bold">蓝环</span> = 商品图入口
                </li>
                <li>支持不连线直接无图生图</li>
                <li>支持生成器直接连生成器</li>
              </ul>
            </div>
          </div>
          {isGlobalRunning ? (
            <button 
              onClick={stopAllNodes}
              className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20"
            >
              <Square size={16} fill="currentColor" /> 终止运行
            </button>
          ) : (
            <button 
              onClick={runAllNodes}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20"
            >
              <Play size={16} fill="currentColor" /> 整体运行
            </button>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
          >
            <Upload size={16} /> 上传图片
          </button>
          <button 
            onClick={addGeneratorNode}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus size={16} /> 添加生成器
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 w-full h-full pt-[73px]">
        <FlowContext.Provider value={{ runNode: executeNode, onPreview: (src) => setPreviewImage(src) }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodesDelete={onNodesDelete}
            deleteKeyCode={['Backspace', 'Delete']}
            panOnDrag={[1, 2]}
            selectionOnDrag={true}
            selectionMode={SelectionMode.Partial}
            nodeTypes={nodeTypes}
            fitView
            className="bg-zinc-50 dark:bg-zinc-950"
          >
            <Background color="#a1a1aa" gap={16} size={1} />
            <Controls className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 fill-zinc-700 dark:fill-zinc-300" />
          </ReactFlow>
        </FlowContext.Provider>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div 
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-10"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 md:-right-12 p-2 text-white/70 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
              <img 
                src={previewImage} 
                alt="Preview" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
                <a 
                  href={previewImage} 
                  download="supioc-preview.png"
                  className="px-6 py-2 bg-white text-zinc-900 rounded-full font-bold flex items-center gap-2 hover:bg-zinc-100 transition-colors shadow-lg"
                >
                  <Download size={18} /> 下载原图
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <Settings size={20} className="text-indigo-500" /> 配置生成参数
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} className="text-zinc-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                {/* Product Info */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-zinc-800 dark:text-zinc-200">提示词 / 商品信息</label>
                  <textarea
                    value={productInfo}
                    onChange={(e) => setProductInfo(e.target.value)}
                    placeholder="描述您想要的场景、风格、光影等..."
                    className="w-full h-32 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none dark:text-white"
                  />
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-zinc-800 dark:text-zinc-200">模型选择</label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full appearance-none p-4 pr-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      {CUSTOM_DRAW_IMAGE_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none rotate-90" />
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-zinc-800 dark:text-zinc-200">画面比例</label>
                  <div className="grid grid-cols-5 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    {['1:1', '4:3', '3:4', '16:9', '9:16'].map((ratio) => (
                      <button 
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-3 text-xs font-bold rounded-lg transition-all ${aspectRatio === ratio ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-zinc-800 dark:text-zinc-200">分辨率</label>
                  <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <button 
                      onClick={() => setResolution('1K')}
                      className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${resolution === '1K' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      1K
                    </button>
                    <button 
                      onClick={() => setResolution('2K')}
                      className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${resolution === '2K' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      2K
                    </button>
                    <button 
                      onClick={() => setResolution('4K')}
                      className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${resolution === '4K' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      4K
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <button 
                  onClick={handleSaveConfig}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Settings size={20} />
                  保存配置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Drawing: React.FC<{ apiKey?: string }> = ({ apiKey }) => {
  const [currentView, setCurrentView] = useState<'hub' | 'custom' | 'product-suite'>('hub');

  const features = [
    {
      id: 'custom',
      title: '自定义绘图',
      description: '通过文本描述生成独特的艺术作品',
      icon: <Palette size={32} className="text-indigo-500" />,
      available: true,
    },
    {
      id: 'product-suite',
      title: '商品套图',
      description: '上传商品图，一键生成高质量场景图和营销海报',
      icon: <Package size={32} className="text-emerald-500" />,
      available: true,
    },
    {
      id: 'edit',
      title: '图像编辑',
      description: '智能修改和增强您的现有图片',
      icon: <ImagePlus size={32} className="text-zinc-400" />,
      available: false,
    },
    {
      id: 'style',
      title: '风格转换',
      description: '将照片转换为不同的艺术风格',
      icon: <Wand2 size={32} className="text-zinc-400" />,
      available: false,
    }
  ];

  return (
    <div className="h-full w-full relative">
      <AnimatePresence mode="wait">
        {currentView === 'hub' ? (
          <motion.div 
            key="hub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-5xl mx-auto p-6 md:p-12 h-full flex flex-col"
          >
            <div className="text-center mb-16 mt-8">
              <h2 className="text-4xl font-bold tracking-tight dark:text-white mb-4">AI 创意绘图</h2>
              <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">探索无限的视觉可能，选择一个功能开始</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <button
                  key={feature.id}
                  onClick={() => feature.available && setCurrentView(feature.id as any)}
                  disabled={!feature.available}
                  className={`flex flex-col items-start p-8 rounded-3xl border text-left transition-all duration-200 ${
                    feature.available 
                      ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:border-indigo-500/30 dark:hover:border-indigo-500/30 group cursor-pointer' 
                      : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800/50 opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className={`p-4 rounded-2xl mb-6 ${feature.available ? 'bg-indigo-50 dark:bg-indigo-500/10 group-hover:scale-110 transition-transform' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                    {feature.title}
                    {!feature.available && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-full">
                        待定
                      </span>
                    )}
                  </h3>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        ) : currentView === 'custom' ? (
          <motion.div
            key="custom"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <CustomDrawing apiKey={apiKey} onBack={() => setCurrentView('hub')} />
          </motion.div>
        ) : (
          <motion.div
            key="product-suite"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <ProductSuiteDrawing apiKey={apiKey} onBack={() => setCurrentView('hub')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
