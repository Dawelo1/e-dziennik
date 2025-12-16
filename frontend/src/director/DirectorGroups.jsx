// frontend/src/director/DirectorGroups.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Używamy tych samych stylów (tabela, buttony) dla spójności
import LoadingScreen from '../LoadingScreen';

// Ikony
import { 
  FaLayerGroup, FaSearch, FaPlus, FaEdit, FaTrash, FaChalkboardTeacher, FaSave
} from 'react-icons/fa';

const DirectorGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stan Modala
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); 

  // Formularz
  const initialForm = { name: '', teachers_info: '' };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');

  // 1. Pobieranie grup
  const fetchGroups = async () => {
    // Pokazujemy loader tylko przy pierwszym ładowaniu lub gdy lista jest pusta
    if (groups.length === 0) setLoading(true);

    try {
      const res = await axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders());
      setGroups(res.data);
    } catch (err) {
      console.error("Błąd pobierania grup:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Filtrowanie lokalne (bo grup jest mało, nie trzeba pytać API przy każdej literce)
  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.teachers_info.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. Otwieranie Modala
  const openModal = (group = null) => {
    setError('');
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        teachers_info: group.teachers_info
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
    setError('');
    setLoading(true); // Pszczółka podczas zapisu

    try {
      if (editingGroup) {
        // UPDATE
        await axios.patch(
          `http://127.0.0.1:8000/api/groups/${editingGroup.id}/`, 
          formData, 
          getAuthHeaders()
        );
      } else {
        // CREATE
        await axios.post(
          'http://127.0.0.1:8000/api/groups/', 
          formData, 
          getAuthHeaders()
        );
      }
      setIsModalOpen(false);
      await fetchGroups(); // Odśwież listę
    } catch (err) {
      console.error(err);
      setError('Wystąpił błąd podczas zapisu.');
      setLoading(false);
    }
  };

  // 4. Usuwanie
  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę grupę?")) return;
    
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/groups/${id}/`, getAuthHeaders());
      await fetchGroups();
    } catch (err) {
      alert("Nie udało się usunąć grupy (może są do niej przypisane dzieci?).");
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
        <div className="page-title">
          <FaLayerGroup /> Zarządzanie Grupami
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Grupę
        </button>
      </div>

      {/* PASEK WYSZUKIWANIA */}
      <div className="search-bar-container">
        <FaSearch className="search-icon"/>
        <input 
          type="text" 
          placeholder="Szukaj grupy lub nauczyciela..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* TABELA GRUP */}
      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{width: '30%'}}>Nazwa Grupy</th>
              <th>Nauczyciele / Opis</th>
              <th className="text-right" style={{width: '100px'}}>Akcje</th>
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
                      {group.name}
                    </span>
                  </td>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#666'}}>
                      <FaChalkboardTeacher style={{color: '#f2c94c'}}/>
                      {group.teachers_info}
                    </div>
                  </td>
                  <td className="text-right">
                    <button className="action-icon-btn edit" onClick={() => openModal(group)} title="Edytuj">
                      <FaEdit />
                    </button>
                    <button className="action-icon-btn delete" onClick={() => handleDelete(group.id)} title="Usuń">
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

            <form onSubmit={handleSave} className="modal-form-grid">
              
              <div className="form-group full-width">
                <label>Nazwa Grupy *</label>
                <input 
                  type="text" required
                  placeholder="np. Pszczółki"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="form-group full-width">
                <label>Nauczyciele / Wychowawcy</label>
                <textarea 
                  className="medical-textarea" // Używamy stylu textarea z Settings/Users
                  style={{height: '100px'}}
                  placeholder="Wpisz imiona i nazwiska nauczycieli..."
                  value={formData.teachers_info}
                  onChange={e => setFormData({...formData, teachers_info: e.target.value})}
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

    </div>
  );
};

export default DirectorGroups;