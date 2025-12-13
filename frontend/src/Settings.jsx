// frontend/src/Settings.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Settings.css';
import LoadingScreen from './LoadingScreen';
import { 
  FaLock, FaEnvelope, FaPhoneAlt, FaCheck, FaUser, FaUserCog, 
  FaNotesMedical, FaChild, FaCamera 
} from 'react-icons/fa';

const Settings = () => {
  const [currentData, setCurrentData] = useState({
    email: '', phone_number: '', username: '', first_name: '', last_name: '', avatar: null
  });

  const [formData, setFormData] = useState({ new_email: '', new_phone: '' });
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [children, setChildren] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Ref do ukrytego inputa pliku
  const fileInputRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  const fetchUserData = () => {
    // 1. Użytkownik
    axios.get('http://127.0.0.1:8000/api/users/me/', getAuthHeaders())
      .then(res => {
        setCurrentData({
          email: res.data.email || '',
          phone_number: res.data.phone_number || '',
          username: res.data.username,
          first_name: res.data.first_name,
          last_name: res.data.last_name,
          avatar: res.data.avatar
        });
      })
      .catch(err => console.error(err));

    // 2. Dzieci
    axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders())
      .then(res => setChildren(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // --- OBSŁUGA ZMIANY AVATARA ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      setMessage({ type: 'error', text: 'Zdjęcie jest za duże (max 5MB).' });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await axios.patch('http://127.0.0.1:8000/api/users/me/', formData, {
        headers: { 
          Authorization: `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setMessage({ type: 'success', text: 'Zdjęcie profilowe zaktualizowane!' });
      fetchUserData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Błąd podczas wgrywania zdjęcia.' });
    } finally {
      setLoading(false);
    }
  };

  const getMaskedPhone = (phone) => {
    if (!phone) return 'Brak numeru';
    if (phone.length <= 3) return phone;
    return `${'*'.repeat(phone.length - 3)}${phone.slice(-3)}`;
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
        
        {/* KOLUMNA LEWA */}
        <div className="settings-column">
          
          {/* --- KARTA PROFILOWA (AVATAR) --- */ }
          <div className="settings-wide-card profile-card-centered">
            <div className="avatar-wrapper" onClick={() => fileInputRef.current.click()}>
              {currentData.avatar ? (
                <img 
                  src={getAvatarUrl(currentData.avatar)} 
                  alt="Avatar" 
                  className="settings-avatar-img" 
                />
              ) : (
                <div className="settings-avatar-placeholder">
                  {currentData.first_name ? currentData.first_name[0] : 'U'}
                </div>
              )}
              
              <div className="avatar-overlay">
                <FaCamera />
              </div>
            </div>
            {/* Ukryty input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleFileChange}
            />
            
            <h3 className="profile-name">{currentData.first_name} {currentData.last_name}</h3>
          </div>

          {/* HASŁO */}
          <div className="settings-wide-card">
            <div className="card-title">Zmień Hasło</div>
            <div className="inputs-grid">
              <div className="input-box"><FaLock className="field-icon" /><input type="password" placeholder="Obecne Hasło" value={passwordData.old_password} onChange={(e) => setPasswordData({...passwordData, old_password: e.target.value})} /></div>
              <div className="input-box"><FaLock className="field-icon" /><input type="password" placeholder="Nowe Hasło" value={passwordData.new_password} onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})} /></div>
              <div className="input-box"><FaCheck className="field-icon" /><input type="password" placeholder="Potwierdź" value={passwordData.confirm_password} onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})} /></div>
              <div className="button-container-right"><button className="honey-btn" onClick={handlePasswordChange}>Zmień</button></div>
            </div>
          </div>

          {/* DANE KONTAKTOWE */}
          <div className="settings-wide-card">
             <div className="card-title">Dane Kontaktowe</div>
             
             {/* Email */}
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaEnvelope className="field-icon"/><input value={currentData.email} disabled/></div>
                 <div className="input-box"><FaEnvelope className="field-icon"/><input placeholder="Nowy Email" value={formData.new_email} onChange={e => setFormData({...formData, new_email: e.target.value})}/></div>
             </div>
             <button className="honey-btn btn-left" onClick={() => handleUpdateData('email')}>Zapisz Email</button>
             
             <div className="spacer-20" style={{height: '30px'}}></div>

             {/* Telefon */}
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaPhoneAlt className="field-icon"/><input value={getMaskedPhone(currentData.phone_number)} disabled/></div>
                 <div className="input-box"><FaPhoneAlt className="field-icon"/><input placeholder="Nowy Telefon" value={formData.new_phone} onChange={e => setFormData({...formData, new_phone: e.target.value})}/></div>
             </div>
             <button className="honey-btn btn-left" onClick={() => handleUpdateData('phone')}>Zapisz Telefon</button>
          </div>
        </div>

        {/* KOLUMNA PRAWA (Dzieci) */}
        <div className="settings-column">
          {children.length > 0 ? (
            children.map(child => (
              <div key={child.id} className="settings-wide-card medical-card">
                 <div className="card-title" style={{display:'flex', alignItems:'center', gap:10}}>
                   <FaNotesMedical color="#e0245e"/> {child.first_name} {child.last_name}
                 </div>
                 <div className="medical-info-section">
                    <p className="medical-label">Informacje medyczne / Alergie:</p>
                    <textarea 
                      className="medical-textarea" 
                      value={child.medical_info||''} 
                      onChange={e => handleMedicalChange(child.id, e.target.value)} 
                      placeholder="Wpisz alergie, choroby, ważne uwagi..."
                    />
                    <div className="medical-footer">
                      <span className="medical-hint"><FaChild/> Dane widoczne dla dyrekcji.</span>
                      <button className="honey-btn" onClick={() => handleMedicalUpdate(child.id, child.medical_info)}>Zapisz</button>
                    </div>
                 </div>
              </div>
            ))
          ) : (
            <div className="settings-wide-card">
               <p style={{color: '#999', textAlign: 'center', padding: '20px'}}>Brak przypisanych dzieci.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Settings;