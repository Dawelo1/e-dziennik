// frontend/src/Layout.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Layout.css';
import beeLogo from '../assets/bee.png';
import { getToken, removeToken, getAuthHeaders } from '../authUtils';

// Ikony
import { 
  FaHome, FaEnvelope, FaUserSlash, FaCalendarAlt, FaCalendarDay, 
  FaUtensils, FaMoneyBillWave, FaCog, FaSignOutAlt, FaInfoCircle, FaImages
} from 'react-icons/fa';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

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

    // 2. Funkcja pobierająca licznik powiadomień
    const fetchUnread = () => {
      // Jeśli użytkownik jest na stronie wiadomości, nie pobieraj licznika (zakładamy 0)
      if (location.pathname === '/messages') {
        setUnreadCount(0);
        return;
      }

      axios.get('http://127.0.0.1:8000/api/communication/messages/unread_count/', config)
        .then(res => setUnreadCount(res.data.count))
        .catch(err => console.error("Błąd licznika:", err));
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);

    return () => clearInterval(interval);
  }, [navigate, location.pathname]);

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
              </NavLink>
            </li>

            <li>
              <NavLink to="/gallery" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaImages /></span> Galeria
              </NavLink>
            </li>

            <li>
              <NavLink to="/calendar" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarAlt /></span> Kalendarz
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