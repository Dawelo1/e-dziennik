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
  FaHeart,      
  FaRegHeart,   
  FaPaperPlane,
  FaRegCommentDots // <--- Nowa ikona do przycisku komentarzy
} from 'react-icons/fa';

const Dashboard = () => {
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState({});
  
  // NOWY STAN: Przechowuje informację, czy komentarze dla danego posta są rozwinięte
  // np. { 1: true, 5: false }
  const [expandedComments, setExpandedComments] = useState({});

  const navigate = useNavigate();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

 const fetchData = async () => {
    try {
      // Nie ustawiamy setLoading(true) tutaj, żeby ekran nie migał co 5 sekund!
      // Loading jest tylko przy pierwszym wejściu (inicjalnie true w useState)
      
      const postsRes = await axios.get('http://127.0.0.1:8000/api/newsfeed/', getAuthHeaders());
      const eventsRes = await axios.get('http://127.0.0.1:8000/api/calendar/activities/', getAuthHeaders());

      // React jest sprytny: jeśli dane są takie same, nie przerysuje ekranu (nie będzie mrugać)
      setPosts(postsRes.data);
      setEvents(eventsRes.data.slice(0, 3)); 
    } catch (err) {
      console.error("Błąd pobierania danych:", err);
    } finally {
      setLoading(false); // Wyłączamy loading po pierwszym pobraniu
    }
  };

  useEffect(() => {
    // 1. Pobierz dane natychmiast po wejściu na stronę
    fetchData();

    // 2. Ustaw "budzik", który będzie pobierał dane co 5000 ms (5 sekund)
    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);

    // 3. Sprzątanie: Gdy użytkownik wyjdzie ze strony, wyłącz "budzik"
    return () => clearInterval(intervalId);
  }, []); // Pusta tablica = uruchom tylko przy montowaniu komponentu

  const handleLike = async (postId) => {
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

    try {
      await axios.post(`http://127.0.0.1:8000/api/newsfeed/${postId}/like/`, {}, getAuthHeaders());
    } catch (err) {
      console.error("Błąd lajkowania:", err);
    }
  };

  const handleCommentChange = (postId, text) => {
    setCommentInputs(prev => ({ ...prev, [postId]: text }));
  };

  const handleAddComment = async (postId) => {
    const content = commentInputs[postId];
    if (!content || content.trim() === '') return;

    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/api/newsfeed/${postId}/comment/`, 
        { content: content }, 
        getAuthHeaders()
      );

      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, newComment]
          };
        }
        return post;
      }));

      // Wyczyść pole i upewnij się, że sekcja jest otwarta
      const newComment = res.data;
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));

    } catch (err) {
      console.error("Błąd dodawania komentarza:", err);
    }
  };

  // NOWA FUNKCJA: Przełączanie widoczności komentarzy
  const toggleComments = (postId) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId] // Odwracamy wartość (true/false)
    }));
  };

  if (loading) return <div style={{padding: 20}}>Ładowanie pulpitu... 🐝</div>;

  return (
    <div className="dashboard-grid">
      
      <div className="feed-column">
        <div className="section-header">
          <FaBullhorn /> Tablica Postów
        </div>

        {posts.length === 0 ? (
          <div className="post-card"><p style={{color: '#333'}}>Brak nowych ogłoszeń.</p></div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="post-card">
              
              <div className="post-header">
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

              {post.image && (
                <img src={post.image} alt={post.title} className="post-image" />
              )}

              {/* --- PASEK AKCJI (ZMIENIONY UKŁAD) --- */}
              <div className="post-actions-bar">
                
                {/* PRZYCISK 1 (LEWO): Pokaż/Ukryj Komentarze */}
                <button 
                  className="action-btn comment-btn" 
                  onClick={() => toggleComments(post.id)}
                >
                  <FaRegCommentDots />
                  <span>Komentarze ({post.comments.length})</span>
                </button>

                {/* PRZYCISK 2 (PRAWO): Lubię to */}
                <button 
                  className={`action-btn like-btn ${post.is_liked_by_user ? 'liked' : ''}`} 
                  onClick={() => handleLike(post.id)}
                >
                  {post.is_liked_by_user ? <FaHeart color="#e0245e" /> : <FaRegHeart />}
                  <span>{post.likes_count > 0 ? post.likes_count : 'Lubię to'}</span>
                </button>

              </div>

              {/* --- SEKCJA KOMENTARZY (WARUNKOWA WIDOCZNOŚĆ) --- */}
              {expandedComments[post.id] && (
                <div className="comments-section-wrapper">
                  
                  {/* Lista komentarzy */}
                  {post.comments && post.comments.length > 0 ? (
                    <div className="comments-list">
                      {post.comments.map(comment => (
                        <div key={comment.id} className="comment-item">
                          <div className="comment-author">{comment.author_name}</div>
                          <div className="comment-text">{comment.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-comments-text">Brak komentarzy. Bądź pierwszy!</p>
                  )}

                  {/* Formularz wpisywania (Ładniejszy) */}
                  <div className="comment-input-area">
                    <input 
                      type="text" 
                      placeholder="Napisz komentarz..." 
                      className="styled-comment-input"
                      value={commentInputs[post.id] || ''}
                      onChange={(e) => handleCommentChange(post.id, e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(post.id); }}
                    />
                    <button 
                      className="send-comment-btn"
                      onClick={() => handleAddComment(post.id)}
                    >
                      <FaPaperPlane />
                    </button>
                  </div>
                </div>
              )}

            </div>
          ))
        )}
      </div>

      <div className="widgets-column">
        {/* ... (Widgety bez zmian) ... */}
        <div className="widget-card">
          <div className="widget-title">Szybkie Działania</div>
          <div className="quick-action-item" onClick={() => navigate('/attendance')}>
            <div className="qa-icon"><FaUserSlash /></div>
            <div className="qa-text"><span>Zgłoś Nieobecność</span><span>Dziecko chore? Kliknij tutaj.</span></div>
          </div>
          <div className="quick-action-item" onClick={() => navigate('/messages')}>
            <div className="qa-icon" style={{backgroundColor: '#e3f2fd', color: '#2196f3'}}><FaEnvelope /></div>
            <div className="qa-text"><span>Napisz do Dyrektora</span><span>Masz pytanie?</span></div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-title">Najbliższe Wydarzenia</div>
          {events.length === 0 ? (
            <p style={{fontSize: 13, color: '#999'}}>Brak nadchodzących wydarzeń.</p>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="event-item">
                <h5>{ev.title}</h5>
                <div className="event-meta"><FaCalendarCheck /> {ev.date} o {ev.start_time.slice(0,5)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;