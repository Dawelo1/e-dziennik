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
  FaCalendarDay, // Zmieniona ikona dla Planu Zajęć
  FaUtensils, 
  FaMoneyBillWave, 
  FaCog,
  FaSignOutAlt,
  FaInfoCircle
} from 'react-icons/fa';

const Layout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    axios.get('http://127.0.0.1:8000/api/users/me/', {
      headers: { Authorization: `Token ${token}` }
    })
    .then(response => setUser(response.data))
    .catch(() => {
      localStorage.removeItem('token');
      navigate('/');
    });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
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
          {/* Zastąpione pole wyszukiwania */}
          <div className="info-section" onClick={() => navigate('/info')}>
            <FaInfoCircle style={{ marginRight: 8, fontSize: '16px', color: '#f2c94c' }} />
            Informacje
          </div>
          
          {/* Statyczny profil (tylko wygląd) */}
          <div className="user-profile-static">
            <div className="user-avatar">
              {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
            </div>
            <div className="user-name-box">
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <span className="user-role">{user.is_director ? 'Administrator' : 'Rodzic'}</span>
            </div>
          </div>

          {/* Przycisk wylogowania (tylko ikona działa) */}
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
            
            {/* USUNIĘTO: Tablica Postów (będzie na dashboardzie) */}

            <li>
              <NavLink to="/messages" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaEnvelope /></span> Wiadomości
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

            {/* ZMIANA NAZWY: Plan Zajęć */}
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