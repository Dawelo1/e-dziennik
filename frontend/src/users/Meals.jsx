import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Meals.css';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from '../authUtils';
import {
  FaUtensils,
  FaChevronLeft,
  FaChevronRight,
  FaCoffee,
  FaDrumstickBite,
  FaAppleAlt,
  FaLeaf,
  FaInfoCircle
}
from 'react-icons/fa';

const ALLERGEN_CATALOG = [
  { name: 'Ziarna zbóż zawierające gluten', details: 'pszenica, żyto, jęczmień, owies, orkisz' },
  { name: 'Skorupiaki', details: 'krewetki, kraby, homary' },
  { name: 'Jaja i produkty pochodne' },
  { name: 'Ryby i produkty pochodne' },
  { name: 'Orzeszki ziemne', details: 'arachidowe' },
  { name: 'Soja i produkty pochodne' },
  { name: 'Mleko i produkty pochodne', details: 'łącznie z laktozą' },
  { name: 'Orzechy', details: 'migdały, orzechy włoskie, laskowe, nerkowca, pistacje' },
  { name: 'Seler i produkty pochodne' },
  { name: 'Gorczyca i produkty pochodne' },
  { name: 'Nasiona sezamu i produkty pochodne' },
  { name: 'Dwutlenek siarki i siarczyny', details: 'stężenia > 10mg/kg' },
  { name: 'Łubin i produkty pochodne' },
  { name: 'Mięczaki', details: 'małże, ostrygi, ślimaki' }
];

const Meals = () => {
  const [menuData, setMenuData] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAllergens, setShowAllergens] = useState(false);

  const getMonday = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const monday = getMonday(currentDate);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const todayReal = new Date();
  todayReal.setHours(0, 0, 0, 0);
  const currentRealMonday = getMonday(todayReal);

  const minAllowedDate = new Date(currentRealMonday);
  minAllowedDate.setDate(minAllowedDate.getDate() - 14);

  const isPrevDisabled = monday <= minAllowedDate;

  const formatDateAPI = (date) => {
    const d = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return d.toISOString().split('T')[0];
  };

  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = formatDateAPI(monday);
        const end = formatDateAPI(friday);

        const res = await axios.get(
          `http://127.0.0.1:8000/api/menu/?start_date=${start}&end_date=${end}`,
          getAuthHeaders()
        );
        setMenuData(res.data);
      } catch (err) {
        console.error('Błąd pobierania jadłospisu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentDate]);

  useEffect(() => {
    document.body.style.overflow = showAllergens ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAllergens]);

  useEffect(() => {
    if (!showAllergens) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowAllergens(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAllergens]);

  const changeWeek = (weeks) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setCurrentDate(newDate);
  };

  const formatDayHeader = (dateObj) => {
    const options = { weekday: 'long', day: 'numeric', month: 'numeric' };
    return dateObj.toLocaleDateString('pl-PL', options);
  };

  const daysOfWeek = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    daysOfWeek.push(day);
  }

  const getMenuForDay = (dateObj) => {
    const dateStr = formatDateAPI(dateObj);
    return menuData.find((m) => m.date === dateStr);
  };

  if (loading) return <LoadingScreen message="Wczytywanie jadłospisu..." />;

  return (
    <div className="meals-container">
      <h2 className="page-title">
        <FaUtensils /> Jadłospis
      </h2>

      <div className="week-navigation-card">
        <button
          className="nav-btn"
          onClick={() => changeWeek(-1)}
          disabled={isPrevDisabled}
          style={{
            opacity: isPrevDisabled ? 0.5 : 1,
            cursor: isPrevDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          <FaChevronLeft /> Poprzedni
        </button>

        <div className="current-week-label">
          {formatDateDisplay(monday)} - {formatDateDisplay(friday)}
        </div>

        <button className="nav-btn" onClick={() => changeWeek(1)}>
          Następny <FaChevronRight />
        </button>
      </div>

      <div className="meals-grid">
        {daysOfWeek.map((day) => {
          const menu = getMenuForDay(day);
          const isToday = formatDateAPI(new Date()) === formatDateAPI(day);

          return (
            <div key={day.toISOString()} className={`meal-card ${isToday ? 'today-card' : ''}`}>
              <div className="meal-card-header">
                <span className="day-name">{formatDayHeader(day)}</span>
                {isToday && <span className="today-badge">DZIŚ</span>}
              </div>

              {!menu ? (
                <div className="no-menu-info">
                  <FaInfoCircle /> Brak zaplanowanego jadłospisu.
                </div>
              ) : (
                <div className="meal-sections">
                  <div className="meal-row breakfast">
                    <div className="meal-icon"><FaCoffee /></div>
                    <div className="meal-details">
                      <div className="meal-label">Śniadanie</div>
                      {menu.breakfast_soup && <div>🥣 {menu.breakfast_soup}</div>}
                      {menu.breakfast_main_course && <div>🥪 {menu.breakfast_main_course}</div>}
                      {menu.breakfast_beverage && <div className="beverage">☕ {menu.breakfast_beverage}</div>}
                      {menu.breakfast_fruit && <div className="fruit">🍎 {menu.breakfast_fruit}</div>}
                    </div>
                  </div>

                  <div className="meal-row lunch">
                    <div className="meal-icon"><FaDrumstickBite /></div>
                    <div className="meal-details">
                      <div className="meal-label">Obiad</div>
                      {menu.lunch_soup && <div>🥣 {menu.lunch_soup}</div>}
                      {menu.lunch_main_course && <div>🍽️ {menu.lunch_main_course}</div>}
                      {menu.lunch_beverage && <div className="beverage">🥤 {menu.lunch_beverage}</div>}
                      {menu.lunch_fruit && <div className="fruit">🍌 {menu.lunch_fruit}</div>}
                    </div>
                  </div>

                  <div className="meal-row snack">
                    <div className="meal-icon"><FaAppleAlt /></div>
                    <div className="meal-details">
                      <div className="meal-label">Podwieczorek</div>
                      <div>{menu.fruit_break || '-'}</div>
                    </div>
                  </div>

                  {menu.allergens && (
                    <div className="allergens-box">
                      <FaLeaf /> <strong>Alergeny:</strong> {menu.allergens}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="allergens-toggle-tile">
          <button
            type="button"
            className="allergens-toggle-btn"
            onClick={() => setShowAllergens(true)}
          >
            <FaLeaf /> Spis alergenów
          </button>
        </div>
      </div>

      {showAllergens && (
        <div className="allergen-overlay" onClick={() => setShowAllergens(false)}>
          <div className="allergen-overlay-content" onClick={(event) => event.stopPropagation()}>
            <div className="allergen-overlay-header">
              <h3 className="allergen-catalog-title">
                <FaLeaf /> Spis alergenów
              </h3>
              <button
                type="button"
                className="allergen-close-btn"
                onClick={() => setShowAllergens(false)}
              >
                Zamknij
              </button>
            </div>

            <ol className="allergen-catalog-list">
              {ALLERGEN_CATALOG.map((allergen) => (
                <li key={allergen.name}>
                  <span className="allergen-name">{allergen.name}</span>
                  {allergen.details ? ` (${allergen.details}).` : '.'}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default Meals;
