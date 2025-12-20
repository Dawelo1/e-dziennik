// frontend/src/director/DirectorChildren.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Używamy stylów z Users dla spójności
import LoadingScreen from '../LoadingScreen';

import { 
  FaChild, FaSearch, FaPlus, FaEdit, FaTrash, 
  FaLayerGroup, FaUserFriends, FaSave, FaTimes
} from 'react-icons/fa';

const DirectorChildren = () => {
  const [children, setChildren] = useState([]);
  const [groups, setGroups] = useState([]);
  const [parents, setParents] = useState([]); // Lista wszystkich rodziców do wyboru
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState(null);

  // Formularz
  const initialForm = {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    group: '',     // ID grupy
    parents: [],   // Tablica ID rodziców
    medical_info: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');

  // 1. POBIERANIE DANYCH (Dzieci, Grupy, Rodzice)
  const fetchData = async () => {
    try {
      const [childRes, groupRes, userRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/manage/', getAuthHeaders()) // Pobieramy wszystkich userów
      ]);

      setChildren(childRes.data);
      setGroups(groupRes.data);
      
      // Filtrujemy userów, bierzemy tylko rodziców (is_parent=true)
      const parentUsers = userRes.data.filter(u => u.is_parent);
      setParents(parentUsers);

    } catch (err) {
      console.error("Błąd pobierania danych:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrowanie listy
  const filteredChildren = children.filter(c => 
    c.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. OTWIERANIE MODALA
  const openModal = (child = null) => {
    setError('');
    if (child) {
      setEditingChild(child);
      setFormData({
        first_name: child.first_name,
        last_name: child.last_name,
        date_of_birth: child.date_of_birth,
        group: child.group, // API zwraca ID grupy w tym polu? Sprawdzimy.
        // Jeśli serializer zwraca obiekty rodziców, musimy mapować na ID
        parents: child.parents, 
        medical_info: child.medical_info || ''
      });
    } else {
      setEditingChild(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  // Obsługa Multiselecta dla Rodziców
  const handleParentToggle = (parentId) => {
    setFormData(prev => {
      const currentParents = prev.parents || [];
      if (currentParents.includes(parentId)) {
        // Usuń
        return { ...prev, parents: currentParents.filter(id => id !== parentId) };
      } else {
        // Dodaj (Max 2)
        if (currentParents.length >= 2) {
          alert("Maksymalnie 2 rodziców.");
          return prev;
        }
        return { ...prev, parents: [...currentParents, parentId] };
      }
    });
  };

  // 3. ZAPISYWANIE
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingChild) {
        await axios.patch(`http://127.0.0.1:8000/api/children/${editingChild.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/children/', formData, getAuthHeaders());
      }
      setIsModalOpen(false);
      await fetchData(); // Odśwież wszystko
    } catch (err) {
      console.error(err);
      setError("Wystąpił błąd zapisu. Sprawdź poprawność danych.");
      setLoading(false);
    }
  };

  // 4. USUWANIE
  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć kartotekę dziecka?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/children/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
      setLoading(false);
    }
  };

  // Helper do wyświetlania nazwy grupy
  const getGroupName = (id) => {
    const g = groups.find(x => x.id === id);
    return g ? g.name : '-';
  };

  if (loading && children.length === 0) return <LoadingScreen message="Wczytywanie dzieci..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaChild /> Kartoteki Dzieci
        </h2>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Dziecko
        </button>
      </div>

      <div className="search-bar-container">
        <FaSearch className="search-icon"/>
        <input 
          type="text" 
          placeholder="Szukaj dziecka..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Dziecko</th>
              <th>Grupa</th>
              <th>Rodzice / Opiekunowie</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredChildren.map(child => (
              <tr key={child.id}>
                <td>
                  <div className="user-cell">
                    <div className="avatar-circle parent" style={{background: '#4caf50'}}>
                      {child.first_name[0]}
                    </div>
                    <div className="contact-info">
                      <span className="username-text">{child.first_name} {child.last_name}</span>
                      <span className="sub-text">{child.date_of_birth}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="role-badge" style={{background: '#e3f2fd', color: '#1565c0'}}>
                    <FaLayerGroup/> {getGroupName(child.group)}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex', gap: 5, flexWrap:'wrap'}}>
                    {child.parents && child.parents.map(parentId => {
                       const p = parents.find(u => u.id === parentId);
                       return p ? (
                         <span key={p.id} className="role-badge parent" style={{fontSize: 11}}>
                           {p.first_name} {p.last_name}
                         </span>
                       ) : null;
                    })}
                  </div>
                </td>
                <td className="text-right">
                  <button className="action-icon-btn edit" onClick={() => openModal(child)}><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => handleDelete(child.id)}><FaTrash/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h3>{editingChild ? 'Edytuj Dziecko' : 'Dodaj Dziecko'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid">
              
              <div className="form-group">
                <label>Imię</label>
                <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})}/>
              </div>
              <div className="form-group">
                <label>Nazwisko</label>
                <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})}/>
              </div>

              <div className="form-group">
                <label>Data urodzenia</label>
                <input type="date" required value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})}/>
              </div>

              <div className="form-group">
                <label>Grupa</label>
                <select required value={formData.group} onChange={e => setFormData({...formData, group: parseInt(e.target.value)})}>
                  <option value="">-- Wybierz grupę --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* LISTA WYBORU RODZICÓW */}
              <div className="form-group full-width">
                <label>Przypisz Rodziców (Max 2)</label>
                <div style={{maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px'}}>
                  {parents.map(p => (
                    <div key={p.id} style={{padding: '5px', borderBottom:'1px solid #f9f9f9', display:'flex', alignItems:'center'}}>
                      <input 
                        type="checkbox" 
                        checked={formData.parents.includes(p.id)}
                        onChange={() => handleParentToggle(p.id)}
                        style={{width: 'auto', marginRight: '10px'}}
                      />
                      <span>{p.first_name} {p.last_name} (@{p.username})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group full-width">
                <label>Info Medyczne</label>
                <textarea 
                   className="medical-textarea" 
                   style={{height: '80px'}}
                   value={formData.medical_info}
                   onChange={e => setFormData({...formData, medical_info: e.target.value})}
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

export default DirectorChildren;