// frontend/src/authUtils.js

// 1. Pobieranie tokena (sprawdza oba magazyny)
export const getToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const getAuthStorage = () => {
  if (localStorage.getItem('token')) return localStorage;
  if (sessionStorage.getItem('token')) return sessionStorage;
  return localStorage;
};

// 2. Zapisywanie tokena (zależnie od "Zapamiętaj mnie")
export const setToken = (token, rememberMe) => {
  // Najpierw czyścimy, żeby nie było duplikatów
  removeToken();
  
  if (rememberMe) {
    localStorage.setItem('token', token);
  } else {
    sessionStorage.setItem('token', token);
  }
};

export const setActiveChildId = (childId) => {
  localStorage.removeItem('activeChildId');
  sessionStorage.removeItem('activeChildId');

  if (childId === null || childId === undefined || childId === '') return;
  getAuthStorage().setItem('activeChildId', String(childId));
};

export const getActiveChildId = () => {
  const value = localStorage.getItem('activeChildId') || sessionStorage.getItem('activeChildId');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const removeActiveChildId = () => {
  localStorage.removeItem('activeChildId');
  sessionStorage.removeItem('activeChildId');
};

// 3. Usuwanie tokena (wylogowanie)
export const removeToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  removeActiveChildId();
};

// 4. Gotowy nagłówek do Axios (używany w każdym zapytaniu)
export const getAuthHeaders = () => {
  const token = getToken();
  if (!token) return null;
  return { headers: { Authorization: `Token ${token}` } };
};

export const getAuthConfigWithActiveChild = () => {
  const config = getAuthHeaders() || {};
  const activeChildId = getActiveChildId();

  if (!activeChildId) return config;

  return {
    ...config,
    params: {
      ...(config.params || {}),
      child_id: activeChildId,
    },
  };
};