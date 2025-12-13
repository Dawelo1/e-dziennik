// frontend/src/Settings.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Settings.css';
import LoadingScreen from './LoadingScreen';
import { 
  FaLock, FaEnvelope, FaPhoneAlt, FaCheck, FaUser, FaUserCog, 
  FaNotesMedical, FaChild, FaCamera, FaTrashAlt 
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

    axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders())
      .then(res => setChildren(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => { fetchUserData(); }, []);

  // --- ZMIANA AVATARA ---
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
      setMessage({ type: 'error', text: 'Błąd podczas wgrywania zdjęcia.' });
    } finally {
      setLoading(false);
    }
  };

  // --- USUWANIE AVATARA ---
  const handleDeleteAvatar = async () => {
    if (!window.confirm("Czy na pewno chcesz usunąć zdjęcie profilowe?")) return;

    setLoading(true);
    try {
      // Wysyłamy specjalny sygnał 'DELETE' (obsłużony w views.py)
      await axios.patch('http://127.0.0.1:8000/api/users/me/', { avatar: 'DELETE' }, getAuthHeaders());
      setMessage({ type: 'success', text: 'Zdjęcie profilowe usunięte.' });
      fetchUserData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Błąd podczas usuwania zdjęcia.' });
    } finally {
      setLoading(false);
    }
  };

  // --- AKTUALIZACJA DANYCH (Email/Telefon) ---
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

  const getMaskedPhone = (phone) => {
    if (!phone) return 'Brak numeru';
    if (phone.length <= 3) return phone;
    return `${'*'.repeat(phone.length - 3)}${phone.slice(-3)}`;
  };

  // ... (handlePasswordChange, handleMedicalUpdate, handleMedicalChange - BEZ ZMIAN) ...
  const handlePasswordChange = async () => { /* Skopiuj ze starego pliku lub zostaw jak jest */ 
    setLoading(true);
    try {
        await axios.put('http://127.0.0.1:8000/api/users/change-password/', passwordData, getAuthHeaders());
        setMessage({ type: 'success', text: 'Hasło zmienione.' });
        setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch(e) { setMessage({ type: 'error', text: 'Błąd zmiany hasła.' }); }
    finally { setLoading(false); }
  };
  
  const handleMedicalUpdate = async (childId, val) => {
      setLoading(true);
      try {
          await axios.patch(`http://127.0.0.1:8000/api/children/${childId}/`, { medical_info: val }, getAuthHeaders());
          setMessage({ type: 'success', text: 'Dane medyczne zapisane.' });
      } catch(e) { setMessage({ type: 'error', text: 'Błąd zapisu.' }); }
      finally { setLoading(false); }
  };
  
  const handleMedicalChange = (id, val) => {
      setChildren(prev => prev.map(c => c.id === id ? {...c, medical_info: val} : c));
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
        <div className="settings-column">
          
          {/* --- KARTA PROFILOWA (ZMODYFIKOWANA) --- */}
          <div className="settings-wide-card profile-card-centered">
            
            {/* 1. NOWY TYTUŁ */}
            <div className="card-title" style={{ width: '100%', textAlign: 'left' }}>Zdjęcie Profilowe</div>

            <div className="avatar-wrapper" onClick={() => fileInputRef.current.click()}>
              {currentData.avatar ? (
                <img src={getAvatarUrl(currentData.avatar)} alt="Avatar" className="settings-avatar-img" />
              ) : (
                <div className="settings-avatar-placeholder">
                  {currentData.first_name ? currentData.first_name[0] : 'U'}
                </div>
              )}
              <div className="avatar-overlay"><FaCamera /></div>
            </div>
            
            {/* Ukryty input */}
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            
            <h2 className="profile-name">{currentData.first_name} {currentData.last_name}</h2>

            {/* 2. PRZYCISK USUWANIA (tylko gdy jest avatar) */}
            {currentData.avatar && (
              <button className="delete-avatar-btn" onClick={handleDeleteAvatar}>
                <FaTrashAlt /> Usuń zdjęcie profilowe
              </button>
            )}
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

          {/* DANE KONTAKTOWE (POPRAWIONE PRZYCISKI) */}
          <div className="settings-wide-card">
             <div className="card-title">Dane Kontaktowe</div>
             
             {/* Email */}
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaEnvelope className="field-icon"/><input value={currentData.email} disabled/></div>
                 <div className="input-box"><FaEnvelope className="field-icon"/><input placeholder="Nowy Email" value={formData.new_email} onChange={e => setFormData({...formData, new_email: e.target.value})}/></div>
             </div>
             {/* 3. PRZYCISK PO PRAWEJ */}
             <div className="button-container-right">
                <button className="honey-btn" onClick={() => handleUpdateData('email')}>Zapisz Email</button>
             </div>
             
             <div className="spacer-20" style={{height: '30px'}}></div>

             {/* Telefon */}
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaPhoneAlt className="field-icon"/><input value={getMaskedPhone(currentData.phone_number)} disabled/></div>
                 <div className="input-box"><FaPhoneAlt className="field-icon"/><input placeholder="Nowy Telefon" value={formData.new_phone} onChange={e => setFormData({...formData, new_phone: e.target.value})}/></div>
             </div>
             {/* 3. PRZYCISK PO PRAWEJ */}
             <div className="button-container-right">
                <button className="honey-btn" onClick={() => handleUpdateData('phone')}>Zapisz Telefon</button>
             </div>
          </div>
        </div>

        {/* DZIECI */}
        <div className="settings-column">
          {children.map(child => (
            <div key={child.id} className="settings-wide-card medical-card">
               <div className="card-title" style={{display:'flex', alignItems:'center', gap:10}}>
                 <FaNotesMedical color="#e0245e"/> {child.first_name} {child.last_name}
               </div>
               <div className="medical-info-section">
                  <p className="medical-label">Informacje medyczne / Alergie:</p>
                  <textarea className="medical-textarea" value={child.medical_info||''} onChange={e => handleMedicalChange(child.id, e.target.value)} />
                  <div className="medical-footer">
                    <span className="medical-hint"><FaChild/> Widoczne dla dyrekcji.</span>
                    <button className="honey-btn" onClick={() => handleMedicalUpdate(child.id, child.medical_info)}>Zapisz</button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;