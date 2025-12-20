// frontend/src/director/DirectorPosts.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css'; // Styl ten sam co reszta panelu
import LoadingScreen from '../LoadingScreen';

import { 
  FaBullhorn, FaPlus, FaEdit, FaTrash, FaSearch, 
  FaImage, FaLayerGroup, FaSave 
} from 'react-icons/fa';

const DirectorPosts = () => {
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]); // Do wyboru w formularzu
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  // Input pliku
  const fileInputRef = useRef(null);

  const initialForm = {
    title: '',
    content: '',
    target_group: '', // ID grupy lub pusty string (dla wszystkich)
    image: null       // Obiekt pliku
  };
  const [formData, setFormData] = useState(initialForm);
  const [previewImage, setPreviewImage] = useState(null); // Podgląd zdjęcia
  const [error, setError] = useState('');

  // 1. POBIERANIE DANYCH
  const fetchData = async () => {
    try {
      const [postsRes, groupsRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/newsfeed/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders())
      ]);
      // Sortowanie: Najnowsze na górze
      setPosts(postsRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setGroups(groupsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filtrowanie
  const filteredPosts = posts.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. OTWIERANIE MODALA
  const openModal = (post = null) => {
    setError('');
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        content: post.content,
        target_group: post.target_group || '', // null w API to '' w formularzu
        image: null // Resetujemy plik przy edycji (chyba że user wybierze nowy)
      });
      setPreviewImage(post.image); // Pokaż aktualne zdjęcie
    } else {
      setEditingPost(null);
      setFormData(initialForm);
      setPreviewImage(null);
    }
    setIsModalOpen(true);
  };

  // Obsługa pliku
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      setPreviewImage(URL.createObjectURL(file)); // Lokalny podgląd
    }
  };

  // 3. ZAPISYWANIE (FormData bo przesyłamy plik)
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSend = new FormData();
    dataToSend.append('title', formData.title);
    dataToSend.append('content', formData.content);
    
    // Jeśli wybrano grupę, wyślij ID. Jeśli nie, wyślij pusty ciąg (backend ustawi null)
    if (formData.target_group) {
        dataToSend.append('target_group', formData.target_group);
    } else {
        dataToSend.append('target_group', ''); 
    }

    if (formData.image) {
      dataToSend.append('image', formData.image);
    }

    try {
      if (editingPost) {
        await axios.patch(`http://127.0.0.1:8000/api/newsfeed/${editingPost.id}/`, dataToSend, {
          headers: { 
             ...getAuthHeaders().headers,
             'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        await axios.post('http://127.0.0.1:8000/api/newsfeed/', dataToSend, {
          headers: { 
             ...getAuthHeaders().headers,
             'Content-Type': 'multipart/form-data'
          }
        });
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      setError("Błąd zapisu.");
      setLoading(false);
    }
  };

  // 4. USUWANIE
  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć ten post?")) return;
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/newsfeed/${id}/`, getAuthHeaders());
      await fetchData();
    } catch (err) {
      alert("Błąd usuwania.");
      setLoading(false);
    }
  };

  // Helper nazwy grupy
  const getGroupName = (id) => {
    if (!id) return 'Wszyscy';
    const g = groups.find(x => x.id === id);
    return g ? g.name : 'Nieznana';
  };

  if (loading && posts.length === 0) return <LoadingScreen message="Wczytywanie ogłoszeń..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaBullhorn /> Tablica Ogłoszeń
        </h2>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Ogłoszenie
        </button>
      </div>

      <div className="search-bar-container">
        <FaSearch className="search-icon"/>
        <input 
          type="text" 
          placeholder="Szukaj po tytule..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{width: '60px'}}>Img</th>
              <th>Tytuł / Treść</th>
              <th>Widoczność</th>
              <th>Data</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map(post => (
              <tr key={post.id}>
                <td>
                  {post.image ? (
                    <img 
                        src={post.image} 
                        alt="Mini" 
                        style={{width: 40, height: 40, borderRadius: 8, objectFit: 'cover'}}
                    />
                  ) : (
                    <div style={{width: 40, height: 40, background: '#eee', borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <FaImage color="#ccc"/>
                    </div>
                  )}
                </td>
                <td>
                  <div style={{fontWeight: 700, color: '#333'}}>{post.title}</div>
                  <div style={{fontSize: 12, color: '#666', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {post.content}
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${post.target_group ? 'director' : 'parent'}`}>
                    {post.target_group ? <FaLayerGroup/> : <FaBullhorn/>}
                    {getGroupName(post.target_group)}
                  </span>
                </td>
                <td style={{fontSize: 13, color: '#888'}}>{post.formatted_date}</td>
                <td className="text-right">
                  <button className="action-icon-btn edit" onClick={() => openModal(post)}><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => handleDelete(post.id)}><FaTrash/></button>
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
            <h3>{editingPost ? 'Edytuj Ogłoszenie' : 'Nowe Ogłoszenie'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid">
              
              {/* Tytuł */}
              <div className="form-group full-width">
                <label>Tytuł</label>
                <input 
                  type="text" required 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              {/* Grupa docelowa */}
              <div className="form-group full-width">
                <label>Widoczność (Dla kogo?)</label>
                <select 
                    value={formData.target_group} 
                    onChange={e => setFormData({...formData, target_group: e.target.value})}
                >
                  <option value="">-- Wszyscy (Ogólne) --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Treść */}
              <div className="form-group full-width">
                <label>Treść</label>
                <textarea 
                  className="medical-textarea"
                  style={{height: '120px'}}
                  value={formData.content} 
                  onChange={e => setFormData({...formData, content: e.target.value})}
                />
              </div>

              {/* Zdjęcie */}
              <div className="form-group full-width">
                <label>Zdjęcie (Opcjonalne)</label>
                <div 
                    style={{border: '2px dashed #ddd', padding: 20, textAlign: 'center', cursor: 'pointer', borderRadius: 10}}
                    onClick={() => fileInputRef.current.click()}
                >
                    {previewImage ? (
                        <img src={previewImage} alt="Preview" style={{maxHeight: 150, maxWidth: '100%', borderRadius: 10}} />
                    ) : (
                        <div style={{color: '#999'}}>
                            <FaImage size={30} style={{marginBottom: 10}} /><br/>
                            Kliknij, aby dodać zdjęcie
                        </div>
                    )}
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{display: 'none'}} 
                    accept="image/*"
                    onChange={handleFileChange}
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

export default DirectorPosts;