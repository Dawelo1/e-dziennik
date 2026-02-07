// frontend/src/director/DirectorAttendance.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Wspólne style
import LoadingScreen from '../users/LoadingScreen';

import { 
  FaUserSlash, FaSearch, FaPlus, FaTrash, FaSave, FaCalendarAlt
} from 'react-icons/fa';

const DirectorAttendance = () => {
  const [absences, setAbsences] = useState([]);
  const [children, setChildren] = useState([]); // Do listy w modalu
  const [loading, setLoading] = useState(true);
  
  // Filtry
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ child: '', date: '' });
  const [error, setError] = useState('');

  // 1. Pobieranie danych
  const fetchData = async () => {
    try {
      const [absencesRes, childrenRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/attendance/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders()) // Pobieramy dzieci
      ]);
      // Sortujemy od najnowszych
      setAbsences(absencesRes.data.sort((a,b) => new Date(b.date) - new Date(a.date)));
      setChildren(childrenRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 2. Logika filtrowania
  const getChildName = (id) => {
    const child = children.find(c => c.id === id);
    return child ? `${child.first_name} ${child.last_name}` : 'Nieznane';
  };

  const filteredAbsences = absences.filter(absence => {
    const childName = getChildName(absence.child).toLowerCase();
    const matchesSearch = childName.includes(searchQuery.toLowerCase());
    const matchesDate = filterDate ? absence.date === filterDate : true;
    return matchesSearch && matchesDate;
  });

  // 3. Otwieranie Modala
  const openModal = () => {
    setError('');
    setFormData({ child: '', date: new Date().toISOString().split('T')[0] }); // Domyślnie dziś
    setIsModalOpen(true);
  };

  // 4. Zapisywanie
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://127.0.0.1:8000/api/attendance/', formData, getAuthHeaders());
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setError("Błąd zapisu. Być może ta nieobecność jest już zgłoszona.");
      setLoading(false);
    }
  };

  // 5. Usuwanie
  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć ten wpis nieobecności?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/attendance/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
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
        <button className="honey-btn" onClick={openModal}>
          <FaPlus /> Dodaj Wpis Ręcznie
        </button>
      </div>

      {/* FILTRY */}
      <div className="filter-bar">
        <div className="search-bar-container" style={{flex: 1, margin: 0}}>
          <FaSearch className="search-icon"/>
          <input 
            type="text" 
            placeholder="Szukaj po nazwisku dziecka..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="date-filter-container">
          <FaCalendarAlt className="search-icon"/>
          <input 
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button className="clear-date-btn" onClick={() => setFilterDate('')}>
              &times;
            </button>
          )}
        </div>
      </div>

      {/* TABELA */}
      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Dziecko</th>
              <th>Data nieobecności</th>
              <th>Data zgłoszenia</th>
              <th className="text-right">Akcje</th>
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
                <td className="text-right">
                  <button className="action-icon-btn delete" onClick={() => handleDelete(absence.id)} title="Usuń">
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
            <h3>Dodaj Nieobecność</h3>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleSave} className="modal-form-grid">
              
              <div className="form-group full-width">
                <label>Dziecko</label>
                <select required value={formData.child} onChange={e => setFormData({...formData, child: e.target.value})}>
                  <option value="">-- Wybierz dziecko --</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Data nieobecności</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/>
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

export default DirectorAttendance;