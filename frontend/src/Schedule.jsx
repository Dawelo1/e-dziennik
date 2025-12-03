// frontend/src/Schedule.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Schedule.css';
import { 
  FaCalendarDay, 
  FaChevronLeft, 
  FaChevronRight, 
  FaUtensils,
  FaStar,
  FaClock
} from 'react-icons/fa';

const Schedule = () => {
  const [activities, setActivities] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // KONFIGURACJA SIATKI (30 min sloty)
  const START_HOUR = 6; // 6:00
  const END_HOUR = 18;  // 18:00
  const SLOTS_PER_HOUR = 2; // 30 min = 2 sloty na godzinę
  const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;

  // STAŁE POSIŁKI (Start, Duration w minutach)
  const fixedMeals = [
    { title: 'Śniadanie', start: '08:00', duration: 60, icon: <FaUtensils />, type: 'meal' },
    { title: 'Obiad', start: '12:00', duration: 60, icon: <FaUtensils />, type: 'meal' },
    { title: 'Podwieczorek', start: '15:00', duration: 30, icon: <FaUtensils />, type: 'meal' }
  ];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const monday = getMonday(currentDate);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const formatDateAPI = (date) => date.toISOString().split('T')[0];
  const formatDateDisplay = (date) => date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/calendar/activities/', getAuthHeaders());
        setActivities(res.data);
      } catch (err) {
        console.error("Błąd pobierania planu:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const changeWeek = (weeks) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setCurrentDate(newDate);
  };

  // --- LOGIKA POZYCJONOWANIA W GRIDZIE ---

  const timeToGridRow = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return (h - START_HOUR) * 2 + (m >= 30 ? 1 : 0) + 2; 
  };

  const durationToSpan = (durationMinutes) => {
    return Math.ceil(durationMinutes / 30);
  };

  const calculateDuration = (start, end) => {
    if (!end) return 60; 
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  };

  // --- GŁÓWNA LOGIKA ŁĄCZENIA I FILTROWANIA ---
  const getProcessedEvents = () => {
    const daysOfWeek = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      daysOfWeek.push({ dateObj: day, dateStr: formatDateAPI(day), events: [] });
    }

    daysOfWeek.forEach(day => {
      const occupiedSlots = new Set();

      // 1. Dodaj zajęcia SPECJALNE (Priorytet)
      const daysSpecialActivities = activities.filter(act => act.date === day.dateStr);
      
      daysSpecialActivities.forEach(act => {
        const rowStart = timeToGridRow(act.start_time);
        const duration = calculateDuration(act.start_time, act.end_time);
        const span = durationToSpan(duration);
        
        // Oznacz sloty jako zajęte
        const [startH, startM] = act.start_time.split(':').map(Number);
        let currentM = startH * 60 + startM;
        for(let k=0; k<duration; k+=30) {
           occupiedSlots.add(currentM);
           currentM += 30;
        }

        day.events.push({
          id: `act-${act.id}`,
          title: act.title,
          icon: <FaStar />,
          type: 'activity',
          rowStart: rowStart,
          span: span,
          timeLabel: `${act.start_time.slice(0,5)} - ${act.end_time ? act.end_time.slice(0,5) : '?'}`
        });
      });

      // 2. Dodaj POSIŁKI (Jeśli brak kolizji)
      fixedMeals.forEach(meal => {
        const [h, m] = meal.start.split(':').map(Number);
        const mealStartInMinutes = h * 60 + m;
        
        let collision = false;
        for(let k=0; k<meal.duration; k+=30) {
          if (occupiedSlots.has(mealStartInMinutes + k)) {
            collision = true;
            break;
          }
        }

        if (!collision) {
          day.events.push({
            id: `meal-${meal.title}`,
            title: meal.title,
            icon: meal.icon,
            type: 'meal',
            rowStart: timeToGridRow(meal.start),
            span: durationToSpan(meal.duration),
            timeLabel: meal.start
          });
        }
      });
    });

    return daysOfWeek;
  };

  const scheduleData = getProcessedEvents();

  if (loading) return <div style={{padding: 20}}>Ładowanie planu... 🐝</div>;

  return (
    <div className="schedule-container">
      
      <h2 className="page-title">
        <FaCalendarDay /> Plan Zajęć
      </h2>

      <div className="week-navigation-card">
        <button className="nav-btn" onClick={() => changeWeek(-1)}>
          <FaChevronLeft /> Poprzedni
        </button>
        <div className="current-week-label">
          {formatDateDisplay(monday)} - {formatDateDisplay(friday)}
        </div>
        <button className="nav-btn" onClick={() => changeWeek(1)}>
          Następny <FaChevronRight />
        </button>
      </div>

      <div className="timetable-wrapper">
        <div className="timetable-grid">
          
          {/* 1. Narożnik */}
          <div className="time-header-corner"><FaClock /></div>

          {/* 2. Nagłówki Dni (Pn-Pt) */}
          {scheduleData.map((day, i) => (
            <div key={i} className={`day-header ${day.dateStr === formatDateAPI(new Date()) ? 'today' : ''}`}>
              <div className="dh-name">{day.dateObj.toLocaleDateString('pl-PL', { weekday: 'long' })}</div>
              <div className="dh-date">{day.dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })}</div>
            </div>
          ))}

          {/* 3. Kolumna Godzin (Lewa) */}
          {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
            if (i % 2 === 0) {
              const hour = START_HOUR + (i / 2);
              return (
                <div 
                  key={`time-${hour}`} 
                  className="time-slot-label" 
                  style={{ gridRow: `${i + 2} / span 2` }}
                >
                  {hour}:00
                </div>
              );
            }
            return null;
          })}

          {/* 4. Linie Siatki (Tło) - Z DODANĄ LOGIKĄ DNI ZAMKNIĘTYCH */}
          {Array.from({ length: 5 }).map((_, colIndex) => (
             Array.from({ length: TOTAL_SLOTS }).map((_, rowIndex) => {
               
               // Sprawdzenie: Czy to slot zamknięty (Przed 6:30 lub po 17:30)?
               // Indeks 0 = 06:00-06:30
               // Indeks 23 = 17:30-18:00 (Ostatni slot)
               const isClosed = rowIndex === 0 || rowIndex === TOTAL_SLOTS - 1;

               return (
                 <div 
                   key={`grid-${colIndex}-${rowIndex}`} 
                   className={`grid-cell-bg ${rowIndex % 2 !== 0 ? 'half-hour' : ''} ${isClosed ? 'closed-hours' : ''}`}
                   style={{ 
                     gridColumn: colIndex + 2, 
                     gridRow: rowIndex + 2 
                   }}
                 />
               );
             })
          ))}

          {/* 5. WYDARZENIA */}
          {scheduleData.map((day, dayIndex) => (
            day.events.map(event => (
              <div
                key={event.id}
                className={`event-item-grid ${event.type}`}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${event.rowStart} / span ${event.span}`
                }}
                title={event.title}
              >
                <div className="ev-time">{event.timeLabel}</div>
                <div className="ev-content">
                  <span className="ev-icon">{event.icon}</span>
                  <span className="ev-title">{event.title}</span>
                </div>
              </div>
            ))
          ))}

        </div>
      </div>
    </div>
  );
};

export default Schedule;