// frontend/src/director/DirectorCalendar.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Wspólne style
import LoadingScreen from '../users/LoadingScreen';

import { 
  FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaSave, FaExclamationTriangle, FaTrashAlt
} from 'react-icons/fa';

const DirectorCalendar = () => {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState(null);
  const [formData, setFormData] = useState({ date: '', reason: '' });
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [closureImpactTarget, setClosureImpactTarget] = useState(null);
  const [invalidFields, setInvalidFields] = useState({ date: false });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({ date: false });
  const invalidFieldTimers = useRef({ date: null });

  const fetchData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/calendar/closures/', getAuthHeaders());
      setClosures(res.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
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

  const openModal = (closure = null) => {
    setError('');
    setActionError('');
    setClosureImpactTarget(null);
    setInvalidFields({ date: false });
    setRequiredFieldErrors({ date: false });
    if (closure) {
      setEditingClosure(closure);
      setFormData({ date: closure.date, reason: closure.reason });
    } else {
      setEditingClosure(null);
      setFormData({ date: new Date().toISOString().split('T')[0], reason: '' });
    }
    setIsModalOpen(true);
  };

  const saveClosure = async () => {
    setLoading(true);
    try {
      if (editingClosure) {
        await axios.patch(`http://127.0.0.1:8000/api/calendar/closures/${editingClosure.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/calendar/closures/', formData, getAuthHeaders());
      }
      setIsModalOpen(false);
      setClosureImpactTarget(null);
      await fetchData();
    } catch (err) {
      setError("Błąd zapisu. Sprawdź, czy ta data nie jest już dodana.");
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const missingDate = !formData.date.trim();
    setRequiredFieldErrors({ date: missingDate });
    if (missingDate) {
      triggerInvalidField('date');
      return;
    }

    try {
      if (!editingClosure) {
        const attendanceRes = await axios.get('http://127.0.0.1:8000/api/attendance/', getAuthHeaders());
        const absencesForSelectedDate = attendanceRes.data.filter(
          (entry) => entry.date === formData.date
        ).length;

        if (absencesForSelectedDate > 0) {
          setClosureImpactTarget({
            date: formData.date,
            absencesCount: absencesForSelectedDate
          });
          return;
        }
      }

      await saveClosure();
    } catch (err) {
      setError("Błąd zapisu. Sprawdź, czy ta data nie jest już dodana.");
      setLoading(false);
    }
  };

  const handleConfirmClosureImpact = async () => {
    await saveClosure();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/calendar/closures/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setActionError('Nie udało się usunąć dnia wolnego. Spróbuj ponownie później.');
      setLoading(false);
    }
  };

  if (loading && closures.length === 0) return <LoadingScreen message="Wczytywanie kalendarza..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  const sortedClosures = [...closures].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaCalendarAlt /> Zarządzanie Dniami Wolnymi
        </h2>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Dzień Wolny
        </button>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Powód / Nazwa święta</th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedClosures.map(closure => (
              <tr key={closure.id}>
                <td style={{fontWeight: 700}}>{new Date(closure.date).toLocaleDateString('pl-PL', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</td>
                <td>{closure.reason}</td>
                <td className="actions-cell">
                  <button className="action-icon-btn edit" onClick={() => openModal(closure)} title="Edytuj dzień wolny"><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(closure); }} title="Usuń dzień wolny"><FaTrash/></button>
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
            <h3>{editingClosure ? 'Edytuj Dzień Wolny' : 'Nowy Dzień Wolny'}</h3>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleSave} className="modal-form-grid" style={{gridTemplateColumns: '1fr'}} noValidate>
              
              <div className="form-group full-width">
                <label>Data <span className="required-asterisk">*</span></label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => {
                    setFormData({...formData, date: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('date');
                      setRequiredFieldErrors((prev) => ({ ...prev, date: false }));
                    }
                  }}
                  disabled={!!editingClosure}
                  className={invalidFields.date ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.date && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group full-width">
                <label>Powód (np. Boże Narodzenie)</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  placeholder="Nazwa wydarzenia..."
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
            <h3>Usunąć dzień wolny?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć dzień wolny
              {` "${new Date(deleteTarget.date).toLocaleDateString('pl-PL')}"`}
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

      {closureImpactTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Dodać dzień wolny?</h3>
            <p>
              Dla dnia {` "${new Date(closureImpactTarget.date).toLocaleDateString('pl-PL')}" `}
              istnieje {closureImpactTarget.absencesCount} zgłoszeń nieobecności.
              Dodanie dnia wolnego usunie te zgłoszenia.
            </p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setClosureImpactTarget(null)}>Anuluj</button>
              <button className="modal-btn confirm danger" onClick={handleConfirmClosureImpact}><FaSave /> Dodaj mimo to</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorCalendar;