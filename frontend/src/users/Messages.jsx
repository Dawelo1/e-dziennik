// frontend/src/Messages.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './Messages.css';
import { FaPaperPlane, FaUserTie, FaEnvelope, FaArrowDown } from 'react-icons/fa';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from '../authUtils';
import { getChatWebSocketUrl } from '../wsUtils';
import { toAbsoluteMediaUrl } from '../apiConfig';

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
  const currentUserRef = useRef(null);
  const messagesRef = useRef([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMarkingReadRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY_MS = 1000;
  const MAX_RECONNECT_DELAY_MS = 30000;

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- FUNKCJA POMOCNICZA DO URL ---
  const getAvatarUrl = (url) => {
    return toAbsoluteMediaUrl(url);
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

  const markConversationRead = useCallback(async () => {
    if (isMarkingReadRef.current) return;
    const me = currentUserRef.current;
    if (!me) return;

    const hasUnreadIncoming = messagesRef.current.some(
      msg => msg.receiver === me.id && msg.sender !== me.id && !msg.is_read
    );

    if (!hasUnreadIncoming || document.visibilityState !== 'visible') return;

    try {
      isMarkingReadRef.current = true;
      await axios.post('http://127.0.0.1:8000/api/communication/messages/mark_conversation_read/', {}, getAuthHeaders());
      setMessages(prev => prev.map(msg => (
        msg.receiver === me.id && msg.sender !== me.id ? { ...msg, is_read: true } : msg
      )));
    } catch (err) {
      console.error("Błąd oznaczania konwersacji jako przeczytanej:", err);
    } finally {
      isMarkingReadRef.current = false;
    }
  }, []);

  const fetchData = useCallback(async () => {
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

    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    shouldReconnectRef.current = true;
    let reconnectAttempts = 0;

    const closeSocketSafely = (ws) => {
      if (!ws) return;

      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounted');
        return;
      }

      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close(1000, 'Component unmounted');
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
      }
    };

    fetchData().then(() => {
      setTimeout(scrollToBottom, 200);
    });

    const connectWebSocket = () => {
      const wsUrl = getChatWebSocketUrl();
      if (!wsUrl) return;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'new_message' && data.message) {
            const me = currentUserRef.current;
            const isIncomingVisible = Boolean(
              me &&
              data.message.receiver === me.id &&
              data.message.sender !== me.id &&
              document.visibilityState === 'visible'
            );

            setMessages(prev => {
              const alreadyExists = prev.some(m => m.id === data.message.id);
              if (alreadyExists) return prev;

              const next = [...prev, data.message].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
              if (isUserAtBottomRef.current) {
                setTimeout(scrollToBottom, 100);
              }
              return next;
            });

            if (isIncomingVisible) {
              setTimeout(() => {
                markConversationRead();
              }, 50);
            }
          }

          if (data.type === 'conversation_read') {
            const ids = Array.isArray(data.read_message_ids) ? data.read_message_ids : [];
            if (!ids.length) return;
            const idSet = new Set(ids);

            setMessages(prev => prev.map(msg => (
              idSet.has(msg.id) ? { ...msg, is_read: true } : msg
            )));
          }
        } catch (parseErr) {
          console.error('Błąd parsowania WS wiadomości:', parseErr);
        }
      };

      socket.onclose = () => {
        if (!shouldReconnectRef.current) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('WebSocket: osiągnięto limit prób reconnect (Messages).');
          return;
        }

        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * (2 ** reconnectAttempts),
          MAX_RECONNECT_DELAY_MS
        );
        reconnectAttempts += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };

    connectWebSocket();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        markConversationRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      shouldReconnectRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      closeSocketSafely(wsRef.current);
    };
  }, [currentUser, fetchData, markConversationRead]);

  useEffect(() => {
    markConversationRead();
  }, [messages, markConversationRead]);

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