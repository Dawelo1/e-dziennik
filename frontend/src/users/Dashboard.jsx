import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from '../authUtils';
import { 
  FaBullhorn, 
  FaUserSlash, 
  FaCalendarCheck, 
  FaEnvelope,
  FaThumbsUp,
  FaRegThumbsUp,
  FaPaperPlane,
  FaRegCommentDots,
  FaMoneyBillWave, 
  FaExclamationCircle 
} 
from 'react-icons/fa';


const Dashboard = () => {
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});

  const navigate = useNavigate();

  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  const fetchData = async () => {
    try {
      const [postsRes, eventsRes, paymentsRes, userRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/newsfeed/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/calendar/activities/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/payments/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      ]);

      setPosts(postsRes.data.map(post => ({
        ...post,
        comments: (Array.isArray(post.comments) ? post.comments : []).map(comment => ({
          ...comment,
          likes_count: comment.likes_count ?? 0,
          is_liked_by_user: Boolean(comment.is_liked_by_user),
        })),
        likes_count: post.likes_count ?? 0,
        is_liked_by_user: Boolean(post.is_liked_by_user),
      })));
      setEvents(eventsRes.data);
      setPayments(paymentsRes.data);
      setCurrentUser(userRes.data); 
    } catch (err) {
      console.error("Błąd pobierania danych:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 5000); 
    return () => clearInterval(intervalId);
  }, []);

  const getWidgetItems = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    let widgetItems = [];

    events.forEach(ev => {
      const eventDate = new Date(ev.date);
      if (eventDate >= today && eventDate <= nextWeek) {
        widgetItems.push({
          id: `ev-${ev.id}`,
          type: 'event',
          title: ev.title,
          subtitle: '',
          dateObj: eventDate,
          displayDate: `${ev.date} o ${ev.start_time.slice(0,5)}`,
          isOverdue: false
        });
      }
    });

    payments.forEach(pay => {
      if (!pay.is_paid) {
        const createDate = new Date(pay.created_at);
        const dueDate = new Date(createDate);
        dueDate.setDate(createDate.getDate() + 14);
        const isOverdue = today > dueDate;

        widgetItems.push({
          id: `pay-${pay.id}`,
          type: 'payment',
          title: `Opłata: ${pay.amount} zł`,
          subtitle: pay.description,
          dateObj: createDate, 
          displayDate: isOverdue ? 'TERMIN MINĄŁ!' : 'Do zapłaty',
          isOverdue: isOverdue
        });
      }
    });

    widgetItems.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.dateObj - b.dateObj;
    });

    return widgetItems;
  };

  const widgetData = getWidgetItems();

  // --- LAJKOWANIE POSTA ---
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

