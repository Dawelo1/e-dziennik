import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Import stylów i obrazków
import './Layout.css';
import beeLogo from './assets/bee.png';

// Import ikon (FontAwesome)
import { 
  FaHome, 
  FaNewspaper, 
  FaEnvelope, 
  FaUserSlash, 
  FaCalendarAlt, 
  FaCalendarWeek,
  FaUtensils, 
  FaMoneyBillWave, 
  FaCog,
  FaSearch,
  FaSignOutAlt
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

  if (!user) return null; // lub spinner ładowania

  return (
    <div className="app-container">
      
      {/* --- GÓRNY PASEK (HEADER) --- */}
      <header className="top-header">
        <div className="header-logo-section">
          <img src={beeLogo} alt="Logo" className="header-logo" />
          <div className="header-title">
            <span>Przedszkole</span>
            <span>PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        <div className="header-user-section">
          <div className="search-bar">
            <FaSearch style={{ marginRight: 10 }} /> Szukaj...
          </div>
          
          <div className="user-profile" onClick={handleLogout} title="Kliknij, aby się wylogować">
            <div className="user-avatar">
              {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
            </div>
            <div className="user-name">
              {user.first_name} {user.last_name}
            </div>
            <FaSignOutAlt style={{ marginLeft: 10, color: '#d32f2f' }} />
          </div>
        </div>
      </header>

      {/* --- GŁÓWNA CZĘŚĆ (SIDEBAR + CONTENT) --- */}
      <div className="content-wrapper">
        
        {/* LEWY SIDEBAR (BIAŁA KARTA) */}
        <aside className="sidebar-card">
          <ul className="sidebar-menu">
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaHome /></span> Główna
              </NavLink>
            </li>
            
            <li>
              <NavLink to="/newsfeed" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaNewspaper /></span> Tablica Postów
              </NavLink>
            </li>

            <li>
              <NavLink to="/messages" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaEnvelope /></span> Wiadomości
              </NavLink>
            </li>

            {/* Tylko dla rodzica */}
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
                <span className="menu-icon"><FaCalendarWeek /></span> Harmonogram Tyg.
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

            <li style={{ marginTop: 'auto' }}> {/* Settings na dole */}
              <NavLink to="/settings" className={({ isActive }) => isActive ? "menu-link active" : "menu-link"}>
                <span className="menu-icon"><FaCog /></span> Ustawienia Konta
              </NavLink>
            </li>
          </ul>
        </aside>

        {/* PRAWY OBSZAR TREŚCI */}
        <main className="main-content-area">
          <Outlet /> {/* Tutaj wpadnie Dashboard, Jadłospis itd. */}
        </main>

      </div>
    </div>
  );
};

export default Layout;