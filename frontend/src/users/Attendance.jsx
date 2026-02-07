// frontend/src/Attendance.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Attendance.css';
import { FaUserSlash, FaChild, FaExclamationTriangle, FaCheckCircle, FaTrashAlt, FaCalendarPlus } from 'react-icons/fa';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from '../authUtils';

const Attendance = () => {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  
  const [absencesMap, setAbsencesMap] = useState({});
  
  // ZMIANA: closures to teraz obiekt { "YYYY-MM-DD": "Powód" }
  const [closuresMap, setClosuresMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [modal, setModal] = useState({
    isOpen: false, type: null, date: null, recordId: null
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const childrenRes = await axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders());
        setChildren(childrenRes.data);
        if (childrenRes.data.length > 0) setSelectedChild(childrenRes.data[0].id);

        const closuresRes = await axios.get('http://127.0.0.1:8000/api/calendar/closures/', getAuthHeaders());
        
        // ZMIANA: Mapujemy listę na obiekt { data: powód }
        const map = {};
        closuresRes.data.forEach(item => {
          map[item.date] = item.reason;
        });
        setClosuresMap(map);

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

  const formatDate = (date) => {
    const offset = date.getTimezoneOffset();
    const dateObj = new Date(date.getTime() - (offset * 60 * 1000));
    return dateObj.toISOString().split('T')[0];
  };

  // Helper do wyświetlania daty w modalu (DD.MM.YYYY)
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

    // 1. Sprawdzamy czy to dzień wolny (bo teraz są klikalne!)
    if (closuresMap[dateStr]) {
      setMessage({ 
        type: 'info', 
        text: `To dzień wolny od zajęć: "${closuresMap[dateStr]}". Nie musisz zgłaszać nieobecności.` 
      });
      return; // Przerywamy, nie otwieramy modala
    }

    // Walidacja czasu
    if (dateStr < todayStr) {
      setMessage({ type: 'error', text: 'Nie można modyfikować obecności wstecz.' });
      return;
    }
    if (dateStr === todayStr && now.getHours() >= 7) {
      setMessage({ type: 'error', text: 'Zmiany na dzisiaj możliwe tylko do godz. 7:00.' });
      return;
    }

    const existingRecordId = absencesMap[dateStr];

    if (existingRecordId) {
      setModal({ isOpen: true, type: 'remove', date: dateStr, recordId: existingRecordId });
    } else {
      setModal({ isOpen: true, type: 'add', date: dateStr, recordId: null });
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
      setMessage({ type: 'error', text: 'Wystąpił błąd podczas wysyłania.' });
    }
  };

  // LOGIKA BLOKOWANIA (DISABLED)
  const isTileDisabled = ({ date, view }) => {
    if (view === 'month') {
      // Blokujemy TYLKO weekendy.
      // Dni wolne (closures) zostawiamy odblokowane, żeby działał hover (dymek z powodem)
      if (date.getDay() === 0 || date.getDay() === 6) return true;
    }
    return false;
  };

  // LOGIKA WYGLĄDU (KLASY CSS)
  const getTileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = formatDate(date);
      if (absencesMap.hasOwnProperty(dateStr)) return 'absent-day';
      if (closuresMap.hasOwnProperty(dateStr)) return 'closure-day'; // Sprawdzamy klucz w obiekcie
      if (date.getDay() === 0 || date.getDay() === 6) return 'weekend-day';
    }
  };

  // NOWOŚĆ: ZAWARTOŚĆ KAFELKA (TOOLTIP)
  const getTileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = formatDate(date);
      // Jeśli to dzień wolny, dodajemy niewidzialną warstwę z tytułem (tooltipem)
      if (closuresMap[dateStr]) {
        return (
          <div 
            className="closure-tooltip-layer" 
            title={closuresMap[dateStr]} /* To wyświetli dymek systemowy */
          >
          </div>
        );
      }
    }
    return null;
  };

  if (loading) return <LoadingScreen message="Wczytywanie obecności..." />;

  return (
    <div className="attendance-container">
      <h2 className="page-title">
        <FaUserSlash /> Zgłoś Nieobecność
      </h2>

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
            tileContent={getTileContent} // <--- Podpinamy logikę contentu
            locale="pl-PL"
            minDate={new Date(new Date().getFullYear(), new Date().getMonth(), 1)} 
          />
          
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
              <li>Kliknij w dzień roboczy, aby zgłosić nieobecność.</li>
              <li>Najedź na czerwony dzień, aby zobaczyć powód wolnego.</li>
              <li>Weekendy są zablokowane.</li>
              <li>Na bieżący dzień zmiany możliwe do <strong>godz. 07:00</strong>.</li>
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
              <button className="modal-btn cancel" onClick={() => setModal({ ...modal, isOpen: false })}>Anuluj</button>
              <button className={`modal-btn confirm ${modal.type === 'remove' ? 'danger' : 'success'}`} onClick={confirmAction}>
                {modal.type === 'add' ? <><FaCalendarPlus /> Zgłoś</> : <><FaTrashAlt /> Cofnij zgłoszenie</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;