// frontend/src/DirectorLayout.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders, removeToken } from '../authUtils';

import '../users/Layout.css'; // Użyjemy na razie tych samych stylów co u rodzica dla spójności
import beeLogo from '../assets/bee.png';

// Ikony
import { 
  FaChartLine,       // Pulpit
  FaBullhorn,        // Tablica
  FaEnvelope,        // Wiadomości
  FaUserSlash,       // Nieobecności
  FaChalkboardTeacher, // Zajęcia
  FaUtensils,        // Jadłospis
  FaImages,          // Galeria
  FaCalendarAlt,     // Kalendarz
  FaMoneyBillWave,   // Płatności
  FaLayerGroup,      // Grupy
  FaChild,           // Dzieci
  FaUsers,           // Użytkownicy
  FaCog,             // Ustawienia
  FaSignOutAlt,
  FaInfoCircle
} from 'react-icons/fa';

const DirectorLayout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // --- FUNKCJA NAPRAWIAJĄCA URL AVATARA ---
  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(response => setUser(response.data))
      .catch(() => {
        removeToken();
        navigate('/');
      });
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('http://127.0.0.1:8000/api/users/logout/', {}, getAuthHeaders());
    } catch (e) { console.log(e); }
    removeToken();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="app-container"> 
      {/* HEADER */}
      <header className="top-header" style={{ borderBottom: '3px solid #e0245e' }}> 
        {/* ^ Dodatkowy akcent kolorystyczny, żeby odróżnić panel dyrektora */}
        
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
              {user.avatar ? (
                <img 
                  src={getAvatarUrl(user.avatar)} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                user.first_name ? user.first_name[0] : 'D'
              )}
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

      {/* CONTENT + SIDEBAR */}
      <div className="content-wrapper">
        <aside className="sidebar-card">
          <ul className="sidebar-menu">
            
            {/* 1. Pulpit Zarządczy */}
            <li>
              <NavLink to="/director/dashboard" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaChartLine /></span> Pulpit
              </NavLink>
            </li>

            {/* 2. Tablica Postów */}
            <li>
              <NavLink to="/director/posts" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaBullhorn /></span> Ogłoszenia
              </NavLink>
            </li>

            {/* 3. Wiadomości */}
            <li>
              <NavLink to="/director/messages" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaEnvelope /></span> Wiadomości
              </NavLink>
            </li>

            {/* 4. Nieobecności */}
            <li>
              <NavLink to="/director/attendance" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUserSlash /></span> Nieobecności
              </NavLink>
            </li>

            {/* 5. Zajęcia */}
            <li>
              <NavLink to="/director/schedule" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaChalkboardTeacher /></span> Zajęcia
              </NavLink>
            </li>

            {/* 6. Jadłospis */}
            <li>
              <NavLink to="/director/menu" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUtensils /></span> Jadłospis
              </NavLink>
            </li>

            {/* 7. Galeria */}
            <li>
              <NavLink to="/director/gallery" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaImages /></span> Galeria
              </NavLink>
            </li>

            {/* 8. Kalendarz */}
            <li>
              <NavLink to="/director/calendar" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCalendarAlt /></span> Kalendarz
              </NavLink>
            </li>

            {/* 9. Płatności */}
            <li>
              <NavLink to="/director/payments" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaMoneyBillWave /></span> Płatności
              </NavLink>
            </li>

            <hr style={{border: '0', borderTop: '1px solid #eee', margin: '10px 20px'}}/>

            {/* 10. Grupy */}
            <li>
              <NavLink to="/director/groups" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaLayerGroup /></span> Grupy
              </NavLink>
            </li>

            {/* 11. Dzieci */}
            <li>
              <NavLink to="/director/children" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaChild /></span> Dzieci
              </NavLink>
            </li>

            {/* 12. Użytkownicy */}
            <li>
              <NavLink to="/director/users" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaUsers /></span> Użytkownicy
              </NavLink>
            </li>

            {/* 13. Ustawienia */}
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