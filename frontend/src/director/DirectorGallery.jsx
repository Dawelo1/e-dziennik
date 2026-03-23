// frontend/src/director/DirectorGallery.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Wspólne style
import './DirectorGallery.css'; // Dedykowane style
import LoadingScreen from '../users/LoadingScreen';

import { 
  FaImages, FaPlus, FaEdit, FaTrash, FaSearch, 
  FaLayerGroup, FaBullhorn, FaSave, FaUpload, FaExclamationTriangle, FaTrashAlt, FaDownload, FaChevronLeft, FaChevronRight, FaTimes
} from 'react-icons/fa';

const DirectorGallery = () => {
  const [albums, setAlbums] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true); // Zaczynamy z loading=true
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

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
  const [actionError, setActionError] = useState('');
  const fileInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [invalidFields, setInvalidFields] = useState({ title: false, images: false });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({ title: false, images: false });
  const invalidFieldTimers = useRef({ title: null, images: null });

  // --- POPRAWIONE POBIERANIE DANYCH ---
  const fetchData = async () => {
    // Nie włączamy loading, bo jest już włączony na starcie
    try {
      const [albumsRes, groupsRes] = await Promise.all([
        axios.get('/api/gallery/', getAuthHeaders()),
        axios.get('/api/groups/', getAuthHeaders())
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

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'date' ? 'desc' : 'asc');
  };

  const getSortArrow = (field) => {
    if (sortField !== field) return '↓';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const openModal = (album = null) => {
    setError('');
    setActionError('');
    setNewImages([]);
    setExistingImages([]);
    setImagesToDelete([]);
    setInvalidFields({ title: false, images: false });
    setRequiredFieldErrors({ title: false, images: false });
    
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

  const handleFiles = (files) => {
    const fileList = Array.from(files);
    setNewImages(prev => [...prev, ...fileList]);
    if (fileList.length > 0) {
      clearInvalidField('images');
      setRequiredFieldErrors((prev) => ({ ...prev, images: false }));
    }
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

  const downloadExistingImage = async (img, index, albumTitle = null) => {
    const safeTitle = albumTitle?.trim() || formData.title?.trim() || editingAlbum?.title?.trim() || 'album';
    const cleanTitle = safeTitle.toLowerCase().replace(/\s+/g, '-');
    const extension = img.image.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${cleanTitle}-${index + 1}.${extension}`;

    try {
      const response = await axios.get(img.image, {
        ...getAuthHeaders(),
        responseType: 'blob'
      });
      downloadFromBlob(response.data, fileName);
    } catch (err) {
      downloadFromUrl(img.image, fileName);
    }
  };

  const downloadNewImage = (file) => {
    downloadFromBlob(file, file.name || 'zdjecie.jpg');
  };

  const handleDownloadAlbum = async (album) => {
    setActionError('');
    if (!album?.images?.length) {
      setActionError('Ten album nie zawiera zdjęć do pobrania.');
      return;
    }

    for (let i = 0; i < album.images.length; i += 1) {
      await downloadExistingImage(album.images[i], i, album.title);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  };

  const openAlbumPreview = (images, startIndex = 0) => {
    if (!images?.length) return;
    setPreviewImages(images);
    setPreviewIndex(startIndex);
    setIsPreviewOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeAlbumPreview = () => {
    setIsPreviewOpen(false);
    document.body.style.overflow = 'auto';
  };

  const nextPreviewImage = (e) => {
    e.stopPropagation();
    setPreviewIndex((prev) => (prev + 1) % previewImages.length);
  };

  const prevPreviewImage = (e) => {
    e.stopPropagation();
    setPreviewIndex((prev) => (prev + previewImages.length - 1) % previewImages.length);
  };

  useEffect(() => {
    const handlePreviewKeyDown = (e) => {
      if (!isPreviewOpen) return;
      if (e.key === 'Escape') closeAlbumPreview();
      if (e.key === 'ArrowRight') nextPreviewImage(e);
      if (e.key === 'ArrowLeft') prevPreviewImage(e);
    };

    if (isPreviewOpen) {
      window.addEventListener('keydown', handlePreviewKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handlePreviewKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isPreviewOpen, previewImages.length]);

  const handleSave = async (e) => {
    e.preventDefault();

    const missingTitle = !formData.title.trim();
    const missingImages = existingImages.length === 0 && newImages.length === 0;

    setRequiredFieldErrors({
      title: missingTitle,
      images: missingImages
    });

    if (missingTitle) triggerInvalidField('title');
    if (missingImages) triggerInvalidField('images');
    if (missingTitle || missingImages) return;

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
        await axios.patch(`/api/gallery/${editingAlbum.id}/`, dataToSend, {
          headers: { ...getAuthHeaders().headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post('/api/gallery/', dataToSend, {
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
  
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`/api/gallery/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setActionError('Nie udało się usunąć albumu. Spróbuj ponownie później.');
      setLoading(false);
    }
  };
  
  const getGroupName = (id) => {
    if (!id) return 'Wszyscy';
    return groups.find(g => g.id === id)?.name || '-';
  };

  const getAlbumDate = (album) => {
    if (album.formatted_date) {
      return album.formatted_date.replace(/-/g, '.');
    }
    if (!album.created_at) return '-';

    const parsedDate = new Date(album.created_at);
    if (Number.isNaN(parsedDate.getTime())) return '-';

    return parsedDate.toLocaleDateString('pl-PL').replace(/\//g, '.');
  };

  const getVisibilityValue = (album) => {
    return getGroupName(album.target_group);
  };

  const sortedAlbums = [...filteredAlbums].sort((a, b) => {
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

  // --- WIDOK ---
  if (loading) {
     return <LoadingScreen message="Wczytywanie galerii..." />;
  }

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title"><FaImages /> Galeria Zdjęć</h2>
      </div>

      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon"/>
          <input type="text" placeholder="Szukaj po tytule..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <button className="honey-btn" onClick={() => openModal()}><FaPlus /> Dodaj Album</button>
      </div>

      {actionError && <div className="form-error">{actionError}</div>}

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Album</th>
              <th>Zdjęcia (Podgląd)</th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('date')}
                >
                  Data dodania <span className="sort-arrow">{getSortArrow('date')}</span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('visibility')}
                >
                  Widoczność <span className="sort-arrow">{getSortArrow('visibility')}</span>
                </button>
              </th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedAlbums.length === 0 ? (
                <tr><td colSpan="5" className="text-center">Brak albumów w galerii.</td></tr>
            ) : (
                sortedAlbums.map(album => (
                  <tr key={album.id}>
                    <td>
                      <div style={{fontWeight: 700}}>{album.title}</div>
                      <div style={{fontSize: 12, color: '#666', maxWidth: 300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                        {album.description}
                      </div>
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: 5}}>
                        {album.images.slice(0, 5).map((img, index) => (
                          <img 
                            key={img.id}
                            src={img.image}
                            alt="thumb"
                            style={{width: 30, height: 30, borderRadius: 6, objectFit: 'cover'}}
                            onClick={() => openAlbumPreview(album.images, index)}
                            className="gallery-preview-thumb"
                          />
                        ))}
                        {album.images.length > 5 && (
                          <div
                            style={{width: 30, height: 30, background:'#eee', borderRadius:6, display:'flex', justifyContent:'center', alignItems:'center', fontSize:11, fontWeight:700}}
                            onClick={() => openAlbumPreview(album.images, 5)}
                            className="gallery-preview-thumb"
                          >
                            +{album.images.length - 5}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{fontSize: 13, color: '#666'}}>{getAlbumDate(album)}</span>
                    </td>
                    <td>
                      <span className={`role-badge ${album.target_group ? 'director' : 'parent'}`}>
                        {album.target_group ? <FaLayerGroup/> : <FaBullhorn/>}
                        {getGroupName(album.target_group)}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" onClick={() => openModal(album)} title="Edytuj album"><FaEdit/></button>
                      <button className="action-icon-btn download" onClick={() => handleDownloadAlbum(album)} title="Pobierz album"><FaDownload/></button>
                      <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(album); }} title="Usuń album"><FaTrash/></button>
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
            
            <form onSubmit={handleSave} className="modal-form-grid" noValidate>
              
              <div className="form-group full-width">
                <label>Tytuł <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  placeholder="Wprowadź tytuł albumu..."
                  value={formData.title}
                  onChange={e => {
                    setFormData({...formData, title: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('title');
                      setRequiredFieldErrors((prev) => ({ ...prev, title: false }));
                    }
                  }}
                  className={invalidFields.title ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.title && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
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
                <textarea className="medical-textarea" placeholder="Wprowadź opis albumu..." style={{height: '100px'}} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              
              <div 
                className={`form-group full-width drop-zone ${invalidFields.images ? 'invalid-bounce' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
              >
                <label>Zdjęcia <span className="required-asterisk">*</span></label>
                <input 
                  type="file" multiple
                  ref={fileInputRef} 
                  style={{display: 'none'}} 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                
                <div className="thumbnails-container">
                  {/* Istniejące zdjęcia */}
                  {existingImages.map((img, index) => (
                    <div key={img.id} className="thumbnail">
                      <img src={img.image} alt="Istniejące"/>
                      <button
                        type="button"
                        className="thumb-download"
                        aria-label="Pobierz zdjęcie"
                        onClick={() => downloadExistingImage(img, index)}
                      >
                        <FaDownload className="thumb-download-icon" />
                      </button>
                      <button
                        type="button"
                        className="thumb-delete"
                        aria-label="Usuń zdjęcie"
                        onClick={() => removeExistingImage(img.id)}
                      >
                        <FaTrashAlt className="thumb-delete-icon" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Nowe zdjęcia */}
                  {newImages.map((file, index) => (
                    <div key={index} className="thumbnail">
                      <img src={URL.createObjectURL(file)} alt="Nowe"/>
                      <button
                        type="button"
                        className="thumb-download"
                        aria-label="Pobierz zdjęcie"
                        onClick={() => downloadNewImage(file)}
                      >
                        <FaDownload className="thumb-download-icon" />
                      </button>
                      <button
                        type="button"
                        className="thumb-delete"
                        aria-label="Usuń zdjęcie"
                        onClick={() => removeNewImage(index)}
                      >
                        <FaTrashAlt className="thumb-delete-icon" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="thumbnail add-thumb" onClick={() => fileInputRef.current.click()}>
                    <FaUpload />
                    <span>Dodaj/Upuść</span>
                  </div>
                </div>
                {requiredFieldErrors.images && (
                  <div className="field-required-message">Dodaj co najmniej jedno zdjęcie.</div>
                )}

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
            <h3>Usunąć album?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć album
              {` "${deleteTarget.title}"`}
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

      {isPreviewOpen && previewImages.length > 0 && (
        <div className="gallery-lightbox-overlay" onClick={closeAlbumPreview}>
          <button type="button" className="gallery-lightbox-close-btn" onClick={closeAlbumPreview}>
            <FaTimes />
          </button>

          {previewImages.length > 1 && (
            <button type="button" className="gallery-lightbox-nav-btn prev" onClick={prevPreviewImage}>
              <FaChevronLeft />
            </button>
          )}

          <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImages[previewIndex].image}
              alt={`Podgląd zdjęcia ${previewIndex + 1}`}
            />
            <div className="gallery-lightbox-counter">
              {previewIndex + 1} / {previewImages.length}
            </div>
          </div>

          {previewImages.length > 1 && (
            <button type="button" className="gallery-lightbox-nav-btn next" onClick={nextPreviewImage}>
              <FaChevronRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DirectorGallery;