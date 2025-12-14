// frontend/src/Settings.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Cropper from 'react-easy-crop'; // <--- BIBLIOTEKA KADROWANIA
import { getCroppedImg } from './cropUtils'; // <--- NASZA FUNKCJA POMOCNICZA
import './Settings.css';
import LoadingScreen from './LoadingScreen';
import { 
  FaLock, FaEnvelope, FaPhoneAlt, FaCheck, FaUser, FaUserCog, 
  FaNotesMedical, FaChild, FaCamera, FaTrashAlt, FaExclamationTriangle, FaSave 
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

  // --- STANY DO CROPPERA (KADROWANIA) ---
  const [imageSrc, setImageSrc] = useState(null); // Wczytane zdjęcie
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // --- STANY DO MODALA USUWANIA ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  // 1. WYBÓR PLIKU I OTWARCIE CROPPERA
  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Walidacja rozmiaru (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Zdjęcie jest za duże (max 5MB).' });
        return;
      }

      // Czytamy plik jako URL, żeby wyświetlić w edytorze
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setIsCropModalOpen(true); // Otwieramy modal edycji
      });
      reader.readAsDataURL(file);
    }
  };

  // 2. ZAPISANIE PRZYCIĘTEGO ZDJĘCIA
  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const saveCroppedImage = async () => {
    try {
      setLoading(true);
      // Używamy naszej funkcji pomocniczej do wycięcia zdjęcia
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // Tworzymy FormData z nowym plikiem
      const formData = new FormData();
      formData.append('avatar', croppedImageBlob, 'avatar.jpg');

      // Wysyłamy do API
      await axios.patch('http://127.0.0.1:8000/api/users/me/', formData, {
        headers: { 
          Authorization: `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage({ type: 'success', text: 'Zdjęcie profilowe zaktualizowane!' });
      fetchUserData();
      setIsCropModalOpen(false); // Zamknij modal
      setImageSrc(null); // Wyczyść źródło
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Błąd podczas zapisu zdjęcia.' });
    } finally {
      setLoading(false);
    }
  };

  // 3. POTWIERDZENIE USUWANIA (MODAL)
  const confirmDeleteAvatar = async () => {
    setLoading(true);
    try {
      await axios.patch('http://127.0.0.1:8000/api/users/me/', { avatar: 'DELETE' }, getAuthHeaders());
      setMessage({ type: 'success', text: 'Zdjęcie profilowe usunięte.' });
      fetchUserData();
      setIsDeleteModalOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Błąd podczas usuwania zdjęcia.' });
    } finally {
      setLoading(false);
    }
  };

  const getMaskedPhone = (phone) => {
    if (!phone) return 'Brak numeru';
    if (phone.length <= 3) return phone;
    return `${'*'.repeat(phone.length - 3)}${phone.slice(-3)}`;
  };

  const handleUpdateData = async (type) => { /* ... bez zmian ... */
    setLoading(true); setMessage({ type: '', text: '' });
    let payload = {};
    if (type === 'email' && formData.new_email) payload.email = formData.new_email;
    if (type === 'phone' && formData.new_phone) payload.phone_number = formData.new_phone;

    if (Object.keys(payload).length === 0) {
      setMessage({ type: 'error', text: 'Wpisz nową wartość przed zapisaniem.' }); setLoading(false); return;
    }

    try {
      await axios.patch('http://127.0.0.1:8000/api/users/me/', payload, getAuthHeaders());
      setMessage({ type: 'success', text: 'Dane zostały zaktualizowane pomyślnie.' });
      fetchUserData(); setFormData(prev => ({ ...prev, new_email: '', new_phone: '' }));
    } catch (err) { setMessage({ type: 'error', text: 'Błąd aktualizacji.' }); } finally { setLoading(false); }
  };

  const handlePasswordChange = async () => { /* ... bez zmian ... */ 
    /* (Skopiuj logikę z poprzedniego pliku lub zostaw jeśli wiesz o co chodzi) */
    /* Dla pewności wklejam skrót: */
    if (!passwordData.old_password || !passwordData.new_password) { setMessage({ type: 'error', text: 'Wypełnij pola.' }); return; }
    if (passwordData.new_password !== passwordData.confirm_password) { setMessage({ type: 'error', text: 'Hasła różne.' }); return; }
    setLoading(true);
    try {
      await axios.put('http://127.0.0.1:8000/api/users/change-password/', passwordData, getAuthHeaders());
      setMessage({ type: 'success', text: 'Hasło zmienione.' });
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch(e) { setMessage({ type: 'error', text: 'Błąd hasła.' }); } finally { setLoading(false); }
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

      {message.text && <div className={`settings-alert ${message.type}`}>{message.text}</div>}

      <div className="settings-grid">
        <div className="settings-column">
          
          {/* --- KARTA PROFILOWA --- */}
          <div className="settings-wide-card profile-card-centered">
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
            
            {/* Input pliku (resetujemy value, żeby móc wybrać ten sam plik ponownie) */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleFileChange}
              onClick={(e) => { e.target.value = null }} 
            />
            
            <h2 className="profile-name">{currentData.first_name} {currentData.last_name}</h2>

            {currentData.avatar && (
              <button className="delete-avatar-btn" onClick={() => setIsDeleteModalOpen(true)}>
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

          {/* DANE KONTAKTOWE */}
          <div className="settings-wide-card">
             <div className="card-title">Dane Kontaktowe</div>
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaEnvelope className="field-icon"/><input value={currentData.email} disabled/></div>
                 <div className="input-box"><FaEnvelope className="field-icon"/><input placeholder="Nowy Email" value={formData.new_email} onChange={e => setFormData({...formData, new_email: e.target.value})}/></div>
             </div>
             <div className="button-container-right">
                <button className="honey-btn" onClick={() => handleUpdateData('email')}>Zapisz Email</button>
             </div>
             <div className="spacer-20" style={{height: '30px'}}></div>
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaPhoneAlt className="field-icon"/><input value={getMaskedPhone(currentData.phone_number)} disabled/></div>
                 <div className="input-box"><FaPhoneAlt className="field-icon"/><input placeholder="Nowy Telefon" value={formData.new_phone} onChange={e => setFormData({...formData, new_phone: e.target.value})}/></div>
             </div>
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

      {/* --- MODAL DO KADROWANIA (CROP) --- */}
      {isCropModalOpen && (
        <div className="modal-overlay">
          <div className="crop-modal-content">
            <h3 className="crop-title">Dostosuj zdjęcie</h3>
            <div className="crop-container">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1} // Kwadrat (Avatar)
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                showGrid={false}
              />
            </div>
            
            {/* Suwak zoomowania */}
            <div className="zoom-slider-container">
              <span>-</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(e.target.value)}
                className="zoom-range"
              />
              <span>+</span>
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => {setIsCropModalOpen(false); setImageSrc(null);}}>Anuluj</button>
              <button className="modal-btn confirm success" onClick={saveCroppedImage}><FaSave /> Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DO USUWANIA (POTWIERDZENIE) --- */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Usunąć zdjęcie?</h3>
            <p>Czy na pewno chcesz usunąć swoje zdjęcie profilowe? Zostanie przywrócony domyślny awatar.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setIsDeleteModalOpen(false)}>Anuluj</button>
              <button className="modal-btn confirm danger" onClick={confirmDeleteAvatar}><FaTrashAlt /> Usuń</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;