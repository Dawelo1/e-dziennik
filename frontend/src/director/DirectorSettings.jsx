import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../cropUtils';
import './DirectorSettings.css';
import LoadingScreen from '../users/LoadingScreen';
import { getAuthHeaders } from '../authUtils';
import { toAbsoluteMediaUrl } from '../apiConfig';
import { 
  FaLock, FaEnvelope, FaPhoneAlt, FaCheck, FaUser, FaUserCog, 
  FaNotesMedical, FaChild, FaCamera, FaTrashAlt, FaExclamationTriangle, FaSave 
} 
from 'react-icons/fa';

const Settings = () => {
  const [currentData, setCurrentData] = useState({
    email: '', phone_number: '', username: '', first_name: '', last_name: '', avatar: null
  });

  const [formData, setFormData] = useState({ new_email: '', new_phone: '', new_first_name: '', new_last_name: '' });
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [passwordErrors, setPasswordErrors] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [contactErrors, setContactErrors] = useState({ email: '', phone: '' });
  const [contactMessage, setContactMessage] = useState({ type: '', text: '' });
  const [personalErrors, setPersonalErrors] = useState({ first_name: '', last_name: '' });
  const [personalMessage, setPersonalMessage] = useState({ type: '', text: '' });
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

  const getAvatarUrl = (url) => {
    return toAbsoluteMediaUrl(url);
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
      await axios.patch('http://127.0.0.1:8000/api/users/me/', formData, getAuthHeaders());

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
    } catch {
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

  const isValidEmail = (emailValue) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

  const isValidPhone = (phoneValue) => {
    const normalizedPhone = phoneValue.replace(/[\s\-()]/g, '');
    return /^\+?\d{9,15}$/.test(normalizedPhone);
  };

  const handleContactUpdate = async (type) => {
    setMessage({ type: '', text: '' });
    setPasswordMessage({ type: '', text: '' });
    setPasswordErrors({ old_password: '', new_password: '', confirm_password: '' });

    const nextContactErrors = { email: '', phone: '' };
    let payload = {};

    if (type === 'email') {
      const emailValue = formData.new_email.trim();
      if (!emailValue) {
        nextContactErrors.email = 'Podaj nowy adres email.';
      } else if (!isValidEmail(emailValue)) {
        nextContactErrors.email = 'Podaj poprawny adres email.';
      } else {
        payload.email = emailValue;
      }
    }

    if (type === 'phone') {
      const phoneValue = formData.new_phone.trim();
      if (!phoneValue) {
        nextContactErrors.phone = 'Podaj nowy numer telefonu.';
      } else if (!isValidPhone(phoneValue)) {
        nextContactErrors.phone = 'Podaj poprawny numer telefonu (9-15 cyfr).';
      } else {
        payload.phone_number = phoneValue;
      }
    }

    setContactErrors(nextContactErrors);
    setContactMessage({ type: '', text: '' });
    setPersonalMessage({ type: '', text: '' });

    if (Object.values(nextContactErrors).some(Boolean)) {
      setContactMessage({ type: 'error', text: 'Popraw zaznaczone pola formularza.' });
      return;
    }

    setLoading(true);
    try {
      await axios.patch('http://127.0.0.1:8000/api/users/me/', payload, getAuthHeaders());
      setContactMessage({ type: 'success', text: 'Dane kontaktowe zostały zapisane.' });
      fetchUserData();
      setFormData((prev) => ({ ...prev, new_email: type === 'email' ? '' : prev.new_email, new_phone: type === 'phone' ? '' : prev.new_phone }));
    } catch { setContactMessage({ type: 'error', text: 'Nie udało się zapisać danych kontaktowych.' }); } finally { setLoading(false); }
  };

  const handlePersonalUpdate = async () => {
    setMessage({ type: '', text: '' });
    setPasswordMessage({ type: '', text: '' });
    setPasswordErrors({ old_password: '', new_password: '', confirm_password: '' });

    const firstNameValue = formData.new_first_name.trim();
    const lastNameValue = formData.new_last_name.trim();
    const nextPersonalErrors = { first_name: '', last_name: '' };
    const payload = {};

    if (!firstNameValue && !lastNameValue) {
      nextPersonalErrors.first_name = 'Podaj nowe imię lub nazwisko.';
      nextPersonalErrors.last_name = 'Podaj nowe imię lub nazwisko.';
    }

    if (firstNameValue) payload.first_name = firstNameValue;
    if (lastNameValue) payload.last_name = lastNameValue;

    setPersonalErrors(nextPersonalErrors);
    setPersonalMessage({ type: '', text: '' });
    setContactMessage({ type: '', text: '' });

    if (Object.values(nextPersonalErrors).some(Boolean)) {
      setPersonalMessage({ type: 'error', text: 'Popraw zaznaczone pola formularza.' });
      return;
    }

    setLoading(true);
    try {
      await axios.patch('http://127.0.0.1:8000/api/users/me/', payload, getAuthHeaders());
      setPersonalMessage({ type: 'success', text: 'Dane osobowe zostały zapisane.' });
      fetchUserData();
      setFormData((prev) => ({ ...prev, new_first_name: '', new_last_name: '' }));
    } catch {
      setPersonalMessage({ type: 'error', text: 'Nie udało się zapisać danych osobowych.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setMessage({ type: '', text: '' });
    setPasswordMessage({ type: '', text: '' });

    const nextErrors = { old_password: '', new_password: '', confirm_password: '' };

    if (!passwordData.old_password.trim()) nextErrors.old_password = 'Podaj obecne hasło.';
    if (!passwordData.new_password.trim()) nextErrors.new_password = 'Podaj nowe hasło.';
    if (!passwordData.confirm_password.trim()) nextErrors.confirm_password = 'Potwierdź nowe hasło.';

    if (
      passwordData.new_password.trim() &&
      passwordData.confirm_password.trim() &&
      passwordData.new_password !== passwordData.confirm_password
    ) {
      nextErrors.confirm_password = 'Hasła nie są takie same.';
    }

    setPasswordErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      setPasswordMessage({ type: 'error', text: 'Popraw zaznaczone pola formularza.' });
      return;
    }

    setLoading(true);
    try {
      await axios.put('http://127.0.0.1:8000/api/users/change-password/', passwordData, getAuthHeaders());
      setPasswordMessage({ type: 'success', text: 'Hasło zostało zmienione.' });
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordErrors({ old_password: '', new_password: '', confirm_password: '' });
    } catch { setPasswordMessage({ type: 'error', text: 'Nie udało się zmienić hasła. Sprawdź obecne hasło i spróbuj ponownie.' }); } finally { setLoading(false); }
  };

  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="settings-page-wrapper">
      <h2 className="page-title">
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
            {passwordMessage.text && <div className={`settings-alert ${passwordMessage.type}`}>{passwordMessage.text}</div>}
            <div className="inputs-grid">
              <div className="input-box">
                <FaLock className="field-icon" />
                <input
                  type="password"
                  className={passwordErrors.old_password ? 'input-invalid' : ''}
                  placeholder="Obecne Hasło"
                  value={passwordData.old_password}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, old_password: e.target.value });
                    setPasswordErrors((prev) => ({ ...prev, old_password: '' }));
                  }}
                />
                {passwordErrors.old_password && <div className="field-required-message">{passwordErrors.old_password}</div>}
              </div>

              <div className="input-box">
                <FaLock className="field-icon" />
                <input
                  type="password"
                  className={passwordErrors.new_password ? 'input-invalid' : ''}
                  placeholder="Nowe Hasło"
                  value={passwordData.new_password}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, new_password: e.target.value });
                    setPasswordErrors((prev) => ({ ...prev, new_password: '' }));
                  }}
                />
                {passwordErrors.new_password && <div className="field-required-message">{passwordErrors.new_password}</div>}
              </div>

              <div className="input-box">
                <FaCheck className="field-icon" />
                <input
                  type="password"
                  className={passwordErrors.confirm_password ? 'input-invalid' : ''}
                  placeholder="Potwierdź"
                  value={passwordData.confirm_password}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, confirm_password: e.target.value });
                    setPasswordErrors((prev) => ({ ...prev, confirm_password: '' }));
                  }}
                />
                {passwordErrors.confirm_password && <div className="field-required-message">{passwordErrors.confirm_password}</div>}
              </div>

              <div className="button-container-right"><button className="honey-btn" onClick={handlePasswordChange}>Zmień</button></div>
            </div>
          </div>

          {/* DANE KONTAKTOWE */}
          <div className="settings-wide-card">
             <div className="card-title">Dane Kontaktowe</div>
             {contactMessage.text && <div className={`settings-alert ${contactMessage.type}`}>{contactMessage.text}</div>}
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaEnvelope className="field-icon"/><input value={currentData.email} disabled/></div>
                 <div className="input-box">
                  <FaEnvelope className="field-icon"/>
                  <input
                    className={contactErrors.email ? 'input-invalid' : ''}
                    placeholder="Nowy Email"
                    value={formData.new_email}
                    onChange={(e) => {
                      setFormData({ ...formData, new_email: e.target.value });
                      setContactErrors((prev) => ({ ...prev, email: '' }));
                    }}
                  />
                  {contactErrors.email && <div className="field-required-message">{contactErrors.email}</div>}
                </div>
             </div>
             <div className="button-container-right">
                <button className="honey-btn" onClick={() => handleContactUpdate('email')}>Zapisz Email</button>
             </div>
             <div className="spacer-20" style={{height: '30px'}}></div>
             <div className="inputs-grid-2col">
                 <div className="input-box read-only"><FaPhoneAlt className="field-icon"/><input value={getMaskedPhone(currentData.phone_number)} disabled/></div>
                 <div className="input-box">
                  <FaPhoneAlt className="field-icon"/>
                  <input
                    className={contactErrors.phone ? 'input-invalid' : ''}
                    placeholder="Nowy Telefon"
                    value={formData.new_phone}
                    onChange={(e) => {
                      setFormData({ ...formData, new_phone: e.target.value });
                      setContactErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                  />
                  {contactErrors.phone && <div className="field-required-message">{contactErrors.phone}</div>}
                </div>
             </div>
             <div className="button-container-right">
                <button className="honey-btn" onClick={() => handleContactUpdate('phone')}>Zapisz Telefon</button>
             </div>
          </div>
        </div>

        {/* DANE OSOBOWE */}
        <div className="settings-column">
          <div className="settings-wide-card">
            <div className="card-title">Dane Osobowe</div>
            {personalMessage.text && <div className={`settings-alert ${personalMessage.type}`}>{personalMessage.text}</div>}
            <div className="inputs-grid-2col">
              <div className="input-box read-only"><FaUser className="field-icon"/><input value={currentData.first_name} disabled/></div>
              <div className="input-box">
                <FaUser className="field-icon"/>
                <input
                  className={personalErrors.first_name ? 'input-invalid' : ''}
                  placeholder="Nowe Imię"
                  value={formData.new_first_name}
                  onChange={(e) => {
                    setFormData({ ...formData, new_first_name: e.target.value });
                    setPersonalErrors((prev) => ({ ...prev, first_name: '' }));
                  }}
                />
                {personalErrors.first_name && <div className="field-required-message">{personalErrors.first_name}</div>}
              </div>
            </div>
            <div className="spacer-20" style={{height: '20px'}}></div>
            <div className="inputs-grid-2col">
              <div className="input-box read-only"><FaUser className="field-icon"/><input value={currentData.last_name} disabled/></div>
              <div className="input-box">
                <FaUser className="field-icon"/>
                <input
                  className={personalErrors.last_name ? 'input-invalid' : ''}
                  placeholder="Nowe Nazwisko"
                  value={formData.new_last_name}
                  onChange={(e) => {
                    setFormData({ ...formData, new_last_name: e.target.value });
                    setPersonalErrors((prev) => ({ ...prev, last_name: '' }));
                  }}
                />
                {personalErrors.last_name && <div className="field-required-message">{personalErrors.last_name}</div>}
              </div>
            </div>
            <div className="button-container-right">
              <button className="honey-btn" onClick={handlePersonalUpdate}>Zapisz Dane Osobowe</button>
            </div>
          </div>
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