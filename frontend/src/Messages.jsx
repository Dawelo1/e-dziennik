// frontend/src/Messages.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Messages.css';
import { FaPaperPlane, FaUserTie, FaEnvelope, FaArrowDown } from 'react-icons/fa';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isDirectorOnline, setIsDirectorOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Refy
  const messagesEndRef = useRef(null);       
  const messagesContainerRef = useRef(null); 
  
  // NOWOŚĆ: Ref do śledzenia, czy użytkownik jest na dole (nie powoduje re-renderów)
  const isUserAtBottomRef = useRef(true); 

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => setCurrentUser(res.data))
      .catch(err => console.error(err));
  }, []);

  // --- FUNKCJA PRZEWIJANIA NA DÓŁ ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- OBSŁUGA SCROLLOWANIA (Śledzenie pozycji) ---
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    
    // Margines błędu 100px (uznajemy, że jest na dole, nawet jak brakuje mu kawałeczka)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // Aktualizujemy Ref (dla logiki) i State (dla widoku strzałki)
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
        // Sprawdzamy, czy doszła NOWA wiadomość (porównując długość lub ID ostatniej)
        const isNewMessage = sorted.length > prevMessages.length;
        
        // Logika Smart Scroll:
        // Przewiń JEŚLI (doszła nowa wiadomość ORAZ użytkownik był na dole)
        if (isNewMessage && isUserAtBottomRef.current) {
          // setTimeout, żeby DOM zdążył się wyrenderować przed scrollem
          setTimeout(scrollToBottom, 100);
        }
        
        return sorted;
      });

      setIsDirectorOnline(statusRes.data.is_online);
    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };

  // Start i Polling
  useEffect(() => {
    axios.post('http://127.0.0.1:8000/api/communication/messages/mark_all_read/', {}, getAuthHeaders())
      .catch(err => console.error(err));
    
    // Pierwsze pobranie - wymuszamy scroll na dół
    fetchData().then(() => {
      setTimeout(scrollToBottom, 200);
    });

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // UWAGA: Usunąłem useEffect zależny od [messages], który powodował błędy!

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await axios.post('http://127.0.0.1:8000/api/communication/messages/', {
        body: newMessage,
        subject: 'Czat' 
      }, getAuthHeaders());

      setNewMessage('');
      
      // Po wysłaniu ZAWSZE wymuszamy scroll na dół (bo to my piszemy)
      await fetchData();
      setTimeout(scrollToBottom, 100);
      
      // Resetujemy flagę, że jesteśmy na dole
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

  if (loading || !currentUser) return <div style={{padding: 20}}>Ładowanie czatu... 🐝</div>;

  return (
    <div className="messages-container">
      
      <h2 className="page-title">
        <FaEnvelope /> Wiadomości
      </h2>

      <div className="chat-card">
        
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
          
          {/* PRZYCISK "WRÓĆ NA DÓŁ" */}
          {showScrollButton && (
            <button className="scroll-bottom-btn" onClick={() => {
              scrollToBottom();
              isUserAtBottomRef.current = true; // Ręcznie ustawiamy, że jesteśmy na dole
            }}>
              <FaArrowDown />
            </button>
          )}
        </div>

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