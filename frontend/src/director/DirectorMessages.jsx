// frontend/src/director/DirectorMessages.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorMessages.css'; 
import LoadingScreen from '../users/LoadingScreen';

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

  const activeConversationIdRef = useRef(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversation ? activeConversation.participantId : null;
  }, [activeConversation]);

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

      if (activeConversationIdRef.current) {
         await axios.post('http://127.0.0.1:8000/api/communication/messages/mark_all_read/', {
            sender_id: activeConversationIdRef.current 
         }, getAuthHeaders());
      }

    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. POPRAWIONE PRZETWARZANIE WIADOMOŚCI ---
  const processMessages = (messages, myId, allParentUsers) => {
    const grouped = messages.reduce((acc, msg) => {
      
      let parentId = null;
      let parentName = null;

      // --- LOGIKA IDENTYFIKACJI ROZMÓWCY ---

      // 1. Jeśli wiadomość przyszła DO MNIE (Dyrektora), to nadawcą musi być Rodzic.
      if (msg.receiver === myId) {
        parentId = msg.sender;
        parentName = msg.sender_name;
      }
      // 2. Jeśli wiadomość wyszła OD MNIE, to odbiorcą jest Rodzic.
      else if (msg.sender === myId) {
        parentId = msg.receiver;
        parentName = msg.receiver_name;
      }
      // 3. Obsługa wspólnej skrzynki (rozmowa Innego Dyrektora z Rodzicem)
      else {
        // Sprawdzamy, czy Nadawca jest na liście znanych rodziców
        const senderIsParent = allParentUsers.find(u => u.id === msg.sender);
        
        if (senderIsParent) {
          // Jeśli nadawca to rodzic -> grupujemy po nim
          parentId = msg.sender;
          parentName = msg.sender_name;
        } else {
          // Jeśli nadawca to NIE jest znany rodzic, zakładamy, że to Inny Dyrektor.
          // Wtedy odbiorcą jest Rodzic.
          parentId = msg.receiver;
          parentName = msg.receiver_name;
        }
      }

      // Jeśli nadal nie mamy ID, pomijamy (błąd danych)
      if (!parentId) return acc;

      if (!acc[parentId]) {
        acc[parentId] = {
          participantId: parentId,
          participantName: parentName || 'Nieznany Rodzic',
          messages: []
        };
      }
      acc[parentId].messages.push(msg);
      return acc;
    }, {});

    // Sortowanie wiadomości wewnątrz rozmów
    for (const key in grouped) {
      grouped[key].messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    // Dodanie pustych rozmów dla rodziców z listy, którzy jeszcze nie pisali
    allParentUsers.forEach(user => {
      if (!grouped[user.id]) {
        grouped[user.id] = {
          participantId: user.id,
          participantName: `${user.first_name} ${user.last_name}`.trim() || user.username,
          messages: []
        };
      }
    });
    
    // Sortowanie listy (od najnowszych)
    const convArray = Object.values(grouped).sort((a, b) => {
      const aMsg = a.messages.length > 0 ? a.messages[a.messages.length - 1] : null;
      const bMsg = b.messages.length > 0 ? b.messages[b.messages.length - 1] : null;
      
      if (aMsg && !bMsg) return -1;
      if (!aMsg && bMsg) return 1;
      if (aMsg && bMsg) return new Date(bMsg.created_at) - new Date(aMsg.created_at);
      return a.participantName.localeCompare(b.participantName);
    });
    
    setConversations(convArray);

    if (activeConversationIdRef.current) {
      const updatedActiveConv = convArray.find(c => c.participantId === activeConversationIdRef.current);
      if (updatedActiveConv) {
        setActiveConversation(updatedActiveConv);
        if (isUserAtBottomRef.current) {
             setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
             }, 100);
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
        subject: 'Wiadomość od Dyrekcji',
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
      <h2 className="page-title"><FaEnvelope /> Wiadomości Dyrekcji</h2>

      <div className="messages-layout-grid">
        
        {/* LEWA STRONA */}
        <div className="conversations-list-panel">
          <div className="conv-search-bar">
            <FaSearch />
            <input 
              type="text" 
              placeholder="Szukaj rodzica..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="conv-list">
            {filteredConversations.map(conv => {
              const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
              const hasUnread = conv.messages.some(m => !m.is_read && m.sender === conv.participantId);

              return (
                <div 
                  key={conv.participantId}
                  className={`conv-item ${activeConversation?.participantId === conv.participantId ? 'active' : ''} ${hasUnread ? 'unread-conv' : ''}`}
                  onClick={() => { setActiveConversation(conv); setTimeout(scrollToBottom, 100); }}
                >
                  <div className="conv-avatar">{conv.participantName[0].toUpperCase()}</div>
                  <div className="conv-details">
                    <div className="conv-name" style={{ fontWeight: hasUnread ? 'bold' : 'normal' }}>
                        {conv.participantName}
                    </div>
                    
                    {lastMessage ? (
                      <div className="conv-last-msg">
                        {lastMessage.sender !== conv.participantId ? "Ty/Dyr: " : ""}
                        {lastMessage.body.substring(0, 25)}...
                      </div>
                    ) : (
                      <div className="conv-last-msg new-contact"><FaUserPlus /> Rozpocznij rozmowę</div>
                    )}
                  </div>
                  {lastMessage && <div className="conv-time">{formatTime(lastMessage.created_at)}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* PRAWA STRONA */}
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
                  const isIncoming = msg.sender === activeConversation.participantId;
                  
                  return (
                    <div key={msg.id} className={`message-row ${!isIncoming ? 'sent' : 'received'}`}>
                      {isIncoming && <div className="msg-avatar">{activeConversation.participantName[0].toUpperCase()}</div>}
                      
                      {!isIncoming && (
                          <div className="msg-avatar" title={msg.sender_name}>
                             {msg.sender_name ? msg.sender_name[0].toUpperCase() : 'D'}
                          </div>
                      )}

                      <div className="bubble-wrapper">
                        {!isIncoming && msg.sender !== currentUser.id && (
                             <span className="sender-name-small" style={{fontSize: '0.7em', color: '#666', marginBottom: '2px', display:'block'}}>
                                {msg.sender_name}
                             </span>
                        )}

                        <div className="message-bubble">{msg.body}</div>
                        <span className="message-time">
                            {formatTime(msg.created_at)}
                            {!isIncoming && (
                                <span className="read-status">
                                    {msg.is_read ? ' • Przeczytano' : ' • Wysłano'}
                                </span>
                            )}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
              
              {showScrollButton && (
                 <button className="scroll-bottom-btn" onClick={scrollToBottom}><FaArrowDown /></button>
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