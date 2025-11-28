import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Import stylów i obrazków
import './Login.css';
import bgImage from './assets/bg.jpeg';
import beeLogo from './assets/bee.jpeg';

// Import ikonek (jeśli zainstalowałeś react-icons)
import { FaUser, FaLock} from 'react-icons/fa'; 
// Jeśli nie masz react-icons, usuń import i usuń komponenty <Fa...> z kodu poniżej

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
      // 1. Strzał do Django po token
      // Login i hasło wysyłamy jako FormData lub JSON.
      // Django obtain_auth_token domyślnie oczekuje 'username' i 'password'
      const response = await axios.post('http://127.0.0.1:8000/api-token-auth/', {
        username: username,
        password: password
      });

      // 2. Jeśli sukces -> Zapisz token
      const token = response.data.token;
      localStorage.setItem('token', token);

      // 3. Sprawdź kim jestem (Dyrektor czy Rodzic) - Opcjonalne na tym etapie
      // ale przyda się do przekierowania. Na razie po prostu idziemy do panelu.
      console.log("Zalogowano! Token:", token);
      
      // Przekieruj na stronę główną (którą zaraz stworzymy)
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
          <img src={beeLogo} alt="Pszczółka Maja" className="bee-logo" />
          <div className="school-name">
            Przedszkole
            <span>PSZCZÓŁKA MAJA</span>
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
            {/* Ikona (opcjonalna) */}
            <span className="input-icon"><FaUser /></span> 
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
             {/* Ikona (opcjonalna) */}
            <span className="input-icon"><FaLock /></span>
          </div>

          {/* Opcje pod polami */}
          <div className="options-row">
            <label className="remember-me">
              <input type="checkbox" />
              Zapamiętaj mnie
            </label>
            <span className="forgot-link">Nie pamiętasz hasła?</span>
          </div>

          {/* Przycisk */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logowanie...' : 'ZALOGUJ SIĘ'}
          </button>
        </form>

        {/* Stopka */}
        <div className="footer-links">
          <span>Regulamin</span>
          <span>Polityka Prywatności</span>
        </div>
      </div>
    </div>
  );
};

export default Login;