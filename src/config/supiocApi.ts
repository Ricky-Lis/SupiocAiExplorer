/**
 * Supioc 网关 base URL（Vite 在构建时写入，改 .env 后须重新 build）。
 * - 默认（开发/生产）：同源前缀 /api-proxy，避免未配环境变量时直连 api.supioc.com 触发 CORS；需 Vite 或 nginx 配置 /api-proxy/ 反代。
 * - VITE_SUPIOC_SAME_ORIGIN_API=1：无前缀，路径为 /api/、/v1/…（nginx 须分别反代，见 .env.example）
 * - VITE_SUPIOC_API_BASE：自定义前缀。
 * - VITE_SUPIOC_DIRECT_API=1：浏览器直连 https://api.supioc.com（仅当上游已正确配置 CORS 时使用）。
 *
 * 本仓库经 supiocUrl() 发出的路径（同源反代时需全部可达 api.supioc.com）：
 *   GET  /api/token/
 *   GET  /v1/models
 *   POST /v1/chat/completions
 *   POST /v1/messages
 *   POST /v1beta/models/{model}:generateContent
 * 仅 location /api/ 无法覆盖 /v1/、/v1beta/。
 */
export function getSupiocApiBase(): string {
  const sameOrigin =
    import.meta.env.VITE_SUPIOC_SAME_ORIGIN_API === '1' ||
    import.meta.env.VITE_SUPIOC_SAME_ORIGIN_API === 'true';
  if (sameOrigin) {
    return '';
  }
  const base = (import.meta.env.VITE_SUPIOC_API_BASE as string | undefined)?.trim();
  if (base) {
    return base.replace(/\/$/, '');
  }
  const direct =
    import.meta.env.VITE_SUPIOC_DIRECT_API === '1' ||
    import.meta.env.VITE_SUPIOC_DIRECT_API === 'true';
  if (direct) {
    return 'https://api.supioc.com';
  }
  return '/api-proxy';
}

/** path 须以 / 开头，例如 /v1/models */
export function supiocUrl(path: string): string {
  const base = getSupiocApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base === '') {
    return p;
  }
  return `${base}${p}`;
}
