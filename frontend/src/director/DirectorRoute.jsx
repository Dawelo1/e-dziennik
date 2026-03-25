// frontend/src/DirectorRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import LoadingScreen from '../users/LoadingScreen';

const TEACHER_ALLOWED_PATHS = [
  '/director/posts',
  '/director/gallery',
  '/director/calendar',
  '/director/schedule',
];

const DirectorRoute = () => {
  const location = useLocation();
  const [isDirector, setIsDirector] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sprawdzamy uprawnienia w API
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => {
        setIsDirector(Boolean(res.data.is_director));
        setIsTeacher(Boolean(res.data.is_teacher));
      })
      .catch(() => {
        setIsDirector(false);
        setIsTeacher(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen message="Weryfikacja uprawnień..." />;

  if (isDirector) {
    return <Outlet />;
  }

  if (isTeacher) {
    const isAllowedPath = TEACHER_ALLOWED_PATHS.some((path) => location.pathname.startsWith(path));
    if (isAllowedPath) {
      return <Outlet />;
    }
    return <Navigate to="/director/posts" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export default DirectorRoute;