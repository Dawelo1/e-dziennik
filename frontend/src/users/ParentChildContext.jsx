import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';

const ACTIVE_CHILD_STORAGE_KEY = 'activeChildId';

const ParentChildContext = createContext(null);

export const ParentChildProvider = ({ children }) => {
  const [childrenList, setChildrenList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const selectChild = useCallback((childId) => {
    const normalized = Number(childId);
    if (!normalized) {
      setSelectedChildId(null);
      localStorage.removeItem(ACTIVE_CHILD_STORAGE_KEY);
      return;
    }

    setSelectedChildId(normalized);
    localStorage.setItem(ACTIVE_CHILD_STORAGE_KEY, String(normalized));
  }, []);

  const refreshChildren = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const response = await axios.get('/api/children/', getAuthHeaders());
      const nextChildren = Array.isArray(response.data) ? response.data : [];
      setChildrenList(nextChildren);

      if (nextChildren.length === 0) {
        setSelectedChildId(null);
        localStorage.removeItem(ACTIVE_CHILD_STORAGE_KEY);
        return;
      }

      const persistedId = Number(localStorage.getItem(ACTIVE_CHILD_STORAGE_KEY));
      const persistedExists = nextChildren.some((child) => child.id === persistedId);

      if (nextChildren.length === 1) {
        const onlyChildId = nextChildren[0].id;
        setSelectedChildId(onlyChildId);
        localStorage.setItem(ACTIVE_CHILD_STORAGE_KEY, String(onlyChildId));
        return;
      }

      if (persistedExists) {
        setSelectedChildId(persistedId);
        return;
      }

      setSelectedChildId(null);
      localStorage.removeItem(ACTIVE_CHILD_STORAGE_KEY);
    } catch (err) {
      console.error('Blad pobierania listy dzieci:', err);
      setChildrenList([]);
      setSelectedChildId(null);
    } finally {
      setLoadingChildren(false);
    }
  }, []);

  useEffect(() => {
    refreshChildren();
  }, [refreshChildren]);

  const selectedChild = useMemo(
    () => childrenList.find((child) => child.id === selectedChildId) || null,
    [childrenList, selectedChildId]
  );

  const value = useMemo(() => ({
    children: childrenList,
    selectedChild,
    selectedChildId,
    selectChild,
    loadingChildren,
    refreshChildren,
    hasMultipleChildren: childrenList.length > 1,
  }), [childrenList, selectedChild, selectedChildId, selectChild, loadingChildren, refreshChildren]);

  return <ParentChildContext.Provider value={value}>{children}</ParentChildContext.Provider>;
};

export const useParentChild = () => {
  const context = useContext(ParentChildContext);
  if (!context) {
    throw new Error('useParentChild must be used inside ParentChildProvider');
  }
  return context;
};
