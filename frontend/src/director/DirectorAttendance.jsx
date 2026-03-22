// frontend/src/director/DirectorAttendance.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Wspólne style
import LoadingScreen from '../users/LoadingScreen';

import { 
  FaUserSlash, FaSearch, FaPlus, FaTrash, FaSave, FaExclamationTriangle, FaTrashAlt, FaEdit
} from 'react-icons/fa';

const DirectorAttendance = () => {
  const [searchParams] = useSearchParams();
  const dayFilter = searchParams.get('day') || '';
  const weekFilterAnchor = searchParams.get('week') || '';
  const [absences, setAbsences] = useState([]);
  const [children, setChildren] = useState([]); // Do listy w modalu
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtry
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ child: '', date: '' });
  const [editingAbsence, setEditingAbsence] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [invalidFields, setInvalidFields] = useState({ child: false, date: false });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({ child: false, date: false });
  const invalidFieldTimers = useRef({ child: null, date: null });

  const weekRange = useMemo(() => {
    if (!weekFilterAnchor) return null;

    const anchorDate = new Date(`${weekFilterAnchor}T00:00:00`);
    if (Number.isNaN(anchorDate.getTime())) return null;

    const day = anchorDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const monday = new Date(anchorDate);
    monday.setDate(anchorDate.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    return { monday, friday };
  }, [weekFilterAnchor]);

  // 1. Pobieranie danych
  const fetchData = async () => {
    try {
      const [absencesRes, childrenRes, closuresRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/attendance/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders()), // Pobieramy dzieci
        axios.get('http://127.0.0.1:8000/api/calendar/closures/', getAuthHeaders())
      ]);
      // Sortujemy od najnowszych
      setAbsences(absencesRes.data.sort((a,b) => new Date(b.date) - new Date(a.date)));
      setChildren(childrenRes.data);
      setClosures(closuresRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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

  // 2. Logika filtrowania
  const getChildName = (id) => {
    const child = children.find(c => c.id === id);
    return child ? `${child.first_name} ${child.last_name}` : 'Nieznane';
  };

  const filteredAbsences = absences.filter(absence => {
    if (dayFilter && absence.date !== dayFilter) {
      return false;
    }

    if (weekRange) {
      const absenceDateObj = new Date(`${absence.date}T00:00:00`);
      if (Number.isNaN(absenceDateObj.getTime())) return false;

      if (absenceDateObj < weekRange.monday || absenceDateObj > weekRange.friday) {
        return false;
      }
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const childName = getChildName(absence.child).toLowerCase();

    const absenceDate = new Date(absence.date);
    const createdAtDate = new Date(absence.created_at);

    const absenceDateLocale = absenceDate.toLocaleDateString('pl-PL').toLowerCase();
    const absenceDateIso = absence.date.toLowerCase();
    const createdAtDateLocale = createdAtDate.toLocaleDateString('pl-PL').toLowerCase();
    const createdAtDateTimeLocale = createdAtDate.toLocaleString('pl-PL').toLowerCase();
    const createdAtDateIso = absence.created_at.toLowerCase();

    return (
      childName.includes(query) ||
      absenceDateLocale.includes(query) ||
      absenceDateIso.includes(query) ||
      createdAtDateLocale.includes(query) ||
      createdAtDateTimeLocale.includes(query) ||
      createdAtDateIso.includes(query)
    );
  });

  const getDayOffReason = (dateString) => {
    if (!dateString) return null;

    const selectedDate = new Date(`${dateString}T00:00:00`);
    const dayOfWeek = selectedDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'To dzień wolny od zajęć (weekend).';
    }

    const closure = closures.find((item) => item.date === dateString);
    if (closure) {
      return closure.reason
        ? `To dzień wolny od zajęć: "${closure.reason}".`
        : 'To dzień wolny od zajęć.';
    }

    return null;
  };

  // 3. Otwieranie Modala
  const openModal = (absence = null) => {
    const nextAbsence = absence && typeof absence === 'object' && 'id' in absence ? absence : null;
    setError('');
    setActionError('');
    setInvalidFields({ child: false, date: false });
    setRequiredFieldErrors({ child: false, date: false });
    setEditingAbsence(nextAbsence);
    if (nextAbsence) {
      setFormData({ child: String(nextAbsence.child), date: nextAbsence.date });
    } else {
      setFormData({ child: '', date: new Date().toISOString().split('T')[0] }); // Domyślnie dziś
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAbsence(null);
    setError('');
    setRequiredFieldErrors({ child: false, date: false });
    setInvalidFields({ child: false, date: false });
  };

  // 4. Zapisywanie
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const missingChild = !String(formData.child).trim();
    const missingDate = !String(formData.date).trim();

    setRequiredFieldErrors({
      child: missingChild,
      date: missingDate
    });

    if (missingChild) triggerInvalidField('child');
    if (missingDate) triggerInvalidField('date');
    if (missingChild || missingDate) return;

    const dayOffReason = getDayOffReason(formData.date);
    if (dayOffReason) {
      triggerInvalidField('date');
      setError(`Nie można zapisać nieobecności. ${dayOffReason}`);
      return;
    }

    setLoading(true);
    try {
      if (editingAbsence?.id) {
        await axios.patch(`http://127.0.0.1:8000/api/attendance/${editingAbsence.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/attendance/', formData, getAuthHeaders());
      }
      closeModal();
      await fetchData();
    } catch (err) {
      const apiError = err?.response?.data;
      const errorMessage =
        apiError?.date?.[0] ||
        apiError?.non_field_errors?.[0] ||
        apiError?.detail ||
        (typeof apiError === 'string' ? apiError : null);

      setError(errorMessage || "Błąd zapisu. Sprawdź dane i spróbuj ponownie.");
      setLoading(false);
    }
  };

  // 5. Usuwanie
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/attendance/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setActionError('Nie udało się usunąć wpisu nieobecności. Spróbuj ponownie później.');
      setLoading(false);
    }
  };

  if (loading && absences.length === 0) return <LoadingScreen message="Wczytywanie nieobecności..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaUserSlash /> Zarządzanie Nieobecnościami
        </h2>
      </div>

      {/* FILTRY */}
      <div className="filter-bar">
        <div className="search-bar-container" style={{flex: 1, margin: 0}}>
          <FaSearch className="search-icon"/>
          <input 
            type="text" 
            placeholder="Szukaj po nazwisku, dacie nieobecności lub zgłoszenia..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Nieobecność
        </button>
      </div>

      {/* TABELA */}
      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Dziecko</th>
              <th>Data nieobecności</th>
              <th>Data zgłoszenia</th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredAbsences.map(absence => (
              <tr key={absence.id}>
                <td>
                  <span style={{fontWeight: 700}}>{getChildName(absence.child)}</span>
                </td>
                <td>{new Date(absence.date).toLocaleDateString('pl-PL')}</td>
                <td>{new Date(absence.created_at).toLocaleString('pl-PL')}</td>
                <td className="actions-cell">
                  <button className="action-icon-btn edit" onClick={() => openModal(absence)} title="Edytuj">
                    <FaEdit />
                  </button>
                  <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(absence); }} title="Usuń">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingAbsence ? 'Edytuj Nieobecność' : 'Dodaj Nieobecność'}</h3>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleSave} className="modal-form-grid" noValidate>
              
              <div className="form-group full-width">
                <label>Dziecko <span className="required-asterisk">*</span></label>
                <select
                  value={formData.child}
                  onChange={e => {
                    const nextValue = e.target.value;
                    setFormData({...formData, child: nextValue});
                    if (String(nextValue).trim()) {
                      clearInvalidField('child');
                      setRequiredFieldErrors((prev) => ({ ...prev, child: false }));
                    }
                  }}
                  className={invalidFields.child ? 'invalid-bounce' : ''}
                >
                  <option value="">-- Wybierz dziecko --</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
                {requiredFieldErrors.child && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group full-width">
                <label>Data nieobecności <span className="required-asterisk">*</span></label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => {
                    const nextValue = e.target.value;
                    setFormData({...formData, date: nextValue});
                    if (String(nextValue).trim()) {
                      clearInvalidField('date');
                      setRequiredFieldErrors((prev) => ({ ...prev, date: false }));
                    }
                  }}
                  className={invalidFields.date ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.date && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="modal-actions full-width">
                <button type="button" className="modal-btn cancel" onClick={closeModal}>Anuluj</button>
                <button type="submit" className="modal-btn confirm success"><FaSave /> {editingAbsence ? 'Zapisz zmiany' : 'Zapisz'}</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Usunąć wpis nieobecności?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć wpis nieobecności dla dziecka
              {` "${getChildName(deleteTarget.child)}"`}?
              Tej operacji nie można cofnąć.
            </p>
            {actionError && <div className="form-error">{actionError}</div>}
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => { setActionError(''); setDeleteTarget(null); }}>Anuluj</button>
              <button className="modal-btn confirm danger" onClick={handleDelete}><FaTrashAlt /> Usuń</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorAttendance;