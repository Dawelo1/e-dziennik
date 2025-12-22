// frontend/src/director/DirectorMessages.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorMessages.css'; 
import LoadingScreen from '../LoadingScreen';

import { 
  FaEnvelope, FaSearch, FaPaperPlane, FaUserPlus, FaArrowDown
} from 'react-icons/fa';

const DirectorMessages = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isUserAtBottomRef = useRef(true);

  // --- 1. POBIERANIE DANYCH ---
  const fetchData = async () => {
    try {
      const [messagesRes, userRes, allUsersRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/communication/messages/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/manage/?is_parent=true', getAuthHeaders())
      ]);

      const myId = userRes.data.id;
      setCurrentUser(userRes.data);
      processMessages(messagesRes.data, myId, allUsersRes.data);

      // Oznacz wszystkie jako przeczytane gdy jesteśmy na ekranie czatu (jak w widoku rodzica)
      await axios.post('http://127.0.0.1:8000/api/communication/messages/mark_all_read/', {}, getAuthHeaders());

    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. TWORZENIE LISTY KONTAKTOWEJ ---
  const processMessages = (messages, myId, allParentUsers) => {
    const grouped = messages.reduce((acc, msg) => {
      const otherPersonId = msg.sender === myId ? msg.receiver : msg.sender;
      if (otherPersonId === myId) return acc;
      if (!acc[otherPersonId]) {
        acc[otherPersonId] = {
          participantId: otherPersonId,
          participantName: msg.sender === myId ? msg.receiver_name : msg.sender_name,
          messages: []
        };
      }
      acc[otherPersonId].messages.push(msg);
      return acc;
    }, {});

    // --- POPRAWKA TUTAJ: Sortowanie wiadomości wewnątrz każdej rozmowy ---
    // Najstarsze -> Najnowsze (chronologicznie)
    for (const key in grouped) {
      grouped[key].messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    allParentUsers.forEach(user => {
      if (!grouped[user.id] && user.id !== myId) {
        grouped[user.id] = {
          participantId: user.id,
          participantName: `${user.first_name} ${user.last_name}`.trim() || user.username,
          messages: []
        };
      }
    });
    
    const convArray = Object.values(grouped).sort((a, b) => {
      const aHasMessages = a.messages.length > 0;
      const bHasMessages = b.messages.length > 0;
      if (aHasMessages && !bHasMessages) return -1;
      if (!aHasMessages && bHasMessages) return 1;
      if (aHasMessages && bHasMessages) {
        return new Date(b.messages[b.messages.length - 1].created_at) - new Date(a.messages[a.messages.length - 1].created_at);
      }
      return a.participantName.localeCompare(b.participantName);
    });
    
    setConversations(convArray);

    if (activeConversation) {
      const updatedActiveConv = convArray.find(c => c.participantId === activeConversation.participantId);
      if (updatedActiveConv) {
        const isNewMessage = updatedActiveConv.messages.length > activeConversation.messages.length;
        setActiveConversation(updatedActiveConv);
        if (isNewMessage && isUserAtBottomRef.current) {
          setTimeout(scrollToBottom, 100);
        }
      }
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 300;
    isUserAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;
    try {
      await axios.post('http://127.0.0.1:8000/api/communication/messages/', {
        receiver: activeConversation.participantId,
        subject: 'Odpowiedź z czatu',
        body: newMessage,
      }, getAuthHeaders());
      
      setNewMessage('');
      await fetchData();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <LoadingScreen message="Wczytywanie wiadomości..." />;

  return (
    <div className="director-container">
      <h2 className="page-title">
        <FaEnvelope /> Wiadomości
      </h2>

      <div className="messages-layout-grid">
        
        {/* LEWA KOLUMNA */}
        <div className="conversations-list-panel">
          <div className="conv-search-bar">
            <FaSearch />
            <input 
              type="text" 
              placeholder="Szukaj odbiorcy..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="conv-list">
            {filteredConversations.length === 0 ? (
              <div className="empty-conv-list">Brak kontaktów.</div>
            ) : (
              filteredConversations.map(conv => {
                const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
                return (
                  <div 
                    key={conv.participantId}
                    className={`conv-item ${activeConversation?.participantId === conv.participantId ? 'active' : ''}`}
                    onClick={() => setActiveConversation(conv)}
                  >
                    <div className="conv-avatar">
                      {conv.participantName ? conv.participantName[0].toUpperCase() : '?'}
                    </div>
                    <div className="conv-details">
                      <div className="conv-name">{conv.participantName}</div>
                      
                      {lastMessage ? (
                        <div className="conv-last-msg">
                          {lastMessage.sender === currentUser.id && "Ty: "}
                          {lastMessage.body.substring(0, 25)}...
                        </div>
                      ) : (
                        <div className="conv-last-msg new-contact">
                          <FaUserPlus /> Rozpocznij rozmowę
                        </div>
                      )}
                      
                    </div>
                    {lastMessage && <div className="conv-time">{formatTime(lastMessage.created_at)}</div>}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* PRAWA KOLUMNA */}
        <div className="chat-window-panel">
          {!activeConversation ? (
            <div className="no-chat-selected">
              <FaEnvelope size={40} style={{opacity: 0.2}}/>
              <h4>Wybierz rozmowę z listy.</h4>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="director-avatar" style={{backgroundColor: '#f2c94c', color: 'white'}}>
                  {activeConversation.participantName[0].toUpperCase()}
                </div>
                <div className="header-info">
                  <h3>{activeConversation.participantName}</h3>
                </div>
              </div>

              <div className="messages-area" ref={messagesContainerRef} onScroll={handleScroll}>
                {activeConversation.messages.map(msg => {
                  const isMyMessage = msg.sender === currentUser.id;
                  return (
                    <div key={msg.id} className={`message-row ${isMyMessage ? 'sent' : 'received'}`}>
                      
                      {/* Avatar Odbiorcy (Rodzica) */}
                      {!isMyMessage && <div className="msg-avatar">{activeConversation.participantName[0].toUpperCase()}</div>}
                      
                      {/* Avatar Nadawcy (Mój, czyli Dyrektora) */}
                      {isMyMessage && <div className="msg-avatar">{currentUser && currentUser.first_name ? currentUser.first_name[0].toUpperCase() : 'D'}</div>}

                      <div className="bubble-wrapper">
                        <div className="message-bubble">{msg.body}</div>
                        <span className="message-time">{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
              
              {showScrollButton && (
                 <button className="scroll-bottom-btn" onClick={scrollToBottom}>
                   <FaArrowDown />
                 </button>
              )}

              <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Napisz odpowiedź..." 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit"><FaPaperPlane /></button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectorMessages;