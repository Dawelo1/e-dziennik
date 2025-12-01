// frontend/src/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Style i ikony
import './Dashboard.css';
import { 
  FaBullhorn, 
  FaUserSlash, 
  FaCalendarCheck, 
  FaEnvelope,
  FaHeart,      // Pełne serce
  FaRegHeart,   // Puste serce
  FaPaperPlane  // Ikona wysyłania
} from 'react-icons/fa';

const Dashboard = () => {
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Stan do przechowywania treści komentarzy dla poszczególnych postów
  // Klucz to ID posta, wartość to wpisany tekst: { 1: "Super!", 5: "Dzięki" }
  const [commentInputs, setCommentInputs] = useState({});

  const navigate = useNavigate();

  // Pomocnicza funkcja do nagłówków
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Pobieramy Posty (Tablica)
        const postsRes = await axios.get('http://127.0.0.1:8000/api/newsfeed/', getAuthHeaders());
        
        // Pobieramy Wydarzenia (Limitujemy do 3 najbliższych)
        const eventsRes = await axios.get('http://127.0.0.1:8000/api/calendar/activities/', getAuthHeaders());

        setPosts(postsRes.data);
        setEvents(eventsRes.data.slice(0, 3)); 
      } catch (err) {
        console.error("Błąd pobierania danych:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- OBSŁUGA LAJKÓW ---
  const handleLike = async (postId) => {
    // 1. Optymistyczna aktualizacja UI (żeby użytkownik nie czekał)
    setPosts(currentPosts => currentPosts.map(post => {
      if (post.id === postId) {
        const isLiked = post.is_liked_by_user;
        return {
          ...post,
          is_liked_by_user: !isLiked,
          likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1
        };
      }
      return post;
    }));

    // 2. Wysłanie żądania do API w tle
    try {
      await axios.post(`http://127.0.0.1:8000/api/newsfeed/${postId}/like/`, {}, getAuthHeaders());
    } catch (err) {
      console.error("Błąd lajkowania:", err);
      // Opcjonalnie: Cofnij zmiany w UI w przypadku błędu
    }
  };

  // --- OBSŁUGA PISANIA KOMENTARZA ---
  const handleCommentChange = (postId, text) => {
    setCommentInputs(prev => ({ ...prev, [postId]: text }));
  };

  const handleAddComment = async (postId) => {
    const content = commentInputs[postId];
    if (!content || content.trim() === '') return;

    try {
      // Wyślij do API
      const res = await axios.post(
        `http://127.0.0.1:8000/api/newsfeed/${postId}/comment/`, 
        { content: content }, 
        getAuthHeaders()
      );

      // Dodaj nowy komentarz do listy w stanie (bez odświeżania strony)
      const newComment = res.data;
      
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, newComment] // Doklejamy nowy na koniec
          };
        }
        return post;
      }));

      // Wyczyść pole tekstowe
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));

    } catch (err) {
      console.error("Błąd dodawania komentarza:", err);
      alert("Nie udało się dodać komentarza.");
    }
  };

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
              
              {/* Nagłówek posta */}
              <div className="post-header">
                <div className="post-avatar">P</div>
                <div className="post-author-info">
                  <h4>Dyrektor Przedszkola</h4>
                  <span className="post-date">{post.formatted_date}</span>
                </div>
              </div>

              {/* Treść */}
              <h3 style={{marginTop: 0, marginBottom: 10, color: '#333'}}>{post.title}</h3>
              <div className="post-content">
                {post.content}
              </div>

              {/* Zdjęcie */}
              {post.image && (
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="post-image" 
                />
              )}

              {/* Pasek akcji (Lajki) */}
              <div className="post-actions">
                <button 
                  className={`action-btn ${post.is_liked_by_user ? 'liked' : ''}`} 
                  onClick={() => handleLike(post.id)}
                >
                  {post.is_liked_by_user ? <FaHeart color="#e0245e" /> : <FaRegHeart />}
                  <span style={{ marginLeft: 5 }}>
                    {post.likes_count > 0 ? post.likes_count : 'Lubię to'}
                  </span>
                </button>
              </div>

              {/* Sekcja Komentarzy */}
              <div className="comments-section">
                {/* Lista istniejących komentarzy */}
                {post.comments && post.comments.length > 0 && (
                  <div className="comments-list">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="comment-item">
                        <strong>{comment.author_name}: </strong>
                        <span>{comment.content}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formularz dodawania komentarza */}
                <div className="comment-input-box">
                  <input 
                    type="text" 
                    placeholder="Napisz komentarz..." 
                    value={commentInputs[post.id] || ''}
                    onChange={(e) => handleCommentChange(post.id, e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(post.id); }}
                  />
                  <button onClick={() => handleAddComment(post.id)}>
                    <FaPaperPlane />
                  </button>
                </div>
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

export default Dashboard;