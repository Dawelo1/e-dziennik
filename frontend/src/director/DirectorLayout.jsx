// frontend/src/DirectorLayout.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders, removeToken } from '../authUtils';

import '../users/Layout.css'; // Używamy stylów Layout (tam jest zdefiniowany .menu-badge)
import beeLogo from '../assets/bee.png';

// Ikony
import { 
  FaChartLine, FaBullhorn, FaEnvelope, FaUserSlash, FaChalkboardTeacher, 
  FaUtensils, FaImages, FaCalendarAlt, FaMoneyBillWave, FaLayerGroup, 
  FaChild, FaUsers, FaCog, FaSignOutAlt
} from 'react-icons/fa';

const DirectorLayout = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Potrzebne do sprawdzania, gdzie jesteśmy
  const [user, setUser] = useState(null);
  
  // --- STAN POWIADOMIEŃ ---
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // 1. Sprawdzenie usera
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(response => setUser(response.data))
      .catch(() => {
        removeToken();
        navigate('/');
      });

    // 2. Funkcja pobierająca licznik
    const fetchUnread = () => {
      // Jeśli jesteśmy w wiadomościach, resetujemy licznik lokalnie i nie pytamy
      if (location.pathname === '/director/messages') {
        setUnreadCount(0);
        return;
      }

      axios.get('http://127.0.0.1:8000/api/communication/messages/unread_count/', getAuthHeaders())
        .then(res => setUnreadCount(res.data.count))
        .catch(err => console.error("Błąd licznika:", err));
    };

    // Pobierz raz natychmiast
    fetchUnread();
    
    // Ustaw interwał co 5 sekund
    const interval = setInterval(fetchUnread, 5000);

    return () => clearInterval(interval);
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    try {
      await axios.post('http://127.0.0.1:8000/api/users/logout/', {}, getAuthHeaders());
    } catch (e) { console.log(e); }
    removeToken();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="app-container director-theme"> 
      <header className="top-header" style={{ borderBottom: '3px solid #e0245e' }}> 
        <div className="header-logo-section">
          <img src={beeLogo} alt="Logo" className="header-logo" />
          <div className="header-title">
            <span>Panel Dyrektora</span>
            <span>PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        <div className="header-user-section">
           <div className="user-profile-static">
            <div className="user-avatar" style={{backgroundColor: '#e0245e'}}>
               {user.first_name ? user.first_name[0] : 'D'}
            </div>
            <div className="user-name-box">
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
          <div className="logout-icon-btn" onClick={handleLogout} title="Wyloguj się">
            <FaSignOutAlt />
          </div>
        </div>
      </header>

      <div className="content-wrapper">
        <aside className="sidebar-card">
          <ul className="sidebar-menu">
            
            <li>
              <NavLink to="/director/dashboard" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaChartLine /></span> Pulpit
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/posts" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaBullhorn /></span> Ogłoszenia
              </NavLink>
            </li>

            {/* --- ZAKŁADKA WIADOMOŚCI Z LICZNIKIEM --- */}
            <li>
              <NavLink to="/director/messages" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaEnvelope /></span> 
                Wiadomości
                
                {/* Wyświetl kropkę tylko, jeśli jest coś nowego */}
                {unreadCount > 0 && (
                   <span className="menu-badge">{unreadCount}</span>
                )}
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/attendance" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUserSlash /></span> Nieobecności
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/schedule" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaChalkboardTeacher /></span> Zajęcia
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/menu" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUtensils /></span> Jadłospis
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/gallery" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaImages /></span> Galeria
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/calendar" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarAlt /></span> Kalendarz
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/payments" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaMoneyBillWave /></span> Płatności
              </NavLink>
            </li>

            <hr style={{border: '0', borderTop: '1px solid #eee', margin: '10px 20px'}}/>

            <li>
              <NavLink to="/director/groups" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaLayerGroup /></span> Grupy
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/children" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaChild /></span> Dzieci
              </NavLink>
            </li>

            <li>
              <NavLink to="/director/users" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUsers /></span> Użytkownicy
              </NavLink>
            </li>

            <li style={{ marginTop: 'auto' }}>
              <NavLink to="/director/settings" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCog /></span> Ustawienia
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

export default DirectorLayout;