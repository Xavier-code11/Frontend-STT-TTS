// Centralized environment config accessor with safe defaults and minor normalization.

const getEnv = (key, fallback = undefined) => {
  // Prefer process.env (injected via Vite define), fallback to import.meta.env
  const fromProcess = typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  let fromImportMeta;
  try { fromImportMeta = import.meta?.env?.[key]; } catch { fromImportMeta = undefined; }
  return (fromProcess ?? fromImportMeta ?? fallback);
};

const ensureApiV1Prefix = (baseUrl) => {
  if (!baseUrl) return baseUrl;
  try {
    const url = new URL(baseUrl);
    // Ensure path has /api/v1 as prefix
    if (!url.pathname.startsWith('/api/v1')) {
      url.pathname = `/api/v1${url.pathname === '/' ? '' : url.pathname}`;
    }
    return url.toString();
  } catch {
    return baseUrl; // If it's not a full URL, return as-is
  }
};

const normalizeWsForHttps = (wsUrl) => {
  if (!wsUrl) return wsUrl;
  try {
    const url = new URL(wsUrl);
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
      if (url.protocol === 'ws:') url.protocol = 'wss:';
    }
    return url.toString();
  } catch {
    return wsUrl;
  }
};

export const Env = {
  BACKEND_HTTP_URL: ensureApiV1Prefix(getEnv('REACT_APP_BACKEND_HTTP_URL', 'http://localhost:8000')),
  BACKEND_WS_URL: normalizeWsForHttps(ensureApiV1Prefix(getEnv('REACT_APP_BACKEND_WS_URL', 'ws://localhost:8000'))),
  SESSION_ID: getEnv('REACT_APP_SESSION_ID', 'web-client'),
  LANGUAGE: getEnv('REACT_APP_LANGUAGE', 'id'),
  AUDIO_MIME: getEnv('REACT_APP_AUDIO_MIME', 'audio/wav'),
};

export default Env;
