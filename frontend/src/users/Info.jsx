import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Info.css';
import { 
  FaMapMarkerAlt, 
  FaPhoneAlt, 
  FaClock, 
  FaUserTie, 
  FaUsers, 
  FaInfoCircle 
} from 'react-icons/fa';

const Info = () => {
  const [preschool, setPreschool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPreschool = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/preschool/', getAuthHeaders());
        // Jeśli jest tylko jeden rekord, bierzemy pierwszy
        setPreschool(Array.isArray(res.data) ? res.data[0] : res.data);
      } catch (err) {
        setError('Błąd pobierania danych przedszkola');
      } finally {
        setLoading(false);
      }
    };
    fetchPreschool();
  }, []);

  if (loading) return <div className="info-page-container"><div className="info-card-main">Ładowanie danych…</div></div>;
  if (error) return <div className="info-page-container"><div className="info-card-main">{error}</div></div>;
  if (!preschool) return <div className="info-page-container"><div className="info-card-main">Brak danych o przedszkolu.</div></div>;

  return (
    <div className="info-page-container">
      <div className="info-card-main">
        {/* Nagłówek */}
        <div className="info-header">
          <FaInfoCircle className="info-header-icon" />
          <h2>Informacje o Przedszkolu</h2>
        </div>
        <p className="info-intro">
          Witamy w systemie Przedszkola. Poniżej znajdują się kluczowe informacje organizacyjne oraz kontaktowe.
        </p>

        {/* SEKJA 1: Żółty box (Dane kontaktowe) */}
        <div className="info-highlight-box">
          <div className="info-row">
            <div className="icon-wrapper"><FaClock /></div>
            <div>
              <strong>Godziny otwarcia:</strong>
              <span>{preschool.opening_time_from?.slice(0,5)} - {preschool.opening_time_to?.slice(0,5)}</span>
            </div>
          </div>
          <div className="info-row">
            <div className="icon-wrapper"><FaPhoneAlt /></div>
            <div>
              <strong>Telefon:</strong>
              <span>{preschool.phone_number}</span>
            </div>
          </div>
          <div className="info-row">
            <div className="icon-wrapper"><FaMapMarkerAlt /></div>
            <div>
              <strong>Adres:</strong>
              <span>{preschool.street}, {preschool.postal_code} {preschool.city}</span>
            </div>
          </div>
          <div className="info-row">
            <div className="icon-wrapper"><FaInfoCircle /></div>
            <div>
              <strong>Email:</strong>
              <span>{preschool.email}</span>
            </div>
          </div>
        </div>

        <div className="info-columns">
          {/* SEKCJA 2: Dyrekcja */}
          <div className="info-column">
            <h3><FaUserTie /> Dyrekcja i Administracja</h3>
            <ul className="staff-list">
              {Array.isArray(preschool.directors) && preschool.directors.length > 0 ? (
                preschool.directors.map((name, idx) => (
                  <li key={idx}><strong>{name}</strong></li>
                ))
              ) : (
                <li>Brak danych o dyrekcji</li>
              )}
            </ul>
          </div>
          {/* SEKCJA 3: Grupy */}
          <div className="info-column">
            <h3><FaUsers /> Nasze Grupy</h3>
            <div className="groups-grid">
              <span className="group-badge group-myszki">🐭 Myszki</span>
              <span className="group-badge group-robaczki">🐛 Robaczki</span>
              <span className="group-badge group-misie">🐻 Misie</span>
              <span className="group-badge group-zajaczki">🐰 Zajączki</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Info;