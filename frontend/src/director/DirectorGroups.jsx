// frontend/src/director/DirectorGroups.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Używamy tych samych stylów (tabela, buttony) dla spójności
import LoadingScreen from '../users/LoadingScreen';

// Ikony
import { 
  FaLayerGroup, FaSearch, FaPlus, FaEdit, FaTrash, FaChalkboardTeacher, FaSave, FaExclamationTriangle, FaTrashAlt
} from 'react-icons/fa';

const DirectorGroups = () => {
  const stripLeadingGroupEmoji = (groupName = '') => {
    return groupName.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  };

  const parseTeachersInfo = (value = '') => {
    const parts = value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    return [parts[0] || '', parts[1] || '', parts[2] || ''];
  };

  const formatTeachersInfoForDisplay = (value = '') => {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .join(' | ');
  };

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stan Modala
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); 

  // Formularz
  const initialForm = { name: '', teacher_1: '', teacher_2: '', teacher_3: '' };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [limitErrorMessage, setLimitErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [invalidFields, setInvalidFields] = useState({ name: false, teacher_1: false });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({ name: false, teacher_1: false });
  const invalidFieldTimers = useRef({ name: null, teacher_1: null });

  // 1. Pobieranie grup
  const fetchGroups = useCallback(async () => {
    // Pokazujemy loader tylko przy pierwszym ładowaniu lub gdy lista jest pusta
    if (groups.length === 0) setLoading(true);

    try {
      const res = await axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders());
      setGroups(res.data);
      if (Array.isArray(res.data) && res.data.length > 6) {
        setLimitErrorMessage('W systemie jest więcej niż 6 grup. Usuń nadmiarowe grupy, aby przywrócić poprawną konfigurację kolorów.');
      }
    } catch (err) {
      console.error("Błąd pobierania grup:", err);
    } finally {
      setLoading(false);
    }
  }, [groups.length]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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
    const timers = invalidFieldTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Filtrowanie lokalne (bo grup jest mało, nie trzeba pytać API przy każdej literce)
  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.teachers_info || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. Otwieranie Modala
  const openModal = (group = null) => {
    setError('');
    setActionError('');
    setLimitErrorMessage('');
    setInvalidFields({ name: false, teacher_1: false });
    setRequiredFieldErrors({ name: false, teacher_1: false });
    if (group) {
      const [teacher1, teacher2, teacher3] = parseTeachersInfo(group.teachers_info);
      setEditingGroup(group);
      setFormData({
        name: stripLeadingGroupEmoji(group.name),
        teacher_1: teacher1,
        teacher_2: teacher2,
        teacher_3: teacher3
      });
    } else {
      setEditingGroup(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  // 3. Zapisywanie
  const handleSave = async (e) => {
    e.preventDefault();

    if (!editingGroup && groups.length >= 6) {
      setLimitErrorMessage('Maksymalna liczba grup to 6. Usuń jedną z istniejących grup, aby dodać nową.');
      return;
    }

    const trimmedName = stripLeadingGroupEmoji(formData.name.trim());
    const trimmedTeacher1 = formData.teacher_1.trim();
    const missingName = !trimmedName;
    const missingTeacher1 = !trimmedTeacher1;
    setRequiredFieldErrors({ name: missingName, teacher_1: missingTeacher1 });
    if (missingName) {
      triggerInvalidField('name');
    }
    if (missingTeacher1) triggerInvalidField('teacher_1');
    if (missingName || missingTeacher1) return;

    setError('');
    setLoading(true); // Pszczółka podczas zapisu

    const payload = {
      name: trimmedName,
      teachers_info: [trimmedTeacher1, formData.teacher_2, formData.teacher_3]
        .map((item) => item.trim())
        .filter(Boolean)
        .join(', ')
    };

    try {
      if (editingGroup) {
        // UPDATE
        await axios.patch(
          `http://127.0.0.1:8000/api/groups/${editingGroup.id}/`, 
          payload, 
          getAuthHeaders()
        );
      } else {
        // CREATE
        await axios.post(
          'http://127.0.0.1:8000/api/groups/', 
          payload, 
          getAuthHeaders()
        );
      }
      setIsModalOpen(false);
      await fetchGroups(); // Odśwież listę
    } catch (err) {
      console.error(err);

      const apiErrors = err?.response?.data;
      const detailMessage = typeof apiErrors?.detail === 'string' ? apiErrors.detail : '';

      if (
        detailMessage.toLowerCase().includes('maksymalna liczba grup to 6') ||
        detailMessage.toLowerCase().includes('brak wolnych kolorów grup')
      ) {
        setLimitErrorMessage(detailMessage);
      } else if (apiErrors?.name?.[0]) {
        setError(`Nazwa grupy: ${apiErrors.name[0]}`);
      } else if (apiErrors?.teachers_info?.[0]) {
        setError(`Nauczyciele / Wychowawcy: ${apiErrors.teachers_info[0]}`);
      } else if (detailMessage) {
        setError(detailMessage);
      } else {
        setError('Wystąpił błąd podczas zapisu.');
      }

      setLoading(false);
    }
  };

  // 4. Usuwanie
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');

    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/groups/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchGroups();
    } catch {
      setActionError('Nie udało się usunąć grupy (może są do niej przypisane dzieci?).');
      setLoading(false);
    }
  };

  // --- WIDOK ---

  if (loading && groups.length === 0) {
     return <LoadingScreen message="Wczytywanie grup..." />;
  }

  if (loading) {
      return <LoadingScreen message="Przetwarzanie..." />;
  }

  return (
    <div className="director-container">
      
      {/* NAGŁÓWEK */}
      <div className="page-header-row">
        <h2 className="page-title">
          <FaLayerGroup /> Zarządzanie Grupami
        </h2>
      </div>

      {/* PASEK WYSZUKIWANIA */}
      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon"/>
          <input 
            type="text" 
            placeholder="Szukaj grupy lub nauczyciela..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Grupę
        </button>
      </div>

      {/* TABELA GRUP */}
      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{width: '30%'}}>Nazwa Grupy</th>
              <th>Nauczyciele</th>
              <th className="actions-header" style={{width: '100px'}}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length === 0 ? (
              <tr><td colSpan="3" className="text-center">Brak grup.</td></tr>
            ) : (
              filteredGroups.map(group => (
                <tr key={group.id}>
                  <td>
                    <span style={{fontWeight: '700', color: '#333', fontSize: '15px'}}>
                      {stripLeadingGroupEmoji(group.name)}
                    </span>
                  </td>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#666'}}>
                      <FaChalkboardTeacher style={{color: '#f2c94c'}}/>
                      {formatTeachersInfoForDisplay(group.teachers_info)}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <button className="action-icon-btn edit" onClick={() => openModal(group)} title="Edytuj">
                      <FaEdit />
                    </button>
                    <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(group); }} title="Usuń">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingGroup ? 'Edytuj Grupę' : 'Dodaj Nową Grupę'}</h3>
            
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid" noValidate>
              
              <div className="form-group full-width">
                <label>Nazwa Grupy <span className="required-asterisk">*</span></label>
                <input 
                  type="text"
                  placeholder="np. Pszczółki"
                  value={formData.name}
                  onChange={e => {
                    setFormData({...formData, name: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('name');
                      setRequiredFieldErrors((prev) => ({ ...prev, name: false }));
                    }
                  }}
                  className={invalidFields.name ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.name && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group full-width">
                <label>Nauczyciel 1 <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  placeholder="Wpisz imię i nazwisko nauczyciela..."
                  value={formData.teacher_1}
                  onChange={e => {
                    setFormData({...formData, teacher_1: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('teacher_1');
                      setRequiredFieldErrors((prev) => ({ ...prev, teacher_1: false }));
                    }
                  }}
                  className={invalidFields.teacher_1 ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.teacher_1 && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group full-width">
                <label>Nauczyciel 2</label>
                <input
                  type="text"
                  placeholder="Wpisz imię i nazwisko nauczyciela..."
                  value={formData.teacher_2}
                  onChange={e => setFormData({...formData, teacher_2: e.target.value})}
                />
              </div>

              <div className="form-group full-width">
                <label>Nauczyciel 3</label>
                <input
                  type="text"
                  placeholder="Wpisz imię i nazwisko nauczyciela..."
                  value={formData.teacher_3}
                  onChange={e => setFormData({...formData, teacher_3: e.target.value})}
                />
              </div>

              <div className="modal-actions full-width">
                <button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Anuluj</button>
                <button type="submit" className="modal-btn confirm success"><FaSave /> Zapisz</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Usunąć grupę?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć grupę
              {` "${stripLeadingGroupEmoji(deleteTarget.name)}"`}
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

      {limitErrorMessage && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Nie można dodać grupy</h3>
            <p>{limitErrorMessage}</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setLimitErrorMessage('')}>Zamknij</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DirectorGroups;