import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getActiveChildId, getAuthHeaders, setActiveChildId } from '../authUtils';
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
  const [activeChildGroup, setActiveChildGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const teachersList = (activeChildGroup?.teachers_info || '')
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [preschoolRes, groupsRes, childrenRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/preschool/', getAuthHeaders()),
          axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders()),
          axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders()),
        ]);

        const fetchedGroups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
        const fetchedChildren = Array.isArray(childrenRes.data) ? childrenRes.data : [];

        setPreschool(Array.isArray(preschoolRes.data) ? preschoolRes.data[0] : preschoolRes.data);
        setGroups(fetchedGroups);

        if (fetchedChildren.length > 0) {
          const persistedChildId = getActiveChildId();
          const selectedChild = fetchedChildren.find((child) => child.id === persistedChildId) || fetchedChildren[0];

          if (!persistedChildId || selectedChild.id !== persistedChildId) {
            setActiveChildId(selectedChild.id);
          }

          setActiveChildGroup(fetchedGroups.find((group) => group.id === selectedChild.group) || null);
        } else {
          setActiveChildGroup(null);
        }
      } catch (err) {
        setError('Błąd pobierania danych przedszkola, grup lub dzieci');
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
          {/* SEKCJA 3: Wychowawcy */}
          <div className="info-column">
            <h3>
              <FaUserTie /> Wychowawcy grupy "{activeChildGroup?.name || 'Brak grupy'}"
            </h3>
            <ul className="staff-list">
              {teachersList.length > 0 ? (
                teachersList.map((teacher, idx) => (
                  <li key={idx}><strong>{teacher}</strong></li>
                ))
              ) : (
                <li>Brak informacji o nauczycielach tej grupy</li>
              )}
            </ul>
          </div>
        </div>

        <div className="info-groups-section">
          <h3><FaUsers /> Nasze Grupy</h3>
          <div className="groups-grid">
            {groups.length > 0 ? (
              groups.map((group) => {
                const isActiveChildGroup = Boolean(activeChildGroup && group.id === activeChildGroup.id);
                const legacyEmojiMatch = (group.name || '').match(/^([^\p{L}\p{N}]+)/u);
                const emoji = (group.emoji || (legacyEmojiMatch ? legacyEmojiMatch[1] : '') || '').trim();
                const cleanName = group.emoji
                  ? (group.name || '')
                  : (group.name || '').replace(/^([^\p{L}\p{N}]+)/u, '').trim();
                return (
                  <span
                    key={group.id}
                    className={`group-badge group-color-${group.color_key || 'default'} ${isActiveChildGroup ? 'group-badge-active-child' : ''}`}
                    title={group.name}
                  >
                    <span style={{fontSize: '1.3em'}}>{emoji}</span>
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
  );
};

export default Info;