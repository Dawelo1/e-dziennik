// frontend/src/director/DirectorCalendar.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Wspólne style
import LoadingScreen from '../LoadingScreen';

import { 
  FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaSave
} from 'react-icons/fa';

const DirectorCalendar = () => {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState(null);
  const [formData, setFormData] = useState({ date: '', reason: '' });
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/calendar/closures/', getAuthHeaders());
      setClosures(res.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (closure = null) => {
    setError('');
    if (closure) {
      setEditingClosure(closure);
      setFormData({ date: closure.date, reason: closure.reason });
    } else {
      setEditingClosure(null);
      setFormData({ date: new Date().toISOString().split('T')[0], reason: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingClosure) {
        await axios.patch(`http://127.0.0.1:8000/api/calendar/closures/${editingClosure.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/calendar/closures/', formData, getAuthHeaders());
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setError("Błąd zapisu. Sprawdź, czy ta data nie jest już dodana.");
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć ten dzień wolny?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/calendar/closures/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
      setLoading(false);
    }
  };

  if (loading && closures.length === 0) return <LoadingScreen message="Wczytywanie kalendarza..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <div className="page-title">
          <FaCalendarAlt /> Zarządzanie Dniami Wolnymi
        </div>
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
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {closures.map(closure => (
              <tr key={closure.id}>
                <td style={{fontWeight: 700}}>{new Date(closure.date).toLocaleDateString('pl-PL', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</td>
                <td>{closure.reason}</td>
                <td className="text-right">
                  <button className="action-icon-btn edit" onClick={() => openModal(closure)}><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => handleDelete(closure.id)}><FaTrash/></button>
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
            <form onSubmit={handleSave} className="modal-form-grid" style={{gridTemplateColumns: '1fr'}}>
              
              <div className="form-group full-width">
                <label>Data *</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} disabled={!!editingClosure} />
              </div>

              <div className="form-group full-width">
                <label>Powód (np. Boże Narodzenie)</label>
                <input type="text" required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
              </div>

              <div className="modal-actions full-width">
                <button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Anuluj</button>
                <button type="submit" className="modal-btn confirm success"><FaSave /> Zapisz</button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorCalendar;