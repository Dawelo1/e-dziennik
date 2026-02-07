// frontend/src/authUtils.js

// 1. Pobieranie tokena (sprawdza oba magazyny)
export const getToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
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

// 3. Usuwanie tokena (wylogowanie)
export const removeToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

// 4. Gotowy nagłówek do Axios (używany w każdym zapytaniu)
export const getAuthHeaders = () => {
  const token = getToken();
  if (!token) return null;
  return { headers: { Authorization: `Token ${token}` } };
};