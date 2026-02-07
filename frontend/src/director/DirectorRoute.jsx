// frontend/src/DirectorRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import LoadingScreen from '../users/LoadingScreen';

const DirectorRoute = () => {
  const [isDirector, setIsDirector] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sprawdzamy uprawnienia w API
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => {
        setIsDirector(res.data.is_director);
      })
      .catch(() => {
        setIsDirector(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen message="Weryfikacja uprawnień..." />;

  // Jeśli jest dyrektorem -> Pokaż panel dyrektora (Outlet)
  // Jeśli nie -> Wyrzuć do panelu rodzica
  return isDirector ? <Outlet /> : <Navigate to="/dashboard" />;
};

export default DirectorRoute;