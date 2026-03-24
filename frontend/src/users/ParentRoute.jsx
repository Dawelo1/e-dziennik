import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { getActiveChildId, getAuthHeaders, getToken, removeToken, setActiveChildId } from '../authUtils';
import LoadingScreen from './LoadingScreen';

const ParentRoute = () => {
  const [accessState, setAccessState] = useState('checking');

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setAccessState('unauthenticated');
      return;
    }

    axios
      .get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(async (res) => {
        const user = res.data;

        if (user.is_director) {
          setAccessState('director');
          return;
        }

        const hasAssignedChild = Array.isArray(user.child_groups) && user.child_groups.length > 0;
        if (user.is_parent && !hasAssignedChild) {
          removeToken();
          setAccessState('missing-child');
          return;
        }

        if (user.is_parent) {
          const childrenRes = await axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders());
          const children = Array.isArray(childrenRes.data) ? childrenRes.data : [];
          const activeChildId = getActiveChildId();
          const activeChildExists = children.some((child) => child.id === activeChildId);

          if (!activeChildExists && children.length > 0) {
            setActiveChildId(children[0].id);
          }
        }

        setAccessState('allowed');
      })
      .catch(() => {
        setAccessState('unauthenticated');
      });
  }, []);

  if (accessState === 'checking') {
    return <LoadingScreen message="Weryfikacja dostępu..." />;
  }

  if (accessState === 'allowed') {
    return <Outlet />;
  }

  if (accessState === 'director') {
    return <Navigate to="/director/dashboard" replace />;
  }

  if (accessState === 'missing-child') {
    return <Navigate to="/?reason=no-child" replace />;
  }

  return <Navigate to="/" replace />;
};

export default ParentRoute;
