// frontend/src/director/DirectorGallery.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Wspólne style
import './DirectorGallery.css'; // Dedykowane style
import LoadingScreen from '../LoadingScreen';

import { 
  FaImages, FaPlus, FaEdit, FaTrash, FaSearch, 
  FaLayerGroup, FaBullhorn, FaSave, FaUpload, FaTimes
} from 'react-icons/fa';

const DirectorGallery = () => {
  const [albums, setAlbums] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true); // Zaczynamy z loading=true
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const initialForm = { title: '', description: '', target_group: '' };
  const [formData, setFormData] = useState(initialForm);
  
  // Zdjęcia
  const [newImages, setNewImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // --- POPRAWIONE POBIERANIE DANYCH ---
  const fetchData = async () => {
    // Nie włączamy loading, bo jest już włączony na starcie
    try {
      const [albumsRes, groupsRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/gallery/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders())
      ]);
      setAlbums(albumsRes.data);
      setGroups(groupsRes.data);
    } catch (err) {
      console.error("Błąd pobierania galerii:", err);
    } finally {
      // Zawsze wyłączamy loading, nawet jak nic nie przyszło
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAlbums = albums.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const openModal = (album = null) => {
    setError('');
    setNewImages([]);
    setExistingImages([]);
    setImagesToDelete([]);
    
    if (album) {
      setEditingAlbum(album);
      setFormData({
        title: album.title,
        description: album.description,
        target_group: album.target_group || ''
      });
      setExistingImages(album.images);
    } else {
      setEditingAlbum(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleFiles = (files) => {
    const fileList = Array.from(files);
    setNewImages(prev => [...prev, ...fileList]);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };
  const handleFileChange = (e) => handleFiles(e.target.files);
  const removeNewImage = (index) => setNewImages(prev => prev.filter((_, i) => i !== index));
  const removeExistingImage = (id) => {
    setExistingImages(prev => prev.filter(img => img.id !== id));
    setImagesToDelete(prev => [...prev, id]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSend = new FormData();
    dataToSend.append('title', formData.title);
    dataToSend.append('description', formData.description);
    if (formData.target_group) dataToSend.append('target_group', formData.target_group);

    newImages.forEach(file => dataToSend.append('images', file));

    try {
      if (editingAlbum) {
        if (imagesToDelete.length > 0) {
           imagesToDelete.forEach(id => dataToSend.append('deleted_images', id));
        }
        await axios.patch(`http://127.0.0.1:8000/api/gallery/${editingAlbum.id}/`, dataToSend, {
          headers: { ...getAuthHeaders().headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post('http://127.0.0.1:8000/api/gallery/', dataToSend, {
          headers: { ...getAuthHeaders().headers, 'Content-Type': 'multipart/form-data' }
        });
      }
      setIsModalOpen(false);
      await fetchData(); // To odświeży listę i wyłączy loading
    } catch (err) {
      setError("Błąd zapisu. Sprawdź, czy tytuł jest unikalny.");
      setLoading(false); // Wyłącz loading w razie błędu
    }
  };
  
  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć ten album?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/gallery/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
      setLoading(false);
    }
  };
  
  const getGroupName = (id) => {
    if (!id) return 'Wszyscy';
    return groups.find(g => g.id === id)?.name || '-';
  };

  // --- WIDOK ---
  if (loading) {
     return <LoadingScreen message="Wczytywanie galerii..." />;
  }

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <div className="page-title"><FaImages /> Galeria Zdjęć</div>
        <button className="honey-btn" onClick={() => openModal()}><FaPlus /> Dodaj Album</button>
      </div>

      <div className="search-bar-container">
        <FaSearch className="search-icon"/>
        <input type="text" placeholder="Szukaj po tytule..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Album</th>
              <th>Zdjęcia (Podgląd)</th>
              <th>Widoczność</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlbums.length === 0 ? (
                <tr><td colSpan="4" className="text-center">Brak albumów w galerii.</td></tr>
            ) : (
                filteredAlbums.map(album => (
                  <tr key={album.id}>
                    <td>
                      <div style={{fontWeight: 700}}>{album.title}</div>
                      <div style={{fontSize: 12, color: '#666', maxWidth: 300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                        {album.description}
                      </div>
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: 5}}>
                        {album.images.slice(0, 5).map(img => (
                          <img 
                            key={img.id}
                            src={img.image}
                            alt="thumb"
                            style={{width: 30, height: 30, borderRadius: 6, objectFit: 'cover'}}
                          />
                        ))}
                        {album.images.length > 5 && (
                          <div style={{width: 30, height: 30, background:'#eee', borderRadius:6, display:'flex', justifyContent:'center', alignItems:'center', fontSize:11, fontWeight:700}}>
                            +{album.images.length - 5}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${album.target_group ? 'director' : 'parent'}`}>
                        {album.target_group ? <FaLayerGroup/> : <FaBullhorn/>}
                        {getGroupName(album.target_group)}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="action-icon-btn edit" onClick={() => openModal(album)}><FaEdit/></button>
                      <button className="action-icon-btn delete" onClick={() => handleDelete(album.id)}><FaTrash/></button>
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
            <h3>{editingAlbum ? 'Edytuj Album' : 'Nowy Album'}</h3>
            {error && <div className="form-error">{error}</div>}
            
            <form onSubmit={handleSave} className="modal-form-grid">
              
              <div className="form-group full-width">
                <label>Tytuł</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>

              <div className="form-group full-width">
                <label>Widoczność</label>
                <select value={formData.target_group} onChange={e => setFormData({...formData, target_group: e.target.value})}>
                  <option value="">-- Wszyscy --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Opis</label>
                <textarea className="medical-textarea" style={{height: '100px'}} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              
              <div 
                className="form-group full-width drop-zone"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
              >
                <input 
                  type="file" multiple
                  ref={fileInputRef} 
                  style={{display: 'none'}} 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                
                <div className="thumbnails-container">
                  {/* Istniejące zdjęcia */}
                  {existingImages.map(img => (
                    <div key={img.id} className="thumbnail">
                      <img src={img.image} alt="Istniejące"/>
                      <button type="button" className="thumb-delete" onClick={() => removeExistingImage(img.id)}><FaTimes/></button>
                    </div>
                  ))}
                  
                  {/* Nowe zdjęcia */}
                  {newImages.map((file, index) => (
                    <div key={index} className="thumbnail">
                      <img src={URL.createObjectURL(file)} alt="Nowe"/>
                      <button type="button" className="thumb-delete" onClick={() => removeNewImage(index)}><FaTimes/></button>
                    </div>
                  ))}
                  
                  <div className="thumbnail add-thumb" onClick={() => fileInputRef.current.click()}>
                    <FaUpload />
                    <span>Dodaj/Upuść</span>
                  </div>
                </div>

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

export default DirectorGallery;