// frontend/src/Login.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';
import LoadingScreen from './LoadingScreen';
import bgImage from './assets/bg.png';
import BeeIcon from './assets/bee-icon.png';
import padlockIcon from './assets/padlock-icon.png';
import { setToken } from './authUtils';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://127.0.0.1:8000/api-token-auth/', {
        username: username,
        password: password
      });

      // --- ZMIANA POCZĄTEK ---
      // Pobieramy token ORAZ flagę is_director z odpowiedzi serwera
      const { token, is_director } = response.data;

      // Zapisujemy token (używając funkcji z authUtils)
      setToken(token, rememberMe);
      
      // Logika przekierowania zależna od roli:
      if (is_director) {
        navigate('/director/dashboard'); // Dyrektor idzie do swojego panelu
      } else {
        navigate('/dashboard'); // Rodzic idzie do zwykłego dashboardu
      }
      // --- ZMIANA KONIEC ---

    } catch (err) {
      console.error(err);
      setError('Błędny login lub hasło. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Logowanie..." />;

  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="login-card">
        
        <div className="logo-section">
          <div className="bee-logo"></div>
          <div className="school-name">
            <span className="school-name-prefix">PRZEDSZKOLE</span>
            <span className="school-name-main">PSZCZÓŁKA MAJA</span>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleLogin}>
          
          <div className="input-group">
            <input 
              type="text" 
              placeholder="LOGIN / E-MAIL" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <span className="input-icon">
              <img src={BeeIcon} alt="user icon" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            </span> 
          </div>

          <div className="input-group">
            <input 
              type="password" 
              placeholder="HASŁO" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="input-icon">
              <img src={padlockIcon} alt="lock icon" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            </span> 
          </div>

          <div className="options-row">
            <label className="remember-me">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Zapamiętaj mnie
            </label>
            <Link to="/forgot-password" className="forgot-link">
              Nie pamiętasz hasła?
            </Link>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logowanie...' : 'ZALOGUJ SIĘ'}
          </button>
        </form>

        <div className="footer-links">
          <Link to="/regulamin" style={{ color: '#999', textDecoration: 'none' }}>Regulamin</Link>
          <Link to="/polityka-prywatnosci" style={{ color: '#999', textDecoration: 'none' }}>Polityka Prywatności</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;