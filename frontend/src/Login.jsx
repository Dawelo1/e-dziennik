import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

// Import stylów
import './Login.css';

// Import obrazków (Upewnij się, że nazwy plików i rozszerzenia .png/.jpeg są poprawne!)
import bgImage from './assets/bg.png';        // Tło
import BeeIcon from './assets/bee-icon.png'; // Mała ikona do pola input
import padlockIcon from './assets/padlock-icon.png'; // Ikona kłódki do pola hasła

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Logowanie do Django
      const response = await axios.post('http://127.0.0.1:8000/api-token-auth/', {
        username: username,
        password: password
      });

      // 2. Zapisz token
      const token = response.data.token;
      localStorage.setItem('token', token);

      console.log("Zalogowano! Token:", token);
      
      // 3. Przekierowanie
      navigate('/dashboard');

    } catch (err) {
      console.error(err);
      setError('Błędny login lub hasło. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="login-card">
        
        {/* Sekcja Logo */}
        <div className="logo-section">
          <div className="bee-logo"></div>
          <div className="school-name">
            <span className="school-name-prefix">PRZEDSZKOLE</span>
            <span className="school-name-main">PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        {/* Komunikat błędu */}
        {error && <div className="error-msg">{error}</div>}

        {/* Formularz */}
        <form onSubmit={handleLogin}>
          
          {/* Pole Login/Email */}
          <div className="input-group">
            <input 
              type="text" 
              placeholder="LOGIN / E-MAIL" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            
            {/* --- TUTAJ JEST ZMIANA: Własna ikona PNG --- */}
            <span className="input-icon">
              <img 
                src={BeeIcon} 
                alt="user icon" 
                style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
              />
            </span> 
          </div>

          {/* Pole Hasło */}
          <div className="input-group">
            <input 
              type="password" 
              placeholder="HASŁO" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
             {/* Ikona kłódki z biblioteki */}
            <span className="input-icon">
              <img 
                src={padlockIcon} 
                alt="user icon" 
                style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
              />
            </span> 
          </div>

          {/* Opcje pod polami */}
          <div className="options-row">
            <label className="remember-me">
              <input type="checkbox" />
              Zapamiętaj mnie
            </label>
            <Link to="/forgot-password" className="forgot-link">
              Nie pamiętasz hasła?
            </Link>
          </div>

          {/* Przycisk */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logowanie...' : 'ZALOGUJ SIĘ'}
          </button>
        </form>

        {/* Stopka */}
        <div className="footer-links">
          {/* Zamieniamy <span> na <Link> */}
          <Link to="/regulamin" style={{ color: '#999', textDecoration: 'none' }}>
            Regulamin
          </Link>
          <Link to="/polityka-prywatnosci" style={{ color: '#999', textDecoration: 'none' }}>
            Polityka Prywatności
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;