// frontend/src/YearlyCalendar.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Calendar.css'; // Upewnij się, że nazwa pliku CSS jest poprawna
import { 
  FaCalendarAlt, 
  FaChevronLeft, 
  FaChevronRight,
  FaInfoCircle
} from 'react-icons/fa';

const Calendar = () => {
  const [closures, setClosures] = useState({});
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const months = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  const daysHeader = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/calendar/closures/', getAuthHeaders());
        const closuresMap = {};
        res.data.forEach(item => {
          closuresMap[item.date] = item.reason;
        });
        setClosures(closuresMap);
      } catch (err) {
        console.error("Błąd pobierania dni wolnych:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentYear]);

  // --- LOGIKA DAT ---
  const getDaysInMonth = (monthIndex, year) => new Date(year, monthIndex + 1, 0).getDate();
  
  const getFirstWeekDay = (monthIndex, year) => {
    const day = new Date(year, monthIndex, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0=Pn, 6=Nd
  };

  const formatDateString = (year, monthIndex, day) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  if (loading) return <div style={{padding: 20}}>Ładowanie harmonogramu... 🐝</div>;

  return (
    <div className="yearly-container">
      
      <div className="page-title">
        <FaCalendarAlt /> Harmonogram Roczny
      </div>

      <div className="year-controls">
        <button className="nav-btn" onClick={() => setCurrentYear(currentYear - 1)}>
          <FaChevronLeft />
        </button>
        <div className="current-year-label">{currentYear}</div>
        <button className="nav-btn" onClick={() => setCurrentYear(currentYear + 1)}>
          <FaChevronRight />
        </button>
      </div>

      <div className="calendar-content-wrapper">
        
        {/* KOLUMNA LEWA: TABELA */}
        <div className="schedule-table">
          <div className="schedule-header-row">
            <div className="month-col-header">Miesiąc</div>
            <div className="days-grid-header">
              {daysHeader.map((d, i) => (
                <span key={i} className={i >= 5 ? 'weekend-header' : ''}>{d}</span>
              ))}
            </div>
          </div>

          {months.map((monthName, monthIndex) => {
            const daysCount = getDaysInMonth(monthIndex, currentYear);
            const firstDayOffset = getFirstWeekDay(monthIndex, currentYear);
            
            const blanks = Array.from({ length: firstDayOffset }, (_, i) => (
              <div key={`blank-${i}`} className="day-cell empty"></div>
            ));

            const days = Array.from({ length: daysCount }, (_, i) => {
              const day = i + 1;
              const dateStr = formatDateString(currentYear, monthIndex, day);
              const dateObj = new Date(currentYear, monthIndex, day);
              const dayOfWeek = dateObj.getDay();

              let classes = "day-cell";
              let tooltipText = null; // Zmienna na tekst dymka

              // 1. Dzień wolny
              if (closures[dateStr]) {
                classes += " closed";
                tooltipText = closures[dateStr]; // Przypisujemy powód
              } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                classes += " weekend";
              } else {
                classes += " open";
              }

              const todayStr = new Date().toISOString().split('T')[0];
              if (dateStr === todayStr) classes += " today";

              return (
                // Usunięto atrybut title={title}, aby nie dublować dymków
                <div key={day} className={classes}>
                  {day}
                  
                  {/* Renderujemy własny tooltip, jeśli jest tekst */}
                  {tooltipText && (
                    <span className="custom-tooltip">{tooltipText}</span>
                  )}
                </div>
              );
            });

            return (
              <div key={monthName} className="schedule-row">
                <div className="month-name-col">{monthName}</div>
                <div className="days-grid-col">
                  {blanks}
                  {days}
                </div>
              </div>
            );
          })}
        </div>

        {/* KOLUMNA PRAWA: LEGENDA */}
        <div className="legend-card">
          <h4>Legenda</h4>
          <div className="legend-list">
            <div className="legend-item">
              <span className="sample open"></span> Dni nauki
            </div>
            <div className="legend-item">
              <span className="sample weekend"></span> Weekendy
            </div>
            <div className="legend-item">
              <span className="sample closed"></span> Dni wolne
            </div>
            <div className="legend-item">
              <span className="sample today"></span> Dziś
            </div>
          </div>
          
          <div className="legend-info">
            <FaInfoCircle />
            <p>Najedź na czerwony dzień, aby zobaczyć powód.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Calendar;