import React from 'react';
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
  return (
    <div className="info-page-container">
      <div className="info-card-main">
        
        {/* Nagłówek */}
        <div className="info-header">
          <FaInfoCircle className="info-header-icon" />
          <h2>Informacje o Przedszkolu</h2>
        </div>
        
        <p className="info-intro">
          Witamy w systemie Przedszkola "Pszczółka Maja". 
          Poniżej znajdują się kluczowe informacje organizacyjne oraz kontaktowe.
        </p>

        {/* SEKJA 1: Żółty box (Dane kontaktowe) - Naprawiony kontrast */}
        <div className="info-highlight-box">
          <div className="info-row">
            <div className="icon-wrapper"><FaClock /></div>
            <div>
              <strong>Godziny otwarcia:</strong>
              <span>06:30 - 17:30</span>
            </div>
          </div>

          <div className="info-row">
            <div className="icon-wrapper"><FaPhoneAlt /></div>
            <div>
              <strong>Telefon:</strong>
              <span>+48 22 741 85 96</span>
            </div>
          </div>

          <div className="info-row">
            <div className="icon-wrapper"><FaMapMarkerAlt /></div>
            <div>
              <strong>Adres:</strong>
              <span>ul. Kąty Grodziskie 56, 03-289 Warszawa (Białołęka)</span>
            </div>
          </div>
        </div>

        <div className="info-columns">
          
          {/* SEKCJA 2: Dyrekcja */}
          <div className="info-column">
            <h3><FaUserTie /> Dyrekcja i Administracja</h3>
            <ul className="staff-list">
              <li><strong>Emil Krasnodębski</strong> - Dyrektor Generalny</li>
              <li><strong>Robert Krasnodębski</strong> - Zastępca Dyrektora</li>
              <li><strong>Monika Krasnodębska</strong> - Dyrektor Pedagogiczny</li>
              <li><strong>Janina Grzegórska</strong> - Kierownik Administracyjny</li>
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
              <span className="group-badge group-liski">🦊 Liski (Zerówka)</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Info;