const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') return DEFAULT_API_BASE_URL;
  return value.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const toAbsoluteMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const getDefaultChatWsUrl = () => {
  try {
    const parsed = new URL(API_BASE_URL);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${parsed.host}/ws/chat/`;
  } catch {
    return 'ws://127.0.0.1:8000/ws/chat/';
  }
};
