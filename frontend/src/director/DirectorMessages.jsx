// frontend/src/director/DirectorMessages.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders, removeToken } from '../authUtils';
import './DirectorMessages.css'; 
import LoadingScreen from '../users/LoadingScreen';

import { 
  FaEnvelope, FaSearch, FaPaperPlane, FaUserPlus, FaArrowDown
} from 'react-icons/fa';

const DirectorMessages = () => {
  const navigate = useNavigate();
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
  const activeConversationRef = useRef(null);
  const currentUserRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const markConversationRead = async (participantId) => {
    const authConfig = getAuthHeaders();
    if (!authConfig) {
      removeToken();
      navigate('/');
      return;
    }
    try {
      await axios.post('http://127.0.0.1:8000/api/communication/messages/mark_all_read/', {
        sender_id: participantId
      }, authConfig);
    } catch (err) {
      console.error("Błąd oznaczania jako przeczytane:", err);
    }
  };

  const getConvSignature = (conv) => {
    if (!conv) return '';
    const lastMsg = conv.messages[conv.messages.length - 1];
    const lastId = lastMsg ? lastMsg.id : 'none';
    const unreadCount = conv.messages.reduce((count, m) => (
      !m.is_read && m.sender === conv.participantId ? count + 1 : count
    ), 0);
    return `${conv.messages.length}:${lastId}:${unreadCount}`;
  };

  // --- 1. POBIERANIE DANYCH ---
  const fetchData = async (myId) => {
    try {
      const authConfig = getAuthHeaders();
      if (!authConfig) {
        removeToken();
        navigate('/');
        return;
      }
      const [messagesRes, allUsersRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/communication/messages/', authConfig),
        axios.get('http://127.0.0.1:8000/api/users/manage/?is_parent=true', authConfig)
      ]);

      // Przekazujemy 'myId' bezpośrednio, żeby nie polegać na asynchronicznym stanie
      processMessages(messagesRes.data, myId, allUsersRes.data);

    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };
  
  // --- 2. PRZETWARZANIE WIADOMOŚCI ---
  const processMessages = (messages, myId, allParentUsers) => {
    const grouped = messages.reduce((acc, msg) => {
        const otherId = msg.sender === myId ? msg.receiver : msg.sender;
        if (otherId === myId) return acc;
        if (!acc[otherId]) {
            acc[otherId] = { participantId: otherId, participantName: msg.sender === myId ? msg.receiver_name : msg.sender_name, messages: [] };
        }
        acc[otherId].messages.push(msg);
        return acc;
    }, {});
    
    for (const key in grouped) {
        grouped[key].messages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    
    allParentUsers.forEach(user => {
        if (!grouped[user.id] && user.id !== myId) {
            grouped[user.id] = { participantId: user.id, participantName: `${user.first_name} ${user.last_name}`.trim() || user.username, messages: [] };
        }
    });

    const convArray = Object.values(grouped).sort((a, b) => {
      const aMsg = a.messages[a.messages.length - 1];
      const bMsg = b.messages[b.messages.length - 1];
      const aHas = Boolean(aMsg);
      const bHas = Boolean(bMsg);

      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;

      if (aHas && bHas) {
        const aTime = Date.parse(aMsg.created_at);
        const bTime = Date.parse(bMsg.created_at);
        const aTs = Number.isNaN(aTime) ? 0 : aTime;
        const bTs = Number.isNaN(bTime) ? 0 : bTime;

        if (aTs !== bTs) return bTs - aTs;
      }

      return a.participantName.localeCompare(b.participantName);
    });
    setConversations(convArray);

    const currentActive = activeConversationRef.current;
    if (currentActive) {
      const updatedActiveConv = convArray.find(c => c.participantId === currentActive.participantId);
      if (updatedActiveConv) {
        const currentSig = getConvSignature(currentActive);
        const updatedSig = getConvSignature(updatedActiveConv);
        if (currentSig !== updatedSig) {
          setActiveConversation(updatedActiveConv);
          if (isUserAtBottomRef.current) setTimeout(scrollToBottom, 100);
        }

        const hasUnread = updatedActiveConv.messages.some(
          m => !m.is_read && m.sender === updatedActiveConv.participantId
        );
        if (hasUnread) markConversationRead(updatedActiveConv.participantId);
      }
    }
  };
  
  // --- POPRAWIONY START I POLLING ---
  useEffect(() => {
    let intervalId = null;

    const startFetching = async () => {
      try {
        const authConfig = getAuthHeaders();
        if (!authConfig) {
          removeToken();
          navigate('/');
          setLoading(false);
          return;
        }
        // A. Pobierz dane o zalogowanym użytkowniku
        const userRes = await axios.get('http://127.0.0.1:8000/api/users/me/', authConfig);
        const user = userRes.data;
        setCurrentUser(user);

        // B. Uruchom pierwsze pobranie reszty danych, przekazując ID usera
        await fetchData(user.id);
        
        // C. Ustaw interwał, który będzie odświeżał dane (z ID użytkownika)
        // Sprawdzamy, czy intervalId już nie istnieje, żeby uniknąć duplikatów
        if (!intervalId) {
          intervalId = setInterval(() => fetchData(user.id), 3000);
        }

      } catch(err) {
        console.error("Błąd inicjalizacji:", err);
        // Jeśli tu jest błąd, prawdopodobnie token jest zły.
        // Warto byłoby wylogować usera:
        // removeToken(); navigate('/');
        setLoading(false);
      }
    };
    
    startFetching();

    // D. Sprzątanie (czyści interwał po wyjściu z komponentu)
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Pusta tablica, uruchamia się tylko raz

  // --- LOGIKA "PRZECZYTANO" PO KLIKNIĘCIU ---
  useEffect(() => {
    if (activeConversation) {
      const hasUnread = activeConversation.messages.some(m => !m.is_read && m.sender === activeConversation.participantId);
      
      if (hasUnread) {
        markConversationRead(activeConversation.participantId);
      }
      
      setTimeout(scrollToBottom, 50);
    }
  }, [activeConversation]);

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
      const authConfig = getAuthHeaders();
      if (!authConfig) {
        removeToken();
        navigate('/');
        return;
      }
      await axios.post('http://127.0.0.1:8000/api/communication/messages/', {
        receiver: activeConversation.participantId,
        subject: 'Wiadomość od Dyrekcji',
        body: newMessage,
      }, authConfig);
      
      setNewMessage('');
      await fetchData(currentUser.id);
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
      <h2 className="page-title"><FaEnvelope /> Wiadomości</h2>

      <div className="messages-layout-grid">
        
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
              
              const hasUnread = lastMessage && !lastMessage.is_read && lastMessage.sender !== currentUser?.id;

              return (
                <div 
                  key={conv.participantId}
                  className={`conv-item ${activeConversation?.participantId === conv.participantId ? 'active' : ''} ${hasUnread ? 'unread-conv' : ''}`}
                  onClick={() => setActiveConversation(conv)}
                >
                  <div className="conv-avatar">{conv.participantName[0].toUpperCase()}</div>
                  <div className="conv-details">
                    <div className="conv-name" style={{ fontWeight: hasUnread ? 'bold' : 'normal' }}>
                        {conv.participantName}
                    </div>
                    {lastMessage ? (
                      <div className="conv-last-msg" style={{ fontWeight: hasUnread ? 'bold' : 'normal', color: hasUnread ? '#333' : '#666'}}>
                        {lastMessage.sender === currentUser.id ? "Ty: " : ""}
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
                        {!isIncoming && msg.sender !== currentUser?.id && (
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