import React, { useState } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

// Style i grafiki
import './Login.css';
import bgImage from './assets/bg.png';
import beeLogo from './assets/bee.png';
import { FaLock } from 'react-icons/fa';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // Pobieramy token z adresu URL
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // 1. Walidacja wstępna po stronie przeglądarki
    if (password !== confirmPassword) {
      setErrorMsg("Hasła nie są identyczne.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Hasło musi mieć minimum 8 znaków.");
      return;
    }

    if (!token) {
        setErrorMsg("Błąd: Brak tokena w adresie URL. Spróbuj kliknąć w link z maila ponownie.");
        return;
    }

    setStatus('loading');
    console.log("Wysyłanie nowego hasła..."); // Log dla debugowania

    try {
      // 2. Wysłanie do Django
      const response = await axios.post('http://127.0.0.1:8000/api/users/password_reset/confirm/', {
        token: token,
        password: password
      });
      
      console.log("Sukces:", response.data);
      setStatus('success');

    } catch (err) {
      console.error("Błąd resetowania:", err);
      setStatus('error');
      
      // 3. ULEPSZONA OBSŁUGA BŁĘDÓW
      if (err.response && err.response.data) {
         const data = err.response.data;
         
         // Sprawdzamy różne rodzaje błędów, które Django może zwrócić
         if (data.password) {
             // Np. "Hasło jest zbyt podobne do loginu"
             setErrorMsg(data.password[0]); 
         } else if (data.token) {
             setErrorMsg("Link jest nieprawidłowy lub wygasł.");
         } else if (data.detail) {
             setErrorMsg(data.detail);
         } else {
             // Jeśli błąd jest inny, wyświetlamy go w całości (dla debugowania)
             setErrorMsg(JSON.stringify(data));
         }
      } else {
         setErrorMsg("Wystąpił błąd połączenia z serwerem. Sprawdź czy backend działa.");
      }
    }
  };

  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="login-card">
        
        {/* LOGO */}
        <div className="logo-section">
          <img src={beeLogo} alt="Pszczółka Maja" className="bee-logo" />
          <div className="school-name">
            <span className="school-name-prefix">PRZEDSZKOLE</span>
            <span className="school-name-main">PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        <h3 style={{ color: '#444', marginBottom: '20px', textTransform: 'uppercase', fontSize: '18px' }}>
          Ustaw nowe hasło
        </h3>

        {/* EKRAN SUKCESU */}
        {status === 'success' ? (
          <div style={{ marginTop: '20px', color: '#2e7d32' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
            <p style={{ fontWeight: 'bold' }}>Hasło zostało zmienione!</p>
            <p>Możesz się teraz zalogować nowym hasłem.</p>
            <div style={{ marginTop: '30px' }}>
                <Link to="/" className="login-btn" style={{ textDecoration: 'none', display: 'inline-block', width: 'auto', padding: '12px 30px' }}>
                  Przejdź do logowania
                </Link>
            </div>
          </div>
        ) : (
          /* FORMULARZ */
          <>
            {/* Wyświetlanie błędów */}
            {errorMsg && (
                <div className="error-msg" style={{ wordBreak: 'break-word' }}>
                    ⚠️ {errorMsg}
                </div>
            )}
            
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                  <input 
                    type="password" 
                    placeholder="NOWE HASŁO" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span className="input-icon"><FaLock /></span>
                </div>

                <div className="input-group">
                  <input 
                    type="password" 
                    placeholder="POTWIERDŹ HASŁO" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <span className="input-icon"><FaLock /></span>
                </div>

                <button type="submit" className="login-btn" disabled={status === 'loading'}>
                  {status === 'loading' ? 'ZAPISYWANIE...' : 'ZAPISZ HASŁO'}
                </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;