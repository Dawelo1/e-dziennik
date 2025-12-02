// frontend/src/Attendance.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Attendance.css';
import { FaUserSlash, FaChild, FaExclamationTriangle, FaCheckCircle, FaBan, FaTrashAlt, FaCalendarPlus } from 'react-icons/fa';

const Attendance = () => {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  
  // Mapa nieobecności: { "YYYY-MM-DD": ID_WPISU }
  const [absencesMap, setAbsencesMap] = useState({});
  
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Stan dla Modala Potwierdzenia
  const [modal, setModal] = useState({
    isOpen: false,
    type: null, // 'add' lub 'remove'
    date: null,
    recordId: null
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const childrenRes = await axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders());
        setChildren(childrenRes.data);
        if (childrenRes.data.length > 0) {
          setSelectedChild(childrenRes.data[0].id);
        }

        const closuresRes = await axios.get('http://127.0.0.1:8000/api/calendar/closures/', getAuthHeaders());
        const closureDates = closuresRes.data.map(item => item.date);
        setClosures(closureDates);

      } catch (err) {
        console.error("Błąd pobierania danych:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    fetchAttendance();
  }, [selectedChild]);

  const fetchAttendance = () => {
    axios.get('http://127.0.0.1:8000/api/attendance/', getAuthHeaders())
      .then(res => {
        const map = {};
        res.data.forEach(record => {
          if (record.child === selectedChild && record.status === 'absent') {
            map[record.date] = record.id;
          }
        });
        setAbsencesMap(map);
      })
      .catch(err => console.error(err));
  };

  // Formatowanie dla API (YYYY-MM-DD)
  const formatDate = (date) => {
    const offset = date.getTimezoneOffset();
    const dateObj = new Date(date.getTime() - (offset * 60 * 1000));
    return dateObj.toISOString().split('T')[0];
  };

  // NOWE: Formatowanie dla Użytkownika (DD.MM.YYYY)
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };

  const handleDayClick = (value) => {
    setMessage({ type: '', text: '' });
    const dateStr = formatDate(value);
    const now = new Date();
    const todayStr = formatDate(now);

    if (dateStr < todayStr) {
      setMessage({ type: 'error', text: 'Nie można modyfikować obecności wstecz.' });
      return;
    }
    if (dateStr === todayStr && now.getHours() >= 8) {
      setMessage({ type: 'error', text: 'Zmiany na dzisiaj możliwe tylko do godz. 8:00.' });
      return;
    }

    const existingRecordId = absencesMap[dateStr];

    if (existingRecordId) {
      setModal({
        isOpen: true,
        type: 'remove',
        date: dateStr,
        recordId: existingRecordId
      });
    } else {
      setModal({
        isOpen: true,
        type: 'add',
        date: dateStr,
        recordId: null
      });
    }
  };

  const confirmAction = async () => {
    const { type, date, recordId } = modal;
    setModal({ ...modal, isOpen: false });

    try {
      if (type === 'add') {
        await axios.post('http://127.0.0.1:8000/api/attendance/', {
          child: selectedChild,
          date: date
        }, getAuthHeaders());
        
        setMessage({ type: 'success', text: `Zgłoszono nieobecność na dzień ${formatDisplayDate(date)}.` });
      } 
      else if (type === 'remove') {
        await axios.delete(`http://127.0.0.1:8000/api/attendance/${recordId}/`, getAuthHeaders());
        
        setMessage({ type: 'info', text: `Cofnięto zgłoszenie na dzień ${formatDisplayDate(date)}.` });
      }

      fetchAttendance();
    } catch (err) {
      const errorMsg = err.response?.data?.non_field_errors?.[0] || 'Wystąpił błąd.';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const isTileDisabled = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = formatDate(date);
      if (date.getDay() === 0 || date.getDay() === 6) return true;
      if (closures.includes(dateStr)) return true;
    }
    return false;
  };

  const getTileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = formatDate(date);
      if (absencesMap.hasOwnProperty(dateStr)) return 'absent-day';
      if (closures.includes(dateStr)) return 'closure-day';
      if (date.getDay() === 0 || date.getDay() === 6) return 'weekend-day';
    }
  };

  if (loading) return <div style={{padding: 20}}>Ładowanie... 🐝</div>;

  return (
    <div className="attendance-container">
      <div className="page-title">
        <FaUserSlash /> Zgłoś Nieobecność
      </div>

      {children.length > 1 && (
        <div className="child-selector">
          <label>Wybierz dziecko:</label>
          <div className="child-buttons">
            {children.map(child => (
              <button 
                key={child.id}
                className={`child-btn ${selectedChild === child.id ? 'active' : ''}`}
                onClick={() => setSelectedChild(child.id)}
              >
                <FaChild /> {child.first_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="attendance-grid">
        <div className="calendar-card">
          <Calendar 
            onClickDay={handleDayClick}
            tileClassName={getTileClassName}
            tileDisabled={isTileDisabled}
            locale="pl-PL"
            minDate={new Date(new Date().getFullYear(), new Date().getMonth(), 1)} 
          />
          
          {/* ZAKTUALIZOWANA LEGENDA */}
          <div className="calendar-legend">
            <span className="legend-item"><span className="dot green"></span> Obecny</span>
            <span className="legend-item"><span className="dot orange"></span> Nieobecny</span>
            <span className="legend-item"><span className="dot red"></span> Dzień wolny</span>
            <span className="legend-item"><span className="dot crossed"></span> Weekend</span>
          </div>
        </div>

        <div className="status-panel">
          <div className="info-box">
            <h4><FaExclamationTriangle /> Zasady</h4>
            <ul>
              <li>Domyślnie system uznaje dziecko za obecne.</li>
              <li>Kliknij w dzień roboczy, aby zgłosić nieobecność.</li>
              <li><strong>Kliknij ponownie w czerwony dzień, aby cofnąć zgłoszenie.</strong></li>
              <li>Weekendy i dni wolne są zablokowane.</li>
              <li>Na bieżący dzień zmiany możliwe do <strong>godz. 08:00</strong>.</li>
            </ul>
          </div>

          {message.text && (
            <div className={`status-message ${message.type}`}>
              {message.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
              <span>{message.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL POTWIERDZENIA --- */}
      {modal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Potwierdzenie</h3>
            <p>
              {modal.type === 'add' 
                ? `Czy na pewno chcesz ZGŁOSIĆ nieobecność w dniu ${formatDisplayDate(modal.date)}?`
                : `Czy na pewno chcesz COFNĄĆ zgłoszenie w dniu ${formatDisplayDate(modal.date)}?`
              }
            </p>
            
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModal({ ...modal, isOpen: false })}>
                Anuluj
              </button>
              
              <button 
                className={`modal-btn confirm ${modal.type === 'remove' ? 'danger' : 'success'}`} 
                onClick={confirmAction}
              >
                {modal.type === 'add' 
                  ? <><FaCalendarPlus /> Zgłoś</> 
                  : <><FaTrashAlt /> Cofnij zgłoszenie</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Attendance;