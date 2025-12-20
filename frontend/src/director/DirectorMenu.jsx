// frontend/src/director/DirectorMenu.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Wspólne style
import LoadingScreen from '../LoadingScreen';

import { 
  FaUtensils, FaPlus, FaEdit, FaTrash, FaSave, FaCalendarAlt
} from 'react-icons/fa';

const DirectorMenu = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtr
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const initialForm = {
    date: new Date().toISOString().split('T')[0],
    breakfast_soup: '', breakfast_main_course: '', breakfast_beverage: '', breakfast_fruit: '',
    lunch_soup: '', lunch_main_course: '', lunch_beverage: '', lunch_fruit: '',
    fruit_break: '', allergens: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/menu/', getAuthHeaders());
      setMenus(res.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredMenus = menus.filter(menu => filterDate ? menu.date === filterDate : true);

  const openModal = (menu = null) => {
    setError('');
    if (menu) {
      setEditingMenu(menu);
      setFormData({
        date: menu.date,
        breakfast_soup: menu.breakfast_soup || '',
        breakfast_main_course: menu.breakfast_main_course || '',
        breakfast_beverage: menu.breakfast_beverage || '',
        breakfast_fruit: menu.breakfast_fruit || '',
        lunch_soup: menu.lunch_soup || '',
        lunch_main_course: menu.lunch_main_course || '',
        lunch_beverage: menu.lunch_beverage || '',
        lunch_fruit: menu.lunch_fruit || '',
        fruit_break: menu.fruit_break || '',
        allergens: menu.allergens || ''
      });
    } else {
      setEditingMenu(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingMenu) {
        await axios.patch(`http://127.0.0.1:8000/api/menu/${editingMenu.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/menu/', formData, getAuthHeaders());
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setError("Błąd zapisu. Sprawdź, czy na ten dzień nie ma już jadłospisu.");
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć ten jadłospis?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/menu/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
      setLoading(false);
    }
  };

  if (loading && menus.length === 0) return <LoadingScreen message="Wczytywanie jadłospisów..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaUtensils /> Zarządzanie Jadłospisem
        </h2>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Jadłospis na Dzień
        </button>
      </div>

      {/* FILTRY */}
      <div className="filter-bar">
        <div className="date-filter-container" style={{width: 'auto'}}>
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
        <button className="honey-btn" style={{padding: '10px 20px'}} onClick={() => setFilterDate('')}>
          Pokaż Wszystkie
        </button>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Śniadanie</th>
              <th>Obiad</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredMenus.map(menu => (
              <tr key={menu.id}>
                <td style={{fontWeight: 700}}>{new Date(menu.date).toLocaleDateString('pl-PL', {weekday:'long', day:'numeric', month:'long'})}</td>
                <td>{menu.breakfast_main_course || '-'}</td>
                <td>{menu.lunch_main_course || '-'}</td>
                <td className="text-right">
                  <button className="action-icon-btn edit" onClick={() => openModal(menu)}><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => handleDelete(menu.id)}><FaTrash/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{maxWidth: '800px'}}>
            <h3>{editingMenu ? `Edytuj Jadłospis na ${formData.date}` : 'Nowy Jadłospis'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave}>
              <div className="form-group" style={{marginBottom: 20}}>
                <label>Data *</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} disabled={!!editingMenu} />
              </div>

              <div className="modal-form-grid">
                {/* Śniadanie */}
                <fieldset className="form-fieldset">
                  <legend>Śniadanie</legend>
                  <div className="form-group"><input type="text" placeholder="Zupa / Mleczna" value={formData.breakfast_soup} onChange={e => setFormData({...formData, breakfast_soup: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Drugie danie / Kanapki" value={formData.breakfast_main_course} onChange={e => setFormData({...formData, breakfast_main_course: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Napój" value={formData.breakfast_beverage} onChange={e => setFormData({...formData, breakfast_beverage: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Owoc / Dodatek" value={formData.breakfast_fruit} onChange={e => setFormData({...formData, breakfast_fruit: e.target.value})} /></div>
                </fieldset>
                
                {/* Obiad */}
                <fieldset className="form-fieldset">
                  <legend>Obiad</legend>
                  <div className="form-group"><input type="text" placeholder="Zupa" value={formData.lunch_soup} onChange={e => setFormData({...formData, lunch_soup: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Drugie danie" value={formData.lunch_main_course} onChange={e => setFormData({...formData, lunch_main_course: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Napój" value={formData.lunch_beverage} onChange={e => setFormData({...formData, lunch_beverage: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Deser / Owoc" value={formData.lunch_fruit} onChange={e => setFormData({...formData, lunch_fruit: e.target.value})} /></div>
                </fieldset>
              </div>
              
              <div className="modal-form-grid" style={{marginTop: 20}}>
                <div className="form-group"><label>Podwieczorek</label><input type="text" value={formData.fruit_break} onChange={e => setFormData({...formData, fruit_break: e.target.value})} /></div>
                <div className="form-group"><label>Alergeny</label><input type="text" placeholder="np. 1, 3, 7" value={formData.allergens} onChange={e => setFormData({...formData, allergens: e.target.value})} /></div>
              </div>
              
              <div className="modal-actions full-width" style={{marginTop: 30}}>
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

export default DirectorMenu;