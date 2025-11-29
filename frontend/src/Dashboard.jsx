// frontend/src/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Style i ikony
import './Dashboard.css';
import { FaBullhorn, FaUserSlash, FaCalendarCheck } from 'react-icons/fa';

const Dashboard = () => {
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Token ${token}` } };

        // Pobieramy Posty (Tablica)
        const postsRes = await axios.get('http://127.0.0.1:8000/api/newsfeed/', config);
        
        // Pobieramy Wydarzenia (Limitujemy do 3 najbliższych)
        const eventsRes = await axios.get('http://127.0.0.1:8000/api/calendar/activities/', config);

        setPosts(postsRes.data);
        setEvents(eventsRes.data.slice(0, 3)); // Bierzemy tylko 3 pierwsze
      } catch (err) {
        console.error("Błąd pobierania danych:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div style={{padding: 20}}>Ładowanie pulpitu... 🐝</div>;

  return (
    <div className="dashboard-grid">
      
      {/* --- LEWA KOLUMNA: POSTY --- */}
      <div className="feed-column">
        <div className="section-header">
          <FaBullhorn /> Tablica Postów
        </div>

        {posts.length === 0 ? (
          <div className="post-card">
            <p>Brak nowych ogłoszeń.</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                {/* Statyczna ikona Dyrektora (lub litera P) */}
                <div className="post-avatar">P</div>
                <div className="post-author-info">
                  <h4>Dyrektor Przedszkola</h4>
                  <span className="post-date">{post.formatted_date}</span>
                </div>
              </div>

              <h3 style={{marginTop: 0, marginBottom: 10, color: '#333'}}>{post.title}</h3>
              <div className="post-content">
                {post.content}
              </div>

              {/* Jeśli post ma zdjęcie, wyświetl je */}
              {post.image && (
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="post-image" 
                />
              )}

              <div className="post-footer">
                <button className="action-btn">Lubię to</button>
                <button className="action-btn" style={{background: 'none', color: '#999'}}>Komentarze (0)</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- PRAWA KOLUMNA: WIDGETY --- */ }
      <div className="widgets-column">
        
        {/* Widget 1: Szybkie Działania */}
        <div className="widget-card">
          <div className="widget-title">Szybkie Działania</div>
          
          <div className="quick-action-item" onClick={() => navigate('/attendance')}>
            <div className="qa-icon">
              <FaUserSlash />
            </div>
            <div className="qa-text">
              <span>Zgłoś Nieobecność</span>
              <span>Dziecko chore? Kliknij tutaj.</span>
            </div>
          </div>

          <div className="quick-action-item" onClick={() => navigate('/messages')}>
            <div className="qa-icon" style={{backgroundColor: '#e3f2fd', color: '#2196f3'}}>
              <FaEnvelope />
            </div>
            <div className="qa-text">
              <span>Napisz do Dyrektora</span>
              <span>Masz pytanie?</span>
            </div>
          </div>
        </div>

        {/* Widget 2: Najbliższe Wydarzenia */}
        <div className="widget-card">
          <div className="widget-title">Najbliższe Wydarzenia</div>
          
          {events.length === 0 ? (
            <p style={{fontSize: 13, color: '#999'}}>Brak nadchodzących wydarzeń.</p>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="event-item">
                <h5>{ev.title}</h5>
                <div className="event-meta">
                  <FaCalendarCheck /> {ev.date} o {ev.start_time.slice(0,5)}
                </div>
              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
};

// Dodatkowy import, który zapomniałem na górze
import { FaEnvelope } from 'react-icons/fa';

export default Dashboard;