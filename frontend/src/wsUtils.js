import { getToken } from './authUtils';

export const getChatWebSocketUrl = () => {
  const token = getToken();
  if (!token) return null;

  const configuredUrl = import.meta.env.VITE_WS_CHAT_URL;
  const baseUrl = configuredUrl || 'ws://127.0.0.1:8000/ws/chat/';
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};
