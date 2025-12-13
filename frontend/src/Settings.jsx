// frontend/src/Settings.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';
import LoadingScreen from './LoadingScreen';
import { 
  FaLock, FaEnvelope, FaPhoneAlt, FaCheck, FaUser, FaUserCog, 
  FaNotesMedical, FaChild 
} from 'react-icons/fa';

const Settings = () => {
  const [currentData, setCurrentData] = useState({
    email: '',
    phone_number: '',
    username: ''
  });

  const [formData, setFormData] = useState({ new_email: '', new_phone: '' });
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  
  // NOWY STAN: DZIECI
  const [children, setChildren] = useState([]);
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  const fetchUserData = () => {
    // 1. Pobierz dane usera
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => {
        setCurrentData({
          email: res.data.email || '',
          phone_number: res.data.phone_number || '',
          username: res.data.username
        });
      })
      .catch(err => console.error(err));

    // 2. Pobierz dzieci (do edycji medycznej)
    axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders())
      .then(res => {
        setChildren(res.data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const getMaskedPhone = (phone) => {
    if (!phone) return 'Brak numeru';
    if (phone.length <= 3) return phone;
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
      setMessage({ type: 'error', text: 'Błąd aktualizacji.' });
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
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.old_password 
        ? "Podano błędne obecne hasło." 
        : "Hasło jest zbyt słabe lub wystąpił błąd.";
      setMessage({ type: 'error', text: errorMsg });
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } finally {
      setLoading(false);
    }
  };

  // --- NOWA FUNKCJA: Zapisywanie info medycznego ---
  const handleMedicalUpdate = async (childId, newInfo) => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.patch(`http://127.0.0.1:8000/api/children/${childId}/`, {
        medical_info: newInfo
      }, getAuthHeaders());
      
      setMessage({ type: 'success', text: 'Informacje medyczne zaktualizowane.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Błąd podczas zapisu danych medycznych.' });
    } finally {
      setLoading(false);
    }
  };

  // Helper do aktualizacji stanu lokalnego podczas pisania w textarea
  const handleMedicalChange = (childId, value) => {
    setChildren(prev => prev.map(child => 
      child.id === childId ? { ...child, medical_info: value } : child
    ));
  };

  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

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

      <div className="settings-grid">
        
        {/* KOLUMNA LEWA: HASŁO + DANE KONTAKTOWE */}
        <div className="settings-column">
          
          {/* HASŁO */}
          <div className="settings-wide-card">
            <div className="card-title">Zmień Hasło</div>
            <div className="inputs-grid">
              <div className="input-box">
                <FaLock className="field-icon" />
                <input 
                  type="password" placeholder="Obecne Hasło"
                  value={passwordData.old_password}
                  onChange={(e) => setPasswordData({...passwordData, old_password: e.target.value})}
                />
              </div>
              <div className="input-box">
                <FaLock className="field-icon" />
                <input 
                  type="password" placeholder="Nowe Hasło"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                />
              </div>
              <div className="input-box">
                <FaCheck className="field-icon" />
                <input 
                  type="password" placeholder="Potwierdź Nowe Hasło"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                />
              </div>
              <div className="button-container-right">
                 <button className="honey-btn" onClick={handlePasswordChange}>Zmień Hasło</button>
              </div>
            </div>
          </div>

          {/* EMAIL */}
          <div className="settings-wide-card">
            <div className="card-title">Zmień Adres E-mail</div>
            <div className="inputs-grid-2col">
              <div className="input-box read-only">
                <FaUser className="field-icon" />
                <input type="text" value={currentData.email} disabled />
                <span className="label-inside">Obecny</span>
              </div>
              <div className="input-box">
                <FaEnvelope className="field-icon" />
                <input 
                  type="email" placeholder="Nowy Adres E-mail"
                  value={formData.new_email}
                  onChange={(e) => setFormData({...formData, new_email: e.target.value})}
                />
              </div>
            </div>
            <button className="honey-btn btn-left" onClick={() => handleUpdateData('email')}>Zapisz Zmianę E-maila</button>
          </div>

          {/* TELEFON */}
          <div className="settings-wide-card">
            <div className="card-title">Zmień Numer Telefonu</div>
            <div className="inputs-grid-2col">
              <div className="input-box read-only">
                <FaPhoneAlt className="field-icon" />
                <input type="text" value={getMaskedPhone(currentData.phone_number)} disabled />
                <span className="label-inside">Obecny</span>
              </div>
              <div className="input-box">
                <FaPhoneAlt className="field-icon" />
                <input 
                  type="text" placeholder="Nowy Numer Telefonu"
                  value={formData.new_phone}
                  onChange={(e) => setFormData({...formData, new_phone: e.target.value})}
                />
              </div>
            </div>
            <button className="honey-btn btn-left" onClick={() => handleUpdateData('phone')}>Zapisz Zmianę Numeru</button>
          </div>
        </div>

        {/* KOLUMNA PRAWA: DANE MEDYCZNE DZIECI */}
        <div className="settings-column">
          
          {children.length > 0 ? (
            children.map(child => (
              <div key={child.id} className="settings-wide-card medical-card">
                <div className="card-title" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <FaNotesMedical color="#e0245e" />
                  {child.first_name} {child.last_name}
                </div>
                
                <div className="medical-info-section">
                  <p className="medical-label">Informacje medyczne / Alergie / Leki:</p>
                  <textarea 
                    className="medical-textarea"
                    placeholder="Wpisz tutaj alergie, choroby przewlekłe lub inne ważne informacje..."
                    value={child.medical_info || ''}
                    onChange={(e) => handleMedicalChange(child.id, e.target.value)}
                  />
                  <div className="medical-footer">
                    <span className="medical-hint"><FaChild /> Dane widoczne dla dyrekcji i wychowawców.</span>
                    <button className="honey-btn" onClick={() => handleMedicalUpdate(child.id, child.medical_info)}>
                      Zapisz Info
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
             <div className="settings-wide-card">
               <p style={{color: '#999', textAlign: 'center'}}>Brak przypisanych dzieci.</p>
             </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Settings;