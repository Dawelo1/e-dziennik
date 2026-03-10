import { getToken } from './authUtils';
import { getDefaultChatWsUrl } from './apiConfig';

export const getChatWebSocketUrl = () => {
  const token = getToken();
  if (!token) return null;

  const configuredUrl = import.meta.env.VITE_WS_CHAT_URL;
  const baseUrl = configuredUrl || getDefaultChatWsUrl();
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};
