// frontend/src/director/DirectorSchedule.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Wspólne style
import LoadingScreen from '../LoadingScreen';

import { 
  FaChalkboardTeacher, FaPlus, FaEdit, FaTrash, FaLayerGroup, FaSave
} from 'react-icons/fa';

const DirectorSchedule = () => {
  const [activities, setActivities] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  // Formularz
  const initialForm = {
    title: '', description: '', date: '', start_time: '', end_time: '', groups: []
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');

  // 1. POBIERANIE DANYCH
  const fetchData = async () => {
    try {
      const [actRes, groupsRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/calendar/activities/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders())
      ]);
      setActivities(actRes.data);
      setGroups(groupsRes.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // 2. OTWIERANIE MODALA
  const openModal = (activity = null) => {
    setError('');
    if (activity) {
      setEditingActivity(activity);
      setFormData({
        title: activity.title,
        description: activity.description,
        date: activity.date,
        start_time: activity.start_time.slice(0, 5), // '10:00' zamiast '10:00:00'
        end_time: activity.end_time ? activity.end_time.slice(0, 5) : '',
        groups: activity.groups || [] // Lista ID grup
      });
    } else {
      setEditingActivity(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };
  
  // Obsługa multiselecta grup
  const handleGroupToggle = (groupId) => {
    setFormData(prev => {
      const currentGroups = prev.groups || [];
      if (currentGroups.includes(groupId)) {
        return { ...prev, groups: currentGroups.filter(id => id !== groupId) };
      } else {
        return { ...prev, groups: [...currentGroups, groupId] };
      }
    });
  };

  // 3. ZAPISYWANIE
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingActivity) {
        await axios.patch(`http://127.0.0.1:8000/api/calendar/activities/${editingActivity.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/calendar/activities/', formData, getAuthHeaders());
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setError("Błąd zapisu.");
      setLoading(false);
    }
  };

  // 4. USUWANIE
  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć te zajęcia z harmonogramu?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/calendar/activities/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
      setLoading(false);
    }
  };

  if (loading && activities.length === 0) return <LoadingScreen message="Wczytywanie planu zajęć..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      <div className="page-header-row">
        <div className="page-title">
          <FaChalkboardTeacher /> Zarządzanie Zajęciami
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Zajęcia
        </button>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Zajęcia</th>
              <th>Data i Godzina</th>
              <th>Dla Grup</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {activities.map(activity => (
              <tr key={activity.id}>
                <td>
                  <div style={{fontWeight: 700}}>{activity.title}</div>
                  <div style={{fontSize: 12, color: '#666'}}>{activity.description.substring(0, 50)}...</div>
                </td>
                <td>
                  {new Date(activity.date).toLocaleDateString('pl-PL')}
                  <div style={{fontSize: 12, color: '#888'}}>
                    {activity.start_time.slice(0,5)} - {activity.end_time ? activity.end_time.slice(0,5) : ''}
                  </div>
                </td>
                <td>
                  <div style={{display:'flex', gap: 5, flexWrap:'wrap'}}>
                    {activity.groups.length > 0 ? activity.groups.map(groupId => (
                      <span key={groupId} className="role-badge parent">
                        {groups.find(g => g.id === groupId)?.name}
                      </span>
                    )) : (
                      <span className="role-badge">Wszystkie</span>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <button className="action-icon-btn edit" onClick={() => openModal(activity)}><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => handleDelete(activity.id)}><FaTrash/></button>
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
            <h3>{editingActivity ? 'Edytuj Zajęcia' : 'Nowe Zajęcia'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid">
              <div className="form-group full-width">
                <label>Nazwa</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div className="form-group"><label>Data</label><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
              <div className="form-group"><label>Godzina Rozpoczęcia</label><input type="time" required value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} /></div>
              <div className="form-group"><label>Godzina Zakończenia (opcjonalnie)</label><input type="time" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} /></div>
              
              <div className="form-group full-width">
                <label>Dla Grup (zostaw puste dla wszystkich)</label>
                <div className="checkbox-list">
                  {groups.map(g => (
                    <div key={g.id} className="checkbox-item">
                      <input type="checkbox" id={`group-${g.id}`} checked={formData.groups.includes(g.id)} onChange={() => handleGroupToggle(g.id)} />
                      <label htmlFor={`group-${g.id}`}>{g.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group full-width">
                <label>Opis</label>
                <textarea className="medical-textarea" style={{height: '80px'}} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
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

export default DirectorSchedule;