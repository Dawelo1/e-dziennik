// frontend/src/Layout.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Layout.css';
import beeLogo from '../assets/bee.png';
import { getToken, removeToken, getAuthHeaders } from '../authUtils';
import { getChatWebSocketUrl } from '../wsUtils';

// Ikony
import { 
  FaHome, FaEnvelope, FaUserSlash, FaCalendarAlt, FaCalendarDay, 
  FaUtensils, FaMoneyBillWave, FaCog, FaSignOutAlt, FaInfoCircle, FaImages
} from 'react-icons/fa';

const Layout = () => {
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY_MS = 1000;
  const MAX_RECONNECT_DELAY_MS = 30000;

  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationCounts, setNotificationCounts] = useState({
    schedule: 0,
    gallery: 0,
    calendar: 0,
    payments: 0,
  });

  const fetchNotificationSummary = useCallback(async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/users/notifications/summary/', getAuthHeaders());
      setNotificationCounts({
        schedule: Number(response.data.schedule) || 0,
        gallery: Number(response.data.gallery) || 0,
        calendar: Number(response.data.calendar) || 0,
        payments: Number(response.data.payments) || 0,
      });
    } catch (err) {
      console.error('Błąd pobierania powiadomień:', err);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/');
      return;
    }

    const config = getAuthHeaders();

    // 1. Pobierz dane usera
    axios.get('http://127.0.0.1:8000/api/users/me/', config)
      .then(response => setUser(response.data))
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/');
      });

    fetchNotificationSummary();

    const summaryInterval = setInterval(fetchNotificationSummary, 30000);
    const onNotificationsUpdated = () => fetchNotificationSummary();
    window.addEventListener('notifications-updated', onNotificationsUpdated);

    const wsUrl = getChatWebSocketUrl();
    if (!wsUrl) return;

    let shouldReconnect = true;
    let reconnectTimer = null;
    let socket = null;
    let reconnectAttempts = 0;

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'unread_count') {
            setUnreadCount(Number(data.count) || 0);
          }
          if (data.type === 'notification_summary_changed') {
            fetchNotificationSummary();
          }
        } catch (err) {
          console.error('Błąd parsowania WS (layout):', err);
        }
      };

      socket.onclose = () => {
        if (!shouldReconnect) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('WebSocket: osiągnięto limit prób reconnect (Layout).');
          return;
        }

        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * (2 ** reconnectAttempts),
          MAX_RECONNECT_DELAY_MS
        );
        reconnectAttempts += 1;

        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      clearInterval(summaryInterval);
      window.removeEventListener('notifications-updated', onNotificationsUpdated);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [navigate, fetchNotificationSummary]);

  // --- FUNKCJA NAPRAWIAJĄCA URL AVATARA ---
  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  const handleLogout = async () => {
    const token = getToken();
    
    // 1. Najpierw czyścimy lokalnie i przekierowujemy
    removeToken();
    navigate('/');

    // 2. Próbujemy powiadomić serwer (fire and forget)
    if (token) {
      try {
        await axios.post('http://127.0.0.1:8000/api/users/logout/', {}, {
          headers: { Authorization: `Token ${token}` }
        });
      } catch (error) { 
        console.log("Logout error (sesja mogła już wygasnąć)"); 
      }
    }
  };

  if (!user) return null;

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="top-header">
        <div className="header-logo-section">
          <img src={beeLogo} alt="Logo" className="header-logo" />
          <div className="header-title">
            <span>Przedszkole</span>
            <span>PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        <div className="header-user-section">
          <div className="info-section" onClick={() => navigate('/info')}>
            <FaInfoCircle style={{ marginRight: 8, fontSize: '16px', color: '#f2c94c' }} />
            Informacje
          </div>
          
          <div className="user-profile-static">
            <div className="user-avatar">
              {user.avatar ? (
                <img 
                  src={getAvatarUrl(user.avatar)} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                user.first_name ? user.first_name[0] : user.username[0].toUpperCase()
              )}
            </div>
            <div className="user-name-box">
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <span className="user-role">{user.is_director ? 'Dyrektor' : 'Rodzic'}</span>
            </div>
          </div>
          
          <div className="logout-icon-btn" onClick={handleLogout} title="Wyloguj się">
            <FaSignOutAlt />
          </div>
        </div>
      </header>

      {/* CONTENT + SIDEBAR */}
      <div className="content-wrapper">
        <aside className="sidebar-card">
          <ul className="sidebar-menu">
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaHome /></span> Główna
              </NavLink>
            </li>
            
            <li>
              <NavLink to="/messages" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaEnvelope /></span> 
                Wiadomości
                {unreadCount > 0 && <span className="menu-badge">{unreadCount}</span>}
              </NavLink>
            </li>

            {user.is_parent && (
              <li>
                <NavLink to="/attendance" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                  <span className="menu-icon"><FaUserSlash /></span> Nieobecność
                </NavLink>
              </li>
            )}

            <li>
              <NavLink to="/schedule" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarDay /></span> Zajęcia
                {notificationCounts.schedule > 0 && <span className="menu-badge">{notificationCounts.schedule}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink to="/gallery" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaImages /></span> Galeria
                {notificationCounts.gallery > 0 && <span className="menu-badge">{notificationCounts.gallery}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink to="/calendar" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarAlt /></span> Kalendarz
                {notificationCounts.calendar > 0 && <span className="menu-badge">{notificationCounts.calendar}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink to="/meals" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUtensils /></span> Jadłospis
              </NavLink>
            </li>

            {user.is_parent && (
              <li>
                <NavLink to="/payments" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                  <span className="menu-icon"><FaMoneyBillWave /></span> Płatności
                  {notificationCounts.payments > 0 && <span className="menu-badge">{notificationCounts.payments}</span>}
                </NavLink>
              </li>
            )}

            <li style={{ marginTop: 'auto' }}>
              <NavLink to="/settings" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCog /></span> Ustawienia Konta
              </NavLink>
            </li>
          </ul>
        </aside>

        <main className="main-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;