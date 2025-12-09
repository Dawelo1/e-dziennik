// frontend/src/Messages.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Messages.css';
import { FaPaperPlane, FaUserTie, FaEnvelope } from 'react-icons/fa'; // Dodano FaEnvelope do tytułu

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isDirectorOnline, setIsDirectorOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => setCurrentUser(res.data))
      .catch(err => console.error(err));
  }, []);

  const fetchData = async () => {
    try {
      const [msgRes, statusRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/communication/messages/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/director-status/', getAuthHeaders())
      ]);

      const sorted = msgRes.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(sorted);
      setIsDirectorOnline(statusRes.data.is_online);
    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await axios.post('http://127.0.0.1:8000/api/communication/messages/', {
        body: newMessage,
        subject: 'Czat' 
      }, getAuthHeaders());

      setNewMessage('');
      fetchData();
    } catch (err) {
      console.error("Błąd wysyłania:", err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading || !currentUser) return <div style={{padding: 20}}>Ładowanie czatu... 🐝</div>;

  return (
    // 1. GŁÓWNY KONTENER (Zgodny z Schedule/Settings)
    <div className="messages-container">
      
      {/* 2. TYTUŁ STRONY (Zgodny z resztą) */}
      <h2 className="page-title">
        <FaEnvelope /> Wiadomości
      </h2>

      {/* 3. KARTA CZATU (To jest ten biały box) */}
      <div className="chat-card">
        
        {/* HEADER CZATU WEWNĄTRZ KARTY */}
        <div className="chat-header">
          <div className="director-avatar">
            <FaUserTie />
            {isDirectorOnline && <span className="avatar-online-dot"></span>}
          </div>
          <div className="header-info">
            <h3>Dyrekcja Przedszkola</h3>
            {isDirectorOnline ? (
              <span className="status-indicator online"><span className="dot green"></span> Dostępny</span>
            ) : (
              <span className="status-indicator offline"><span className="dot gray"></span> Niedostępny</span>
            )}
          </div>
        </div>

        {/* OBSZAR WIADOMOŚCI */}
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <p>Tu rozpoczyna się Twoja rozmowa z Dyrekcją.</p>
              <p>Napisz wiadomość, jeśli masz pytania.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMyMessage = msg.sender === currentUser.id;
              return (
                <div key={msg.id} className={`message-row ${isMyMessage ? 'sent' : 'received'}`}>
                  {!isMyMessage && (
                    <div className="msg-avatar">
                      {msg.sender_name ? msg.sender_name[0].toUpperCase() : 'D'}
                    </div>
                  )}
                  <div className="bubble-wrapper">
                    {!isMyMessage && <span className="sender-name">{msg.sender_name}</span>}
                    <div className="message-bubble">{msg.body}</div>
                    <span className="message-time">
                      {formatTime(msg.created_at)}
                      {isMyMessage && <span className="read-status">{msg.is_read ? ' • Przeczytano' : ' • Wysłano'}</span>}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <input 
            type="text" 
            placeholder="Napisz wiadomość..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" disabled={!newMessage.trim()}>
            <FaPaperPlane />
          </button>
        </form>

      </div>
    </div>
  );
};

export default Messages;