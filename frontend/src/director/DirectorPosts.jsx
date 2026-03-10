// frontend/src/director/DirectorPosts.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Styl ten sam co reszta panelu
import LoadingScreen from '../users/LoadingScreen';
import { formatDateWithDots } from '../dateUtils';

import { 
  FaBullhorn, FaPlus, FaEdit, FaTrash, FaSearch, 
  FaLayerGroup, FaImage, FaSave, FaExclamationTriangle, FaTrashAlt, FaDownload 
} from 'react-icons/fa';

const DirectorPosts = () => {
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]); // Do wyboru w formularzu
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

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
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // Post wybrany do usunięcia
  const [invalidFields, setInvalidFields] = useState({ title: false, content: false });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({ title: false, content: false });
  const invalidFieldTimers = useRef({ title: null, content: null });

  // 1. POBIERANIE DANYCH
  const fetchData = async () => {
    try {
      const [postsRes, groupsRes] = await Promise.all([
        axios.get('/api/newsfeed/', getAuthHeaders()),
        axios.get('/api/groups/', getAuthHeaders())
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
    setActionError('');
    setInvalidFields({ title: false, content: false });
    setRequiredFieldErrors({ title: false, content: false });
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        content: post.content,
        target_group: post.target_group || '', // null w API to '' w formularzu
        image: null // Resetujemy plik przy edycji (chyba że user wybierze nowy)
      });
      setExistingImageUrl(post.image || null);
      setRemoveExistingImage(false);
      setPreviewImage(post.image); // Pokaż aktualne zdjęcie
    } else {
      setEditingPost(null);
      setFormData(initialForm);
      setExistingImageUrl(null);
      setRemoveExistingImage(false);
      setPreviewImage(null);
    }
    setIsModalOpen(true);
  };

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
    const timers = invalidFieldTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Obsługa pliku
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      setRemoveExistingImage(false);
      setPreviewImage(URL.createObjectURL(file)); // Lokalny podgląd
    }
  };

  const handleRemovePostImage = (e) => {
    e.stopPropagation();

    if (formData.image) {
      setFormData((prev) => ({ ...prev, image: null }));
      if (existingImageUrl && !removeExistingImage) {
        setPreviewImage(existingImageUrl);
      } else {
        setPreviewImage(null);
      }
      return;
    }

    if (existingImageUrl) {
      setRemoveExistingImage(true);
      setPreviewImage(null);
    }
  };

  // 3. ZAPISYWANIE (FormData bo przesyłamy plik)
  const handleSave = async (e) => {
    e.preventDefault();

    const missingTitle = !formData.title.trim();
    const missingContent = !formData.content.trim();

    setRequiredFieldErrors({
      title: missingTitle,
      content: missingContent
    });

    if (missingTitle) triggerInvalidField('title');
    if (missingContent) triggerInvalidField('content');
    if (missingTitle || missingContent) return;

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

    if (editingPost && removeExistingImage && !formData.image) {
      dataToSend.append('delete_image', '1');
    }

    try {
      if (editingPost) {
        await axios.patch(`/api/newsfeed/${editingPost.id}/`, dataToSend, {
          headers: { 
             ...getAuthHeaders().headers,
             'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        await axios.post('/api/newsfeed/', dataToSend, {
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
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`/api/newsfeed/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch {
      setActionError('Nie udało się usunąć ogłoszenia. Spróbuj ponownie później.');
      setLoading(false);
    }
  };

  const downloadFromUrl = (url, fileName) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadFromBlob = (blob, fileName) => {
    const blobUrl = URL.createObjectURL(blob);
    downloadFromUrl(blobUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const handleDownloadPostImage = async (post) => {
    setActionError('');
    if (!post.image) {
      setActionError('To ogłoszenie nie ma zdjęcia do pobrania.');
      return;
    }

    const cleanTitle = (post.title || 'ogloszenie').toLowerCase().replace(/\s+/g, '-');
    const extension = post.image.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${cleanTitle}.${extension}`;

    try {
      const response = await axios.get(post.image, {
        ...getAuthHeaders(),
        responseType: 'blob'
      });
      downloadFromBlob(response.data, fileName);
    } catch {
      downloadFromUrl(post.image, fileName);
    }
  };

  // Helper nazwy grupy
  const getGroupName = (id) => {
    if (!id) return 'Wszyscy';
    const g = groups.find(x => x.id === id);
    return g ? stripLeadingGroupEmoji(g.name) : 'Nieznana';
  };

  const stripLeadingGroupEmoji = (groupName = '') => {
    return groupName.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  };

  const getGroupBadgeClass = (groupId) => {
    if (!groupId) return 'group-all';

    const group = groups.find((item) => item.id === groupId);
    if (!group?.color_key) return 'group-default';
    return `group-color-${group.color_key}`;
  };

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'date' ? 'desc' : 'asc');
  };

  const getVisibilityValue = (post) => {
    const groupName = getGroupName(post.target_group);
    return groupName;
  };

  const getSortArrow = (field) => {
    if (sortField !== field) return '↓';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortField === 'visibility') {
      const visibilityA = getVisibilityValue(a);
      const visibilityB = getVisibilityValue(b);
      const byVisibility = visibilityA.localeCompare(visibilityB, 'pl', { sensitivity: 'base' });
      if (byVisibility !== 0) {
        return sortDirection === 'asc' ? byVisibility : -byVisibility;
      }

      return new Date(b.created_at) - new Date(a.created_at);
    }

    const byDate = new Date(a.created_at) - new Date(b.created_at);
    return sortDirection === 'asc' ? byDate : -byDate;
  });

  if (loading && posts.length === 0) return <LoadingScreen message="Wczytywanie ogłoszeń..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaBullhorn /> Tablica Ogłoszeń
        </h2>
      </div>

      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon"/>
          <input 
            type="text" 
            placeholder="Szukaj po tytule..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Ogłoszenie
        </button>
      </div>

      {actionError && <div className="form-error">{actionError}</div>}

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{width: '60px'}}>Img</th>
              <th>Tytuł / Treść</th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('visibility')}
                >
                  Widoczność <span className="sort-arrow">{getSortArrow('visibility')}</span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('date')}
                >
                  Data <span className="sort-arrow">{getSortArrow('date')}</span>
                </button>
              </th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedPosts.map(post => {
              const groupName = getGroupName(post.target_group);
              const groupBadgeClass = getGroupBadgeClass(post.target_group);

              return (
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
                  <span className={`role-badge ${groupBadgeClass}`}>
                    {post.target_group ? <FaLayerGroup /> : <FaBullhorn />}
                    {groupName}
                  </span>
                </td>
                <td style={{fontSize: 13, color: '#888'}}>{formatDateWithDots(post.formatted_date)}</td>
                <td className="actions-cell">
                  <button className="action-icon-btn edit" onClick={() => openModal(post)} title="Edytuj ogłoszenie"><FaEdit/></button>
                  <button
                    className="action-icon-btn download"
                    onClick={() => handleDownloadPostImage(post)}
                    disabled={!post.image}
                    title={post.image ? 'Pobierz zdjęcie' : 'Brak zdjęcia do pobrania'}
                    aria-label={post.image ? 'Pobierz zdjęcie' : 'Brak zdjęcia do pobrania'}
                  >
                    <FaDownload/>
                  </button>
                  <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(post); }} title="Usuń ogłoszenie"><FaTrash/></button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h3>{editingPost ? 'Edytuj Ogłoszenie' : 'Nowe Ogłoszenie'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid" noValidate>
              
              {/* Tytuł */}
              <div className="form-group full-width">
                <label>Tytuł <span className="required-asterisk">*</span></label>
                <input 
                  type="text"
                  value={formData.title} 
                  onChange={e => {
                    setFormData({...formData, title: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('title');
                      setRequiredFieldErrors((prev) => ({ ...prev, title: false }));
                    }
                  }}
                  className={invalidFields.title ? 'invalid-bounce' : ''}
                  placeholder='Wprowadź tytuł ogłoszenia...'
                />
                {requiredFieldErrors.title && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
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
                    <option key={g.id} value={g.id}>{stripLeadingGroupEmoji(g.name)}</option>
                  ))}
                </select>
              </div>

              {/* Treść */}
              <div className="form-group full-width">
                <label>Treść <span className="required-asterisk">*</span></label>
                <textarea 
                  className={`medical-textarea ${invalidFields.content ? 'invalid-bounce' : ''}`}
                  style={{height: '120px'}}
                  value={formData.content} 
                  onChange={e => {
                    setFormData({...formData, content: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('content');
                      setRequiredFieldErrors((prev) => ({ ...prev, content: false }));
                    }
                  }}
                  placeholder='Wprowadź treść ogłoszenia...'
                />
                {requiredFieldErrors.content && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              {/* Zdjęcie */}
              <div className="form-group full-width">
                <label>Zdjęcie (Opcjonalne)</label>
                <div 
                    style={{border: '2px dashed #ddd', padding: 20, textAlign: 'center', cursor: 'pointer', borderRadius: 10, position: 'relative'}}
                    onClick={() => fileInputRef.current.click()}
                >
                    {previewImage ? (
                        <>
                          <div className="post-image-preview-wrapper">
                            <img src={previewImage} alt="Preview" style={{maxHeight: 150, maxWidth: '100%', borderRadius: 10}} />
                            <button
                              type="button"
                              onClick={handleRemovePostImage}
                              aria-label="Usuń zdjęcie"
                              className="post-image-delete-btn"
                            >
                              <FaTrashAlt className="post-image-delete-icon" />
                            </button>
                          </div>
                        </>
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

      {/* --- MODAL POTWIERDZENIA USUNIĘCIA --- */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Usunąć ogłoszenie?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć ogłoszenie
              {deleteTarget.title ? ` "${deleteTarget.title}"` : ''}? Tej operacji nie można cofnąć.
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

export default DirectorPosts;