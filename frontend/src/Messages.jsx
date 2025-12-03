// frontend/src/Messages.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Messages.css';
import { 
  FaEnvelope, 
  FaPaperPlane, 
  FaInbox, 
  FaUser, 
  FaClock, 
  FaChevronDown, 
  FaChevronUp,
  FaPlus,
  FaReply
} from 'react-icons/fa';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [recipients, setRecipients] = useState([]); // Lista osób do wyboru
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('inbox'); // 'inbox' lub 'sent'
  const [loading, setLoading] = useState(true);
  
  // Stan dla Modala
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({ receiver: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  // Stan rozwiniętych wiadomości { id: true/false }
  const [expandedMessages, setExpandedMessages] = useState({});

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  // 1. Pobieranie danych (User + Wiadomości + Odbiorcy)
  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();
      
      // Pobieramy usera (żeby znać swoje ID)
      const userRes = await axios.get('http://127.0.0.1:8000/api/users/me/', headers);
      setCurrentUser(userRes.data);

      // Pobieramy wiadomości
      const msgRes = await axios.get('http://127.0.0.1:8000/api/communication/messages/', headers);
      setMessages(msgRes.data);

      // Pobieramy listę potencjalnych odbiorców (Dla uproszczenia: pobieramy wszystkich rodziców/dyrekcję)
      // W prawdziwej appce endpoint powinien być filtrowany. 
      // Tutaj zrobimy trick: jeśli jestem Dyrektorem -> pobieram rodziców.
      // Jeśli jestem Rodzicem -> Dyrektorzy.
      // *Zakładamy, że masz endpoint /users/ lub pobierasz to inaczej. 
      // *Dla MVP: użyjemy listy pobranej z wiadomości (znani nadawcy) lub po prostu ID 1 (Admin).
      
      // (Tutaj wstawiam placeholder - w produkcji potrzebny jest endpoint /api/users/)
      // Na potrzeby tego kodu założymy, że wpisujemy ID ręcznie lub wybieramy z listy znanych.
      
    } catch (err) {
      console.error("Błąd pobierania:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Polling co 10 sekund (sprawdzanie nowych wiadomości)
    const interval = setInterval(() => {
        axios.get('http://127.0.0.1:8000/api/communication/messages/', getAuthHeaders())
             .then(res => setMessages(res.data))
             .catch(e => console.error(e));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filtrowanie wiadomości
  const displayedMessages = messages.filter(msg => {
    if (!currentUser) return false;
    if (view === 'inbox') return msg.receiver === currentUser.id;
    if (view === 'sent') return msg.sender === currentUser.id;
    return false;
  });

  // Obsługa kliknięcia (Rozwiń + Oznacz jako przeczytane)
  const handleToggleMessage = async (msg) => {
    const isExpanded = expandedMessages[msg.id];
    
    // Przełącz widoczność
    setExpandedMessages(prev => ({ ...prev, [msg.id]: !isExpanded }));

    // Jeśli otwieramy, to jest INBOX i jest NIEPRZECZYTANA -> Oznacz jako przeczytaną
    if (!isExpanded && view === 'inbox' && !msg.is_read) {
      try {
        await axios.patch(
          `http://127.0.0.1:8000/api/communication/messages/${msg.id}/`,
          { is_read: true },
          getAuthHeaders()
        );
        // Aktualizuj stan lokalnie
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      } catch (err) {
        console.error("Błąd oznaczania jako przeczytane", err);
      }
    }
  };

  // Wysyłanie wiadomości
  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
        // UWAGA: Tutaj w MVP rodzic musi znać ID dyrektora (zazwyczaj 1).
        // W pełnej wersji potrzebujesz endpointu /api/users/list/ do selecta.
        // Dla testów, jeśli pole jest puste, wyślij do ID 1 (Admin).
        const receiverId = newMessage.receiver || 1; 

        await axios.post('http://127.0.0.1:8000/api/communication/messages/', {
            receiver: receiverId,
            subject: newMessage.subject,
            body: newMessage.body
        }, getAuthHeaders());

        alert("Wiadomość wysłana!");
        setIsModalOpen(false);
        setNewMessage({ receiver: '', subject: '', body: '' });
        fetchData(); // Odśwież listę
        setView('sent'); // Przełącz na wysłane
    } catch (err) {
        alert("Błąd wysyłania. Sprawdź ID odbiorcy.");
        console.error(err);
    } finally {
        setSending(false);
    }
  };

  // Odpowiedz na wiadomość
  const handleReply = (msg) => {
      setNewMessage({
          receiver: view === 'inbox' ? msg.sender : msg.receiver,
          subject: `Re: ${msg.subject}`,
          body: `\n\n--- Oryginalna wiadomość ---\n${msg.body}`
      });
      setIsModalOpen(true);
  };

  if (loading) return <div style={{padding: 20}}>Ładowanie wiadomości... 🐝</div>;

  return (
    <div className="messages-container">
      
      <div className="page-title">
        <FaEnvelope /> Wiadomości
      </div>

      <div className="messages-controls">
        {/* TABS */}
        <div className="tabs-container">
            <button 
                className={`tab-btn ${view === 'inbox' ? 'active' : ''}`} 
                onClick={() => setView('inbox')}
            >
                <FaInbox /> Odebrane
            </button>
            <button 
                className={`tab-btn ${view === 'sent' ? 'active' : ''}`} 
                onClick={() => setView('sent')}
            >
                <FaPaperPlane /> Wysłane
            </button>
        </div>

        {/* PRZYCISK NOWA WIADOMOŚĆ */}
        <button className="new-message-btn" onClick={() => setIsModalOpen(true)}>
            <FaPlus /> Nowa wiadomość
        </button>
      </div>

      {/* LISTA WIADOMOŚCI */}
      <div className="messages-list">
        {displayedMessages.length === 0 ? (
            <div className="empty-state">Brak wiadomości w tym folderze.</div>
        ) : (
            displayedMessages.map(msg => (
                <div 
                    key={msg.id} 
                    className={`message-card ${!msg.is_read && view === 'inbox' ? 'unread' : ''}`}
                    onClick={() => handleToggleMessage(msg)}
                >
                    <div className="message-header">
                        <div className="msg-avatar">
                            {view === 'inbox' ? <FaUser /> : <FaUser style={{color: '#999'}}/>}
                        </div>
                        <div className="msg-info">
                            <div className="msg-top-row">
                                <span className="msg-counterparty">
                                    {view === 'inbox' ? `Od: ${msg.sender_name}` : `Do: ${msg.receiver_name}`}
                                </span>
                                <span className="msg-date">
                                    <FaClock /> {new Date(msg.created_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="msg-subject">{msg.subject}</div>
                            <div className="msg-preview">
                                {expandedMessages[msg.id] ? '' : msg.body.slice(0, 60) + '...'}
                            </div>
                        </div>
                        <div className="msg-chevron">
                            {expandedMessages[msg.id] ? <FaChevronUp /> : <FaChevronDown />}
                        </div>
                    </div>

                    {/* ROZWINIĘTA TREŚĆ */}
                    {expandedMessages[msg.id] && (
                        <div className="message-body-full" onClick={(e) => e.stopPropagation()}>
                            <div className="full-text">{msg.body}</div>
                            <div className="message-actions">
                                <button className="reply-btn" onClick={() => handleReply(msg)}>
                                    <FaReply /> Odpowiedz
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))
        )}
      </div>

      {/* MODAL NOWEJ WIADOMOŚCI */}
      {isModalOpen && (
        <div className="modal-overlay">
            <div className="modal-content message-modal">
                <h3>Nowa Wiadomość</h3>
                <form onSubmit={handleSend}>
                    <div className="form-group">
                        <label>ID Odbiorcy (Dla testu wpisz 1 dla Admina)</label>
                        <input 
                            type="number" 
                            placeholder="Np. 1" 
                            value={newMessage.receiver}
                            onChange={e => setNewMessage({...newMessage, receiver: e.target.value})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Temat</label>
                        <input 
                            type="text" 
                            placeholder="Temat wiadomości"
                            value={newMessage.subject}
                            onChange={e => setNewMessage({...newMessage, subject: e.target.value})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Treść</label>
                        <textarea 
                            rows="5"
                            placeholder="Treść wiadomości..."
                            value={newMessage.body}
                            onChange={e => setNewMessage({...newMessage, body: e.target.value})}
                            required
                        ></textarea>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Anuluj</button>
                        <button type="submit" className="modal-btn confirm success" disabled={sending}>
                            {sending ? 'Wysyłanie...' : 'Wyślij'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default Messages;