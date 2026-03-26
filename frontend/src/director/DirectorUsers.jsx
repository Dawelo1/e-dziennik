// frontend/src/director/DirectorUsers.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css';

// --- NOWY IMPORT ---
import LoadingScreen from '../users/LoadingScreen'; 

// Ikony
import { 
  FaUsers, FaSearch, FaPlus, FaEdit, FaTrash, 
  FaUserTie, FaUser, FaChalkboardTeacher, FaKey, FaSave, FaExclamationTriangle, FaTrashAlt, FaEye, FaLock, FaLockOpen
} from 'react-icons/fa';

const DirectorUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stan Modala
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); 

  // Formularz
  const initialForm = {
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lockTarget, setLockTarget] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoadingUserId, setPreviewLoadingUserId] = useState(null);
  const [lockLoadingUserId, setLockLoadingUserId] = useState(null);
  const [generatingCredentials, setGeneratingCredentials] = useState(false);
  const [generatingPassword, setGeneratingPassword] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [passwordWasGenerated, setPasswordWasGenerated] = useState(false);
  const [invalidFields, setInvalidFields] = useState({
    username: false,
    first_name: false,
    last_name: false,
    email: false,
    phone_number: false,
    password: false,
  });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({
    username: false,
    first_name: false,
    last_name: false,
    email: false,
    phone_number: false,
    password: false,
  });
  const [formatFieldErrors, setFormatFieldErrors] = useState({
    email: false,
    phone_number: false,
  });
  const invalidFieldTimers = useRef({
    username: null,
    first_name: null,
    last_name: null,
    email: null,
    phone_number: null,
    password: null,
  });

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  const isValidPhoneNumber = (value) => {
    const normalized = value.replace(/[\s-]/g, '');
    return /^(\+48)?\d{9}$/.test(normalized);
  };

  // 1. Pobieranie użytkowników
  const fetchUsers = async () => {
    // Nie włączamy loading przy każdym wpisaniu litery w szukajkę, 
    // żeby ekran nie migał pszczółką przy pisaniu.
    // Ale przy pierwszym ładowaniu - tak.
    if (users.length === 0) setLoading(true); 

    try {
      const url = `/api/users/manage/?search=${searchQuery}`;
      const res = await axios.get(url, getAuthHeaders());
      setUsers(res.data);
    } catch (err) {
      console.error("Błąd pobierania użytkowników:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const triggerInvalidField = (fieldName) => {
    setInvalidFields((prev) => ({ ...prev, [fieldName]: false }));

    requestAnimationFrame(() => {
      setInvalidFields((prev) => ({ ...prev, [fieldName]: true }));
    });

    if (invalidFieldTimers.current[fieldName]) {
      clearTimeout(invalidFieldTimers.current[fieldName]);
    }

    invalidFieldTimers.current[fieldName] = setTimeout(() => {
      setInvalidFields((prev) => ({ ...prev, [fieldName]: false }));
    }, 650);
  };

  const clearInvalidField = (fieldName) => {
    if (invalidFieldTimers.current[fieldName]) {
      clearTimeout(invalidFieldTimers.current[fieldName]);
      invalidFieldTimers.current[fieldName] = null;
    }
    setInvalidFields((prev) => ({ ...prev, [fieldName]: false }));
  };

  useEffect(() => {
    return () => {
      Object.values(invalidFieldTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // 2. Otwieranie Modala
  const openModal = (user = null) => {
    setError('');
    setActionError('');
    setGeneratedCredentials(null);
    setPasswordWasGenerated(false);
    setInvalidFields({
      username: false,
      first_name: false,
      last_name: false,
      email: false,
      phone_number: false,
      password: false,
    });
    setRequiredFieldErrors({
      username: false,
      first_name: false,
      last_name: false,
      email: false,
      phone_number: false,
      password: false,
    });
    setFormatFieldErrors({ email: false, phone_number: false });
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email || '',
        phone_number: user.phone_number || '',
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleGenerateCredentials = async () => {
    if (editingUser) return;
    setError('');
    setGeneratingCredentials(true);

    try {
      const res = await axios.get(
        '/api/users/manage/generate-credentials/',
        getAuthHeaders()
      );

      setFormData(prev => ({
        ...prev,
        username: res.data?.username || '',
        password: res.data?.password || '',
      }));
      setPasswordWasGenerated(true);
      clearInvalidField('username');
      clearInvalidField('password');
      setRequiredFieldErrors((prev) => ({ ...prev, username: false, password: false }));

      setGeneratedCredentials({
        username: res.data?.username || '',
        password: res.data?.password || '',
      });
    } catch (err) {
      setError('Nie udało się wygenerować danych. Spróbuj ponownie.');
    } finally {
      setGeneratingCredentials(false);
    }
  };

  const handleGeneratePassword = async () => {
    setError('');
    setGeneratingPassword(true);

    try {
      const res = await axios.get(
        '/api/users/manage/generate-credentials/',
        getAuthHeaders()
      );

      const generatedPassword = res.data?.password || '';
      setFormData((prev) => ({
        ...prev,
        password: generatedPassword,
      }));
      setPasswordWasGenerated(true);
      clearInvalidField('password');
      setRequiredFieldErrors((prev) => ({ ...prev, password: false }));
    } catch (err) {
      setError('Nie udało się wygenerować hasła. Spróbuj ponownie.');
    } finally {
      setGeneratingPassword(false);
    }
  };

  // 3. Zapisywanie
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const isTeacherRole = Boolean(editingUser?.is_teacher);

    const trimmedUsername = formData.username.trim();
    const trimmedFirstName = formData.first_name.trim();
    const trimmedLastName = formData.last_name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhoneNumber = formData.phone_number.trim();
    const trimmedPassword = formData.password.trim();

    const missingUsername = !trimmedUsername;
    const missingFirstName = !isTeacherRole && !trimmedFirstName;
    const missingLastName = !isTeacherRole && !trimmedLastName;
    const missingEmail = !isTeacherRole && !trimmedEmail;
    const missingPhoneNumber = !isTeacherRole && !trimmedPhoneNumber;
    const missingPassword = !editingUser && !trimmedPassword;

    const invalidEmail = !isTeacherRole && !missingEmail && !isValidEmail(trimmedEmail);
    const invalidPhoneNumber = !isTeacherRole && !missingPhoneNumber && !isValidPhoneNumber(trimmedPhoneNumber);

    setRequiredFieldErrors({
      username: missingUsername,
      first_name: missingFirstName,
      last_name: missingLastName,
      email: missingEmail,
      phone_number: missingPhoneNumber,
      password: missingPassword,
    });

    setFormatFieldErrors({
      email: invalidEmail,
      phone_number: invalidPhoneNumber,
    });

    if (missingUsername) triggerInvalidField('username');
    if (missingFirstName) triggerInvalidField('first_name');
    if (missingLastName) triggerInvalidField('last_name');
    if (missingEmail || invalidEmail) triggerInvalidField('email');
    if (missingPhoneNumber || invalidPhoneNumber) triggerInvalidField('phone_number');
    if (missingPassword) triggerInvalidField('password');

    if (
      missingUsername ||
      missingFirstName ||
      missingLastName ||
      missingEmail ||
      missingPhoneNumber ||
      missingPassword ||
      invalidEmail ||
      invalidPhoneNumber
    ) {
      return;
    }

    // Włączamy loading na czas zapisu - pojawi się pszczółka
    setLoading(true);

    const payload = {
      ...formData,
      username: trimmedUsername,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      email: trimmedEmail,
      phone_number: trimmedPhoneNumber,
      password: trimmedPassword,
      password_generated: passwordWasGenerated && !!trimmedPassword,
      is_director: false,
      is_parent: !isTeacherRole,
      is_teacher: isTeacherRole,
    };

    if (editingUser && !payload.password) {
      delete payload.password;
    }

    try {
      if (editingUser) {
        await axios.patch(
          `/api/users/manage/${editingUser.id}/`, 
          payload, 
          getAuthHeaders()
        );
      } else {
        await axios.post(
          '/api/users/manage/', 
          payload, 
          getAuthHeaders()
        );
      }
      setIsModalOpen(false);
      // Pobieramy dane ponownie (loading zostanie wyłączony w fetchUsers)
      fetchUsers(); 
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.username 
        ? `Nazwa użytkownika zajęta: ${err.response.data.username}` 
        : 'Wystąpił błąd zapisu.';
      setError(msg);
      setLoading(false); // Wyłączamy loading w przypadku błędu
    }
  };

  // 4. Usuwanie
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    
    setLoading(true); // Pszczółka podczas usuwania
    try {
      await axios.delete(`/api/users/manage/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      setActionError('Nie udało się usunąć użytkownika. Spróbuj ponownie później.');
      setLoading(false);
    }
  };

  const handlePreviewPassword = async (user) => {
    setActionError('');
    setPreviewLoadingUserId(user.id);

    try {
      const res = await axios.get(
        `/api/users/manage/${user.id}/password-preview/`,
        getAuthHeaders()
      );

      setPreviewData({
        username: res.data?.username || user.username,
        password: res.data?.password || '',
      });
    } catch (err) {
      const apiDetail = err.response?.data?.detail;
      setActionError(apiDetail || 'Podgląd hasła nie jest dostępny dla tego konta.');
    } finally {
      setPreviewLoadingUserId(null);
    }
  };

  const handleToggleParentLock = (user) => {
    if (!user?.is_parent || user?.is_teacher || user?.is_director) return;
    setActionError('');
    setLockTarget(user);
  };

  const handleConfirmToggleParentLock = async () => {
    if (!lockTarget) return;

    setActionError('');
    setLockLoadingUserId(lockTarget.id);

    const shouldLock = Boolean(lockTarget.is_active);

    try {
      const res = await axios.post(
        `/api/users/manage/${lockTarget.id}/set-parent-lock/`,
        { lock: shouldLock },
        getAuthHeaders()
      );

      const nextIsActive = typeof res.data?.is_active === 'boolean'
        ? res.data.is_active
        : !shouldLock;

      setUsers((prev) =>
        prev.map((item) =>
          item.id === lockTarget.id ? { ...item, is_active: nextIsActive } : item
        )
      );
      setLockTarget(null);
    } catch (err) {
      const apiDetail = err.response?.data?.detail;
      setActionError(apiDetail || 'Nie udało się zaktualizować statusu konta. Spróbuj ponownie później.');
    } finally {
      setLockLoadingUserId(null);
    }
  };

  // --- ZMIANA: EKRAN ŁADOWANIA ---
  // Wyświetlamy go, gdy trwa pobieranie danych LUB zapisywanie
  if (loading && users.length === 0) {
     // Wersja dla pierwszego wejścia (pełny ekran)
     return <LoadingScreen message="Wczytywanie listy użytkowników..." />;
  }

  // Wersja "Overlay" gdy zapisujemy (opcjonalnie, można to też obsłużyć inaczej)
  // Tutaj używam prostej logiki: jeśli loading jest true (np. przy zapisie), 
  // zwracamy LoadingScreen zamiast tabeli.
  if (loading) {
      return <LoadingScreen message="Przetwarzanie danych..." />;
  }

  const isEditingTeacher = Boolean(editingUser?.is_teacher);

  const visibleUsers = users.filter((user) => !user.is_director);

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaUsers /> Zarządzanie Użytkownikami
        </h2>
      </div>

      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon"/>
          <input 
            type="text" 
            placeholder="Szukaj po imieniu, nazwisku, loginie..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Użytkownika
        </button>
      </div>

      {actionError && (
        <div className="form-error" style={{ marginBottom: '12px' }}>
          {actionError}
        </div>
      )}

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Użytkownik</th>
              <th>Imię i Nazwisko</th>
              <th>Kontakt</th>
              <th>Rola</th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 ? (
              <tr><td colSpan="5" className="text-center">Brak użytkowników spełniających kryteria.</td></tr>
            ) : (
              visibleUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className={`avatar-circle ${user.is_teacher ? 'teacher' : (user.is_director ? 'director' : 'parent')}`}>
                        {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
                      </div>
                      <span className="username-text">{user.username}</span>
                    </div>
                  </td>
                  <td>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || '-'}</td>
                  <td>
                    <div className="contact-info">
                      <span>{user.email || '-'}</span>
                      <span className="sub-text">{user.phone_number || '-'}</span>
                    </div>
                  </td>
                  <td>
                    {user.is_director ? (
                      <span className="role-badge director"><FaUserTie/> Dyrektor</span>
                    ) : user.is_teacher ? (
                      <span className="role-badge teacher"><FaChalkboardTeacher/> Nauczyciel</span>
                    ) : (
                      <span className="role-badge parent"><FaUser/> Rodzic</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button className="action-icon-btn edit" onClick={() => openModal(user)} title="Edytuj">
                      <FaEdit />
                    </button>
                    <button
                      className="action-icon-btn preview"
                      onClick={() => handlePreviewPassword(user)}
                      title={user.can_preview_password ? 'Podejrzyj hasło' : 'Podgląd hasła niedostępny'}
                      disabled={!user.can_preview_password || previewLoadingUserId === user.id}
                    >
                      <FaEye />
                    </button>
                    <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(user); }} title="Usuń">
                      <FaTrash />
                    </button>
                    {user.is_parent && !user.is_teacher && !user.is_director && (
                      <button
                        className={`action-icon-btn lock-toggle ${user.is_active ? 'block' : 'unblock'}`}
                        onClick={() => handleToggleParentLock(user)}
                        title={user.is_active ? 'Zablokuj konto rodzica' : 'Odblokuj konto rodzica'}
                        disabled={lockLoadingUserId === user.id}
                      >
                        {user.is_active ? <FaLockOpen /> : <FaLock />}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h3>{editingUser ? 'Edytuj Użytkownika' : 'Dodaj Nowego Użytkownika'}</h3>
            
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid" noValidate>
              {!editingUser && (
                <div className="full-width generated-credentials-actions">
                  <button
                    type="button"
                    className="modal-btn confirm success"
                    onClick={handleGenerateCredentials}
                    disabled={generatingCredentials}
                  >
                    <FaKey /> {generatingCredentials ? 'Generowanie...' : 'Wygeneruj login i hasło'}
                  </button>
                </div>
              )}

              {!editingUser && generatedCredentials && (
                <div className="full-width generated-credentials-info">
                  Wygenerowano: login <strong>{generatedCredentials.username}</strong>, hasło <strong>{generatedCredentials.password}</strong>
                </div>
              )}
              
              <div className="form-group">
                <label>Login <span className="required-asterisk">*</span></label>
                <input 
                  type="text"
                  placeholder="Login użytkownika"
                  value={formData.username}
                  onChange={e => {
                    setFormData({...formData, username: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('username');
                      setRequiredFieldErrors((prev) => ({ ...prev, username: false }));
                    }
                  }}
                  className={invalidFields.username ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.username && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              {!isEditingTeacher && (
              <div className="form-group">
                <label>Imię <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  placeholder="Imię"
                  value={formData.first_name}
                  onChange={e => {
                    setFormData({...formData, first_name: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('first_name');
                      setRequiredFieldErrors((prev) => ({ ...prev, first_name: false }));
                    }
                  }}
                  className={invalidFields.first_name ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.first_name && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>
              )}

              {!isEditingTeacher && (
              <div className="form-group">
                <label>Nazwisko <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  placeholder="Nazwisko"
                  value={formData.last_name}
                  onChange={e => {
                    setFormData({...formData, last_name: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('last_name');
                      setRequiredFieldErrors((prev) => ({ ...prev, last_name: false }));
                    }
                  }}
                  className={invalidFields.last_name ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.last_name && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>
              )}

              {!isEditingTeacher && (
              <div className="form-group">
                <label>E-mail <span className="required-asterisk">*</span></label>
                <input
                  type="email"
                  placeholder="Adres e-mail"
                  value={formData.email}
                  onChange={e => {
                    setFormData({...formData, email: e.target.value});
                    const trimmedValue = e.target.value.trim();
                    if (trimmedValue) {
                      clearInvalidField('email');
                      setRequiredFieldErrors((prev) => ({ ...prev, email: false }));
                      setFormatFieldErrors((prev) => ({ ...prev, email: false }));
                    }
                  }}
                  className={invalidFields.email ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.email && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
                {!requiredFieldErrors.email && formatFieldErrors.email && (
                  <div className="field-required-message">Podaj poprawny adres e-mail (np. nazwa@domena.pl).</div>
                )}
              </div>
              )}

              {!isEditingTeacher && (
              <div className="form-group">
                <label>Telefon <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  placeholder="Numer telefonu"
                  value={formData.phone_number}
                  onChange={e => {
                    setFormData({...formData, phone_number: e.target.value});
                    const trimmedValue = e.target.value.trim();
                    if (trimmedValue) {
                      clearInvalidField('phone_number');
                      setRequiredFieldErrors((prev) => ({ ...prev, phone_number: false }));
                      setFormatFieldErrors((prev) => ({ ...prev, phone_number: false }));
                    }
                  }}
                  className={invalidFields.phone_number ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.phone_number && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
                {!requiredFieldErrors.phone_number && formatFieldErrors.phone_number && (
                  <div className="field-required-message">Podaj poprawny numer telefonu (np. 123456789 lub +48 123 456 789).</div>
                )}
              </div>
              )}

              <div className="form-group full-width">
                <label>
                  Hasło {!editingUser && <span className="required-asterisk">*</span>}
                  {editingUser && <span style={{fontWeight:400, color:'#999'}}> (Zostaw puste, aby nie zmieniać)</span>}
                </label>
                <div className="password-row">
                  <div className="password-input-wrapper">
                    <FaKey className="field-icon"/>
                    <input 
                      type="password" 
                      placeholder={editingUser ? "••••••••" : "Wpisz hasło..."}
                      value={formData.password}
                      onChange={e => {
                        setFormData({...formData, password: e.target.value});
                        setPasswordWasGenerated(false);
                        if (e.target.value.trim()) {
                          clearInvalidField('password');
                          setRequiredFieldErrors((prev) => ({ ...prev, password: false }));
                        }
                      }}
                      className={invalidFields.password ? 'invalid-bounce' : ''}
                    />
                  </div>
                  {editingUser && (
                    <button
                      type="button"
                      className="modal-btn confirm success password-generate-btn-inline"
                      onClick={handleGeneratePassword}
                      disabled={generatingPassword}
                    >
                      <FaKey /> {generatingPassword ? 'Generowanie...' : 'Wygeneruj hasło'}
                    </button>
                  )}
                </div>
                {requiredFieldErrors.password && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="modal-actions full-width">
                <button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Anuluj</button>
                <button type="submit" className="modal-btn confirm success"><FaSave /> Zapisz</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {previewData && (
        <div className="modal-overlay">
          <div className="delete-modal-content preview-password-modal-content">
            <div className="warning-icon"><FaEye /></div>
            <h3>Podgląd hasła</h3>
            <p>
              Konto <strong>{previewData.username}</strong> ma aktualnie hasło:
            </p>
            <div className="generated-credentials-info preview-password-value">
              <strong>{previewData.password}</strong>
            </div>
            <div className="modal-actions">
              <button className="modal-btn confirm success" onClick={() => setPreviewData(null)}>
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Usunąć użytkownika?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć użytkownika
              {` "${deleteTarget.first_name || ''} ${deleteTarget.last_name || ''}"`.trim()}
              ? Tej operacji nie można cofnąć.
            </p>
            {actionError && <div className="form-error">{actionError}</div>}
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => { setActionError(''); setDeleteTarget(null); }}>Anuluj</button>
              <button className="modal-btn confirm danger" onClick={handleDelete}><FaTrashAlt /> Usuń</button>
            </div>
          </div>
        </div>
      )}

      {lockTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon">
              {lockTarget.is_active ? <FaLock /> : <FaLockOpen />}
            </div>
            <h3>{lockTarget.is_active ? 'Zablokować konto rodzica?' : 'Odblokować konto rodzica?'}</h3>
            <p>
              Czy na pewno chcesz
              {lockTarget.is_active ? ' zablokować ' : ' odblokować '}
              konto użytkownika
              {` "${lockTarget.first_name || ''} ${lockTarget.last_name || ''}"`.trim()}
              ?
            </p>
            {actionError && <div className="form-error">{actionError}</div>}
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => { setActionError(''); setLockTarget(null); }}>Anuluj</button>
              <button
                className={`modal-btn confirm ${lockTarget.is_active ? 'danger' : 'success'}`}
                onClick={handleConfirmToggleParentLock}
                disabled={lockLoadingUserId === lockTarget.id}
              >
                {lockTarget.is_active ? <FaLock /> : <FaLockOpen />} {lockTarget.is_active ? 'Zablokuj' : 'Odblokuj'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DirectorUsers;