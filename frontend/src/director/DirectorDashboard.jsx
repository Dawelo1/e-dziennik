// frontend/src/director/DirectorDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorDashboard.css'; // Nowy plik CSS
import LoadingScreen from '../users/LoadingScreen';
import { NavLink } from 'react-router-dom';

import { 
  FaChartLine, FaUserCheck, FaUserSlash, FaEnvelopeOpenText, FaPlus 
} from 'react-icons/fa';

const DirectorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/director/stats/', getAuthHeaders());
        setStats(res.data);
      } catch (err) {
        console.error("Błąd pobierania statystyk:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingScreen message="Wczytywanie pulpitu..." />;
  }

  return (
    <div className="director-container">
      <h2 className="page-title">
        <FaChartLine /> Pulpit Zarządczy
      </h2>
      
      {/* SIATKA STATYSTYK */}
      <div className="stats-grid">
        
        {/* 1. Obecni */}
        <NavLink to="/director/attendance" className="stat-card blue">
          <div className="stat-icon"><FaUserCheck /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.present_today} / {stats?.total_children}</span>
            <span className="stat-label">Dzieci Obecnych Dzisiaj</span>
          </div>
        </NavLink>
        
        {/* 2. Nieobecni */}
        <NavLink to="/director/attendance" className="stat-card orange">
          <div className="stat-icon"><FaUserSlash /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.absent_today}</span>
            <span className="stat-label">Zgłoszonych Nieobecności</span>
          </div>
        </NavLink>

        {/* 3. Wiadomości */}
        <NavLink to="/director/messages" className="stat-card red">
          <div className="stat-icon"><FaEnvelopeOpenText /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.unread_messages}</span>
            <span className="stat-label">Nowych Wiadomości</span>
          </div>
        </NavLink>

      </div>

      {/* SEKCJA SZYBKICH SKRÓTÓW */}
      <div className="quick-actions-section">
        <div className="page-title title" style={{border: 'none', paddingLeft: 0, marginBottom: 15}}>
          Szybkie Akcje
        </div>
        <div className="actions-grid">
          <NavLink to="/director/posts" className="action-card">
            <FaPlus/> Dodaj Ogłoszenie
          </NavLink>
          <NavLink to="/director/gallery" className="action-card">
            <FaPlus/> Dodaj Album
          </NavLink>
          <NavLink to="/director/messages" className="action-card">
            <FaEnvelopeOpenText/> Wyślij Wiadomość
          </NavLink>
        </div>
      </div>

    </div>
  );
};

export default DirectorDashboard;