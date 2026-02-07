// frontend/src/Messages.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Messages.css';
import { FaPaperPlane, FaUserTie, FaEnvelope, FaArrowDown } from 'react-icons/fa';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from '../authUtils';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  const [isDirectorOnline, setIsDirectorOnline] = useState(false);
  // --- NOWY STAN: Awatar dyrektora ---
  const [directorAvatar, setDirectorAvatar] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Refy
  const messagesEndRef = useRef(null);       
  const messagesContainerRef = useRef(null); 
  
  const isUserAtBottomRef = useRef(true); 

  // --- FUNKCJA POMOCNICZA DO URL ---
  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => setCurrentUser(res.data))
      .catch(err => console.error(err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 300;
    
    isUserAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
  };

  const fetchData = async () => {
    try {
      const [msgRes, statusRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/communication/messages/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/director-status/', getAuthHeaders())
      ]);

      const sorted = msgRes.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      setMessages(prevMessages => {
        const isNewMessage = sorted.length > prevMessages.length;
        if (isNewMessage && isUserAtBottomRef.current) {
          setTimeout(scrollToBottom, 100);
        }
        return sorted;
      });

      // --- ZAPISYWANIE DANYCH DYREKTORA ---
      setIsDirectorOnline(statusRes.data.is_online);
      setDirectorAvatar(statusRes.data.avatar); // Zapisujemy URL avatara

      await axios.post('http://127.0.0.1:8000/api/communication/messages/mark_all_read/', {}, getAuthHeaders());

    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData().then(() => {
      setTimeout(scrollToBottom, 200);
    });

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await axios.post('http://127.0.0.1:8000/api/communication/messages/', {
        body: newMessage,
        subject: 'Czat' 
      }, getAuthHeaders());

      setNewMessage('');
      
      await fetchData();
      setTimeout(scrollToBottom, 100);
      
      isUserAtBottomRef.current = true;
      setShowScrollButton(false);

    } catch (err) {
      console.error("Błąd wysyłania:", err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <LoadingScreen message="Wczytywanie wiadomości..." />;

  return (
    <div className="messages-container">
      
      <h2 className="page-title">
        <FaEnvelope /> Wiadomości
      </h2>

      <div className="chat-card">
        
        <div className="chat-header">
          <div className="director-avatar">
            
            {/* --- ZMIANA: WYŚWIETLANIE AVATARA --- */}
            {directorAvatar ? (
               <img 
                 src={getAvatarUrl(directorAvatar)} 
                 alt="Dyrektor" 
                 style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
               />
            ) : (
               <FaUserTie /> // Fallback, jeśli dyrektor nie ma zdjęcia
            )}

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
        <div 
          className="messages-area" 
          ref={messagesContainerRef} 
          onScroll={handleScroll}
        >
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
                      {/* Tutaj też możemy użyć avatara dyrektora, jeśli wiadomość jest od niego */}
                      {directorAvatar ? (
                        <img 
                          src={getAvatarUrl(directorAvatar)} 
                          alt="D" 
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        msg.sender_name ? msg.sender_name[0].toUpperCase() : 'D'
                      )}
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

        {showScrollButton && (
          <button 
            className="scroll-bottom-btn" 
            onClick={() => {
              scrollToBottom();
              isUserAtBottomRef.current = true;
              setShowScrollButton(false);
            }}
          >
            <FaArrowDown />
          </button>
        )}

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