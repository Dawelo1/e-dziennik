import axios from 'axios';

const PRODUCTION_API_ORIGIN = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const LOCAL_API_ORIGINS = ['http://127.0.0.1:8000', 'http://localhost:8000'];

function remapLocalApiUrl(url) {
  if (!PRODUCTION_API_ORIGIN || typeof url !== 'string') {
    return url;
  }

  for (const localOrigin of LOCAL_API_ORIGINS) {
    if (url.startsWith(localOrigin)) {
      return `${PRODUCTION_API_ORIGIN}${url.slice(localOrigin.length)}`;
    }
  }

  return url;
}

export function setupAxiosApiConfig() {
  axios.interceptors.request.use((config) => {
    const nextConfig = { ...config };
    nextConfig.url = remapLocalApiUrl(config.url);
    return nextConfig;
  });
}