const handleLikeComment = async (postId, commentId) => {
    // 1. Optymistyczna aktualizacja UI (dzieje się natychmiast)
    setPosts(currentPosts => currentPosts.map(post => {
      // Szukamy odpowiedniego posta
      if (post.id === postId) {
        // Mapujemy komentarze wewnątrz tego posta
        const updatedComments = post.comments.map(comment => {
          // Szukamy odpowiedniego komentarza
          if (comment.id === commentId) {
            const isLikedNow = !comment.is_liked_by_user; // Odwracamy stan
            
            return {
              ...comment,
              is_liked_by_user: isLikedNow,
              // Jeśli teraz polubiliśmy -> zwiększ licznik, jeśli odlubiliśmy -> zmniejsz
              likes_count: isLikedNow ? comment.likes_count + 1 : comment.likes_count - 1
            };
          }
          return comment;
        });
        
        // Zwracamy post ze zaktualizowaną listą komentarzy
        return { ...post, comments: updatedComments };
      }
      return post;
    }));

    // 2. Wysłanie żądania do API w tle
    try {
      await axios.post(`http://127.0.0.1:8000/api/comments/${commentId}/like/`, {}, getAuthHeaders());
    } catch (err) {
      console.error("Błąd lajkowania komentarza:", err);
      // Opcjonalnie: Tu można dodać logikę cofania zmian w razie błędu serwera
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

      const newComment = res.data;
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, newComment]
          };
        }
        return post;
      }));

      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error("Błąd dodawania komentarza:", err);
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  if (loading) return <LoadingScreen message="Wczytywanie pulpitu..." />;

  return (
    <div className="dashboard-container">
      <h2 className="page-title"><FaBullhorn /> Tablica Postów</h2>

      <div className="dashboard-grid">
        <div className="feed-column">
          {posts.length === 0 ? (
            <div className="post-card"><p style={{ color: '#333' }}>Brak nowych ogłoszeń.</p></div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <div className="post-avatar">P</div>
                  <div className="post-author-info">
                    <h4>Dyrektor Przedszkola</h4>
                    <span className="post-date">{post.formatted_date}</span>
                  </div>
                </div>

                <h3 style={{ marginTop: 0, marginBottom: 10, color: '#333' }}>{post.title}</h3>
                <div className="post-content">{post.content}</div>
                {post.image && <img src={post.image} alt={post.title} className="post-image" />}

                <div className="post-actions-bar">
                  <button className="action-btn comment-btn" onClick={() => toggleComments(post.id)}>
                    <FaRegCommentDots /> <span>{expandedComments[post.id] ? 'Ukryj' : 'Komentarze'} ({post.comments.length})</span>
                  </button>
                  <button className={`action-btn like-btn ${post.is_liked_by_user ? 'liked' : ''}`} onClick={() => handleLike(post.id)}>
                    {post.is_liked_by_user ? <FaThumbsUp color="#2196f3" /> : <FaRegThumbsUp />} <span>{post.likes_count || 'Lubię to'}</span>
                    <span className="like-tooltip">
                      {post.likes_count > 0 ? (
                        (() => {
                          const names = Array.isArray(post.likers_names) ? post.likers_names : [];
                          const shown = names.slice(0, 5);
                          const remaining = Math.max(0, names.length - shown.length);
                          return (
                            <>
                              {shown.map((n, i) => (
                                <div className="like-tooltip-item" key={`${n}-${i}`}>{n}</div>
                              ))}
                              {remaining > 0 && (
                                <div className="like-tooltip-item">i {remaining} innych</div>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        'Nikt jeszcze nie polubił'
                      )}
                    </span>
                  </button>
                </div>

                {expandedComments[post.id] ? (
                  <div className="comments-section-wrapper">
                    {post.comments && post.comments.length > 0 ? (
                      <div className="comments-list">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="comment-block">
                             <div className="comment-row">
                                <div className="comment-avatar-container">
                                  {comment.author_avatar ? (
                                    <img src={getAvatarUrl(comment.author_avatar)} alt="Avatar" />
                                  ) : (
                                    <div className="comment-avatar-placeholder">
                                      {comment.author_name ? comment.author_name[0].toUpperCase() : 'U'}
                                    </div>
                                  )}
                                </div>
                                <div className="comment-bubble">
                                  <span className="comment-author">{comment.author_name}</span>
                                  <span className="comment-text">{comment.content}</span>
                                </div>
                             </div>
                             
                             <div className="comment-actions">
  {/* Przycisk tekstowy "Lubię to!" */}
  <span 
    className={`comment-like-link ${comment.is_liked_by_user ? 'liked' : ''}`}
    onClick={() => handleLikeComment(post.id, comment.id)}
  >
    Lubię to!
  </span>

  {/* Licznik (pokazuje się tylko, gdy jest > 0) */}
  {comment.likes_count > 0 && (
    <span className="comment-likes-count">
      {/* Mała ikonka przy liczniku */}
      <div className="tiny-like-icon">
        <FaThumbsUp size={8} color="#fff"/>
      </div> 
      {comment.likes_count}
    </span>
  )}
  
  {/* Opcjonalnie: Data komentarza (np. "2 min") */}
  <span className="comment-date">
     · {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
  </span>
</div>

                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-comments-text">Brak komentarzy. Bądź pierwszy!</p>
                    )}

                    <div className="comment-input-area">
                      <div className="comment-my-avatar">
                        {currentUser && currentUser.avatar ? (
                          <img src={getAvatarUrl(currentUser.avatar)} alt="Me" />
                        ) : (
                          <div className="comment-avatar-placeholder">
                            {currentUser && currentUser.first_name ? currentUser.first_name[0] : 'U'}
                          </div>
                        )}
                      </div>
                      <input
                        type="text" placeholder="Napisz komentarz..." className="styled-comment-input"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => handleCommentChange(post.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                      />
                      <button className="send-comment-btn" onClick={() => handleAddComment(post.id)}><FaPaperPlane /></button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Prawa strona - widgety (bez zmian) */}
        <div className="widgets-column">
          {/* ... skopiuj zawartość z poprzedniego pliku, bo tu się nic nie zmienia ... */}
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
            <div className="widget-title">Najbliższe i Ważne Wydarzenia</div>
            {widgetData.length === 0 ? <p style={{fontSize: 13, color: '#999'}}>Brak nadchodzących wydarzeń.</p> : 
              widgetData.map(item => (
                <div key={item.id} className={`event-item ${item.type === 'payment' ? 'payment-type' : 'event-type'} ${item.isOverdue ? 'overdue' : ''}`}
                  onClick={() => item.type === 'payment' && navigate('/payments')}
                  style={{ cursor: item.type === 'payment' ? 'pointer' : 'default' }}>
                  <div className="event-icon-box">
                      {item.type === 'event' && <FaCalendarCheck />}
                      {item.type === 'payment' && !item.isOverdue && <FaMoneyBillWave />}
                      {item.type === 'payment' && item.isOverdue && <FaExclamationCircle />}
                  </div>
                  <div className="event-details">
                      <h5>{item.title}</h5>
                      {item.subtitle && <span className="event-subtitle">{item.subtitle}</span>}
                      <div className="event-meta">{item.displayDate}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;