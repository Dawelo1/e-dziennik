import { getToken } from './authUtils';

export const getChatWebSocketUrl = () => {
  const token = getToken();
  if (!token) return null;

  const configuredUrl = import.meta.env.VITE_WS_CHAT_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const fallbackUrl = `${protocol}://${window.location.host}/ws/chat/`;
  const baseUrl = configuredUrl || fallbackUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};
