// frontend/src/Settings.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';
import LoadingScreen from './LoadingScreen';
import { 
  FaLock, 
  FaEnvelope, 
  FaPhoneAlt, 
  FaCheck, 
  FaUser,
  FaUserCog
} from 'react-icons/fa';

const Settings = () => {
  const [currentData, setCurrentData] = useState({
    email: '',
    phone_number: '',
    username: ''
  });

  const [formData, setFormData] = useState({
    new_email: '',
    new_phone: '',
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  const fetchUserData = () => {
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => {
        setCurrentData({
          email: res.data.email || '',
          phone_number: res.data.phone_number || '',
          username: res.data.username
        });
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // --- FUNKCJA POMOCNICZA: MASKOWANIE NUMERU ---
  const getMaskedPhone = (phone) => {
    if (!phone) return 'Brak numeru';
    // Jeśli numer jest bardzo krótki, pokaż go w całości
    if (phone.length <= 3) return phone;
    
    // Zostawiamy 3 ostatnie znaki, resztę zamieniamy na gwiazdki
    const visiblePart = phone.slice(-3);
    const maskedPart = '*'.repeat(phone.length - 3);
    
    return `${maskedPart}${visiblePart}`;
  };

  const handleUpdateData = async (type) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    let payload = {};
    if (type === 'email' && formData.new_email) payload.email = formData.new_email;
    if (type === 'phone' && formData.new_phone) payload.phone_number = formData.new_phone;

    if (Object.keys(payload).length === 0) {
      setMessage({ type: 'error', text: 'Wpisz nową wartość przed zapisaniem.' });
      setLoading(false);
      return;
    }

    try {
      await axios.patch('http://127.0.0.1:8000/api/users/me/', payload, getAuthHeaders());
      setMessage({ type: 'success', text: 'Dane zostały zaktualizowane pomyślnie.' });
      
      fetchUserData(); 
      setFormData(prev => ({ ...prev, new_email: '', new_phone: '' }));

    } catch (err) {
      setMessage({ type: 'error', text: 'Błąd aktualizacji. Sprawdź poprawność danych.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.old_password || !passwordData.new_password) {
      setMessage({ type: 'error', text: 'Wypełnij pola hasła.' });
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'Nowe hasła nie są identyczne.' });
      // Czyścimy pola haseł, bo użytkownik się pomylił
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      return;
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.put('http://127.0.0.1:8000/api/users/change-password/', {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      }, getAuthHeaders());

      setMessage({ type: 'success', text: 'Hasło zostało zmienione.' });
      // Sukces -> czyścimy pola
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.old_password 
        ? "Podano błędne obecne hasło." 
        : "Hasło jest zbyt słabe lub wystąpił błąd.";
      setMessage({ type: 'error', text: errorMsg });
      
      // --- ZMIANA: Błąd -> czyścimy pola dla bezpieczeństwa ---
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Wczytywanie ustawień..." />;

  return (
    <div className="settings-page-wrapper">
      <h2 className="settings-main-title">
        <FaUserCog /> Ustawienia Konta
      </h2>

      {message.text && (
        <div className={`settings-alert ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* KARTA 1: ZMIANA HASŁA */}
      <div className="settings-wide-card">
        <div className="card-title">Zmień Hasło</div>
        
        <div className="inputs-grid">
          <div className="input-box">
            <FaLock className="field-icon" />
            <input 
              type="password" 
              placeholder="Obecne Hasło"
              value={passwordData.old_password}
              onChange={(e) => setPasswordData({...passwordData, old_password: e.target.value})}
            />
          </div>

          <div className="input-box">
            <FaLock className="field-icon" />
            <input 
              type="password" 
              placeholder="Nowe Hasło"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
            />
          </div>

          <div className="input-box">
            <FaCheck className="field-icon" />
            <input 
              type="password" 
              placeholder="Potwierdź Nowe Hasło"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
            />
          </div>
          
          <div className="button-container-right">
             <button className="honey-btn" onClick={handlePasswordChange} disabled={loading}>
                Zmień Hasło
             </button>
          </div>
        </div>
      </div>

      {/* KARTA 2: ADRES E-MAIL */}
      <div className="settings-wide-card">
        <div className="card-title">Zmień Adres E-mail</div>
        
        <div className="inputs-grid-2col">
          <div className="input-box read-only">
            <FaUser className="field-icon" />
            {/* Wyświetlamy email bez maskowania, to standard */}
            <input type="text" value={currentData.email} disabled />
            <span className="label-inside">Obecny</span>
          </div>

          <div className="input-box">
            <FaEnvelope className="field-icon" />
            <input 
              type="email" 
              placeholder="Nowy Adres E-mail"
              value={formData.new_email}
              onChange={(e) => setFormData({...formData, new_email: e.target.value})}
            />
          </div>
        </div>

        <button className="honey-btn btn-left" onClick={() => handleUpdateData('email')} disabled={loading}>
          Zapisz Zmianę E-maila
        </button>
      </div>

      {/* KARTA 3: NUMER TELEFONU */}
      <div className="settings-wide-card">
        <div className="card-title">Zmień Numer Telefonu</div>
        
        <div className="inputs-grid-2col">
          <div className="input-box read-only">
            <FaPhoneAlt className="field-icon" />
            {/* --- ZMIANA: Używamy funkcji maskującej --- */}
            <input 
              type="text" 
              value={getMaskedPhone(currentData.phone_number)} 
              disabled 
            />
            <span className="label-inside">Obecny</span>
          </div>

          <div className="input-box">
            <FaPhoneAlt className="field-icon" />
            <input 
              type="text" 
              placeholder="Nowy Numer Telefonu"
              value={formData.new_phone}
              onChange={(e) => setFormData({...formData, new_phone: e.target.value})}
            />
          </div>
        </div>

        <button className="honey-btn btn-left" onClick={() => handleUpdateData('phone')} disabled={loading}>
          Zapisz Zmianę Numeru
        </button>
      </div>

    </div>
  );
};

export default Settings;