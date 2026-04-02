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
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [preschoolRes, groupsRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/preschool/', getAuthHeaders()),
          axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders()),
        ]);
        setPreschool(Array.isArray(preschoolRes.data) ? preschoolRes.data[0] : preschoolRes.data);
        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      } catch (err) {
        setError('Błąd pobierania danych przedszkola lub grup');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
              {groups.length > 0 ? (
                groups.map((group) => {
                  // Wyciągnij emoji jeśli jest na początku nazwy
                  const emojiMatch = group.name.match(/^([\p{Emoji}\p{So}\p{Sk}\p{P}\p{S}]{1,2})/u);
                  const emoji = emojiMatch ? emojiMatch[1] : '';
                  const cleanName = group.name.replace(/^([\p{Emoji}\p{So}\p{Sk}\p{P}\p{S}]{1,2})/u, '').trim();
                  return (
                    <span
                      key={group.id}
                      className={`group-badge group-color-${group.color_key || 'default'}`}
                      title={group.name}
                    >
                      <span style={{fontSize: '1.3em', marginRight: cleanName ? 6 : 0}}>{emoji}</span>
                      {cleanName}
                    </span>
                  );
                })
              ) : (
                <span>Brak danych o grupach</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Info;