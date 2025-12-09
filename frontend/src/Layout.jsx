// frontend/src/Layout.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';

import './Layout.css';
import beeLogo from './assets/bee.png';

// Ikony
import { 
  FaHome, 
  FaEnvelope, 
  FaUserSlash, 
  FaCalendarAlt, 
  FaCalendarDay, 
  FaUtensils, 
  FaMoneyBillWave, 
  FaCog,
  FaSignOutAlt,
  FaInfoCircle
} from 'react-icons/fa';

const Layout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // NOWY STAN: Licznik nieprzeczytanych wiadomości
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const config = { headers: { Authorization: `Token ${token}` } };

    // 1. Pobierz dane użytkownika
    axios.get('http://127.0.0.1:8000/api/users/me/', config)
      .then(response => setUser(response.data))
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/');
      });

    // 2. NOWOŚĆ: Funkcja pobierająca licznik nieprzeczytanych wiadomości
    const fetchUnread = () => {
      axios.get('http://127.0.0.1:8000/api/communication/messages/unread_count/', config)
        .then(res => setUnreadCount(res.data.count))
        .catch(err => console.error("Błąd pobierania licznika:", err));
    };

    // Wywołaj raz od razu
    fetchUnread();

    // Ustaw interwał odświeżania (co 5 sekund)
    const interval = setInterval(fetchUnread, 5000);

    // Sprzątanie po odmontowaniu
    return () => clearInterval(interval);

  }, [navigate]);

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    
    // 1. Usuwamy token lokalnie
    localStorage.removeItem('token');
    
    // 2. Przekierowujemy
    navigate('/');
    
    // 3. Wylogowujemy z backendu
    if (token) {
      try {
        await axios.post('http://127.0.0.1:8000/api/users/logout/', {}, {
          headers: { Authorization: `Token ${token}` }
        });
      } catch (error) {
        console.log("Sesja wygasła lub błąd wylogowania.");
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
              {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
            </div>
            <div className="user-name-box">
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <span className="user-role">{user.is_director ? 'Administrator' : 'Rodzic'}</span>
            </div>
          </div>

          <div 
            className="logout-icon-btn" 
            onClick={handleLogout} 
            title="Wyloguj się"
          >
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
                {/* --- NOWOŚĆ: Wyświetlanie Badge'a --- */}
                {unreadCount > 0 && (
                  <span className="menu-badge">{unreadCount}</span>
                )}
              </NavLink>
            </li>

            {user.is_parent && (
              <li>
                <NavLink to="/attendance" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                  <span className="menu-icon"><FaUserSlash /></span> Zgłoś Nieobecność
                </NavLink>
              </li>
            )}

            <li>
              <NavLink to="/calendar" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarAlt /></span> Harmonogram Roczny
              </NavLink>
            </li>

            <li>
              <NavLink to="/schedule" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarDay /></span> Plan Zajęć
              </NavLink>
            </li>

            <li>
              <NavLink to="/menu" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
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