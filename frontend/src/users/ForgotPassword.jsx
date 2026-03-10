import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Login.css';
import bgImage from '../assets/bg.png';
import { FaEnvelope } from 'react-icons/fa';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      // Backend (Django) oczekuje klucza "email"
      await axios.post('/api/users/password_reset/', {
        email: email
      });
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      
      // Sprawdzamy co odpowiedział backend, lub ustawiamy własny komunikat
      if (err.response && err.response.data && err.response.data.email) {
         // Czasami backend zwraca listę błędów, bierzemy pierwszy
         setErrorMessage(err.response.data.email[0]);
      } else {
         setErrorMessage('Nie znaleziono użytkownika o podanym loginie lub e-mailu.');
      }
    }
  };

  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})` }}>

      {status === 'loading' && <LoadingScreen message="Wysyłanie linku..." />}

      <div className="login-card">
        
        {/* LOGO */}
        <div className="logo-section">
          <div className="bee-logo"></div>
          <div className="school-name">
            <span className="school-name-prefix">PRZEDSZKOLE</span>
            <span className="school-name-main">PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        {/* TYTUŁ */}
        <h3 style={{ color: '#444', marginBottom: '15px', textTransform: 'uppercase', fontSize: '18px', letterSpacing: '1px' }}>
          Przypomnienie hasła
        </h3>
        
        {/* WARUNEK SUKCESU */}
        {status === 'success' ? (
          <div style={{ marginTop: '20px', color: '#2e7d32', lineHeight: '1.6' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📩</div>
            <p style={{ fontWeight: 'bold', fontSize: '16px' }}>Link został wysłany!</p>
            <p style={{ fontSize: '14px', color: '#555' }}>
              Sprawdź skrzynkę pocztową (również SPAM).<br/>
              Wysłaliśmy instrukcję resetowania hasła na adres powiązany z tym kontem.
            </p>
            <div style={{ marginTop: '30px' }}>
                <Link to="/" className="login-btn" style={{ textDecoration: 'none', display: 'inline-block', width: 'auto', padding: '12px 30px' }}>
                  Wróć do logowania
                </Link>
            </div>
          </div>
        ) : (
          /* FORMULARZ */
          <>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '25px', lineHeight: '1.4', padding: '0 10px' }}>
              Wprowadź swój <b>login</b> lub <b>adres e-mail</b>, a wyślemy Ci link do zresetowania hasła.
            </p>

            {/* --- TUTAJ JEST CZERWONY KOMUNIKAT BŁĘDU --- */}
            {status === 'error' && (
              <div className="error-msg">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="LOGIN / ADRES E-MAIL" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <span className="input-icon"><FaEnvelope /></span>
              </div>

              <button type="submit" className="login-btn" disabled={status === 'loading'}>
                {status === 'loading' ? 'SPRAWDZANIE...' : 'WYŚLIJ LINK'}
              </button>
            </form>

            <div className="footer-links" style={{ marginTop: '30px' }}>
              <Link to="/" className="forgot-link" style={{ fontSize: '13px', fontWeight: '600' }}>
                 &larr; Anuluj i wróć do logowania
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;