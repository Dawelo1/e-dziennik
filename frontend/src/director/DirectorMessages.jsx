// frontend/src/director/DirectorMessages.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders, removeToken } from '../authUtils';
import { getChatWebSocketUrl } from '../wsUtils';
import './DirectorMessages.css'; 
import LoadingScreen from '../users/LoadingScreen';

import { 
  FaEnvelope, FaSearch, FaPaperPlane, FaUserPlus, FaArrowDown
} from 'react-icons/fa';

const API_BASE_URL = 'http://127.0.0.1:8000';

const toAbsoluteUrl = (avatarUrl) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
  return `${API_BASE_URL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
};

const getInitial = (name) => (name?.trim()?.[0] || '?').toUpperCase();
const isSameParticipant = (left, right) => Number(left) === Number(right);

const DirectorMessages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const isMarkingReadRef = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const isFetchingRef = useRef(false);
  const pendingFetchRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY_MS = 1000;
  const MAX_RECONNECT_DELAY_MS = 30000;
  const requestedParticipantId = Number(searchParams.get('participant')) || null;

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const markActiveConversationRead = useCallback(() => {
    const active = activeConversationRef.current;
    if (!active) return;
    if (document.visibilityState !== 'visible') return;
    markConversationRead(active.participantId);
  }, []);

  const markConversationRead = async (participantId) => {
    if (isMarkingReadRef.current) return;
    const authConfig = getAuthHeaders();
    if (!authConfig) {
      removeToken();
      navigate('/');
      return;
    }
    try {
      isMarkingReadRef.current = true;
      await axios.post('http://127.0.0.1:8000/api/communication/messages/mark_conversation_read/', {
        participant_id: participantId
      }, authConfig);

      setConversations(prev => prev.map(conv => {
        if (!isSameParticipant(conv.participantId, participantId)) return conv;
        return {
          ...conv,
          messages: conv.messages.map(msg => (
            isSameParticipant(msg.sender, participantId) ? { ...msg, is_read: true } : msg
          )),
        };
      }));

      setActiveConversation(prev => {
        if (!prev || !isSameParticipant(prev.participantId, participantId)) return prev;
        return {
          ...prev,
          messages: prev.messages.map(msg => (
            isSameParticipant(msg.sender, participantId) ? { ...msg, is_read: true } : msg
          )),
        };
      });
    } catch (err) {
      console.error("Błąd oznaczania jako przeczytane:", err);
    } finally {
      isMarkingReadRef.current = false;
    }
  };

  const getConvSignature = (conv) => {
    if (!conv) return '';
    const lastMsg = conv.messages[conv.messages.length - 1];
    const lastId = lastMsg ? lastMsg.id : 'none';
    const unreadCount = conv.messages.reduce((count, m) => (
      !m.is_read && isSameParticipant(m.sender, conv.participantId) ? count + 1 : count
    ), 0);
    return `${conv.messages.length}:${lastId}:${unreadCount}`;
  };

  // --- 1. POBIERANIE DANYCH ---
  const fetchData = useCallback(async (myId) => {
    if (isFetchingRef.current) {
      pendingFetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;
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
      isFetchingRef.current = false;
      setLoading(false);

      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        fetchData(myId);
      }
    }
  }, [navigate]);
  
  // --- 2. PRZETWARZANIE WIADOMOŚCI ---
  const processMessages = (messages, myId, allParentUsers) => {
    const grouped = messages.reduce((acc, msg) => {
        const otherId = msg.sender === myId ? msg.receiver : msg.sender;
        if (otherId === myId) return acc;
      const participantName = msg.sender === myId ? msg.receiver_name : msg.sender_name;
      const participantAvatarUrl = msg.sender === myId ? msg.receiver_avatar_url : msg.sender_avatar_url;

        if (!acc[otherId]) {
        acc[otherId] = {
          participantId: otherId,
          participantName,
          participantAvatar: toAbsoluteUrl(participantAvatarUrl),
          messages: []
        };
      } else if (!acc[otherId].participantAvatar && participantAvatarUrl) {
        acc[otherId].participantAvatar = toAbsoluteUrl(participantAvatarUrl);
        }
        acc[otherId].messages.push(msg);
        return acc;
    }, {});
    
    for (const key in grouped) {
        grouped[key].messages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    
    allParentUsers.forEach(user => {
      const parentAvatar = toAbsoluteUrl(user.avatar_url || user.avatar);
        if (!grouped[user.id] && user.id !== myId) {
        grouped[user.id] = {
          participantId: user.id,
          participantName: `${user.first_name} ${user.last_name}`.trim() || user.username,
          participantAvatar: parentAvatar,
          messages: []
        };
      } else if (grouped[user.id] && !grouped[user.id].participantAvatar && parentAvatar) {
        grouped[user.id].participantAvatar = parentAvatar;
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
          m => !m.is_read && isSameParticipant(m.sender, updatedActiveConv.participantId)
        );
        if (hasUnread && document.visibilityState === 'visible') {
          markConversationRead(updatedActiveConv.participantId);
        }
      }
    }
  };
  
  // --- POPRAWIONY START I POLLING ---
  useEffect(() => {
    let mounted = true;
    shouldReconnectRef.current = true;
    let reconnectAttempts = 0;

    const connectWebSocket = (userId) => {
      const wsUrl = getChatWebSocketUrl();
      if (!wsUrl) return;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            const incoming = data.message;
            const activeNow = activeConversationRef.current;

            if (
              incoming &&
              activeNow &&
              document.visibilityState === 'visible' &&
              isSameParticipant(incoming.sender, activeNow.participantId) &&
              !isSameParticipant(incoming.sender, userId)
            ) {
              setTimeout(() => {
                markConversationRead(activeNow.participantId);
              }, 50);
            }

            await fetchData(userId);
            markActiveConversationRead();
          }

          if (data.type === 'conversation_read') {
            const ids = Array.isArray(data.read_message_ids) ? data.read_message_ids : [];
            if (!ids.length) return;
            const idSet = new Set(ids);

            setConversations(prev => prev.map(conv => ({
              ...conv,
              messages: conv.messages.map(msg => (
                idSet.has(msg.id) ? { ...msg, is_read: true } : msg
              )),
            })));

            setActiveConversation(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map(msg => (
                  idSet.has(msg.id) ? { ...msg, is_read: true } : msg
                )),
              };
            });

            markActiveConversationRead();
          }
        } catch (parseErr) {
          console.error('Błąd parsowania WS wiadomości:', parseErr);
        }
      };

      socket.onclose = () => {
        if (!shouldReconnectRef.current) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('WebSocket: osiągnięto limit prób reconnect (DirectorMessages).');
          return;
        }

        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * (2 ** reconnectAttempts),
          MAX_RECONNECT_DELAY_MS
        );
        reconnectAttempts += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => connectWebSocket(userId), delay);
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    };

    const initialize = async () => {
      try {
        const authConfig = getAuthHeaders();
        if (!authConfig) {
          removeToken();
          navigate('/');
          setLoading(false);
          return;
        }

        const userRes = await axios.get('http://127.0.0.1:8000/api/users/me/', authConfig);
        if (!mounted) return;

        const user = userRes.data;
        setCurrentUser(user);
        await fetchData(user.id);
        connectWebSocket(user.id);
      } catch (err) {
        console.error('Błąd inicjalizacji:', err);
        setLoading(false);
      }
    };

    initialize();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActiveConversationRead();
      }
    };

    const handleWindowFocus = () => {
      markActiveConversationRead();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      mounted = false;
      shouldReconnectRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchData, markActiveConversationRead, navigate]);

  // --- LOGIKA "PRZECZYTANO" PO KLIKNIĘCIU ---
  useEffect(() => {
    if (activeConversation) {
      markActiveConversationRead();
      
      setTimeout(scrollToBottom, 50);
    }
  }, [activeConversation, markActiveConversationRead]);

  useEffect(() => {
    if (!requestedParticipantId || !conversations.length) return;

    const targetConversation = conversations.find(conv => (
      isSameParticipant(conv.participantId, requestedParticipantId)
    ));

    if (!targetConversation) return;
    if (isSameParticipant(activeConversation?.participantId, requestedParticipantId)) return;

    setActiveConversation(targetConversation);
  }, [requestedParticipantId, conversations, activeConversation]);

  const clearParticipantQuery = useCallback(() => {
    if (!searchParams.get('participant')) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('participant');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
              
              const unreadCount = conv.messages.reduce((count, msg) => {
                const isIncoming = isSameParticipant(msg.sender, conv.participantId);
                return (!msg.is_read && isIncoming) ? count + 1 : count;
              }, 0);
              const hasUnread = unreadCount > 0;

              return (
                <div 
                  key={conv.participantId}
                  className={`conv-item ${activeConversation?.participantId === conv.participantId ? 'active' : ''} ${hasUnread ? 'unread-conv' : ''}`}
                  onClick={() => {
                    clearParticipantQuery();
                    setActiveConversation(conv);
                  }}
                >
                  <div className="conv-avatar">
                    {conv.participantAvatar ? (
                      <img src={conv.participantAvatar} alt={conv.participantName} className="avatar-image" />
                    ) : (
                      getInitial(conv.participantName)
                    )}
                  </div>
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
                  {activeConversation.participantAvatar ? (
                    <img src={activeConversation.participantAvatar} alt={activeConversation.participantName} className="avatar-image" />
                  ) : (
                    getInitial(activeConversation.participantName)
                  )}
                </div>
                <div className="header-info">
                   <h3>{activeConversation.participantName}</h3>
                </div>
              </div>

              <div className="messages-area" ref={messagesContainerRef} onScroll={handleScroll}>
                {activeConversation.messages.map(msg => {
                  const isIncoming = isSameParticipant(msg.sender, activeConversation.participantId);
                  const senderAvatar = activeConversation.participantAvatar;
                  const senderLabel = isIncoming ? activeConversation.participantName : msg.sender_name;
                  
                  return (
                    <div key={msg.id} className={`message-row ${!isIncoming ? 'sent' : 'received'}`}>
                      {isIncoming && (
                        <div className="msg-avatar">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt={senderLabel} className="avatar-image" />
                          ) : (
                            getInitial(activeConversation.participantName)
                          )}
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