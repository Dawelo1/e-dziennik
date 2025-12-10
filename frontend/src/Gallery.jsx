// frontend/src/Gallery.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Gallery.css';
import ImageGrid from './ImageGrid';
import { FaImages, FaRegClock, FaHeart, FaRegHeart } from 'react-icons/fa'; // <--- Import serc

const Gallery = () => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/gallery/', getAuthHeaders());
        
        // Filtrujemy puste albumy
        const galleryPosts = res.data.filter(post => post.images && post.images.length > 0);
        setAlbums(galleryPosts);
      } catch (err) {
        console.error("Błąd pobierania galerii:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbums();
  }, []);

  // --- OBSŁUGA LAJKOWANIA ---
  const handleLike = async (albumId) => {
    // 1. Optymistyczna aktualizacja UI
    setAlbums(currentAlbums => currentAlbums.map(album => {
      if (album.id === albumId) {
        const isLiked = album.is_liked_by_user;
        return {
          ...album,
          is_liked_by_user: !isLiked,
          likes_count: isLiked ? album.likes_count - 1 : album.likes_count + 1
        };
      }
      return album;
    }));

    // 2. Strzał do API
    try {
      await axios.post(`http://127.0.0.1:8000/api/gallery/${albumId}/like/`, {}, getAuthHeaders());
    } catch (err) {
      console.error("Błąd lajkowania:", err);
      // Opcjonalnie: Cofnij zmianę w razie błędu
    }
  };

  if (loading) return <div style={{padding: 20}}>Ładowanie galerii... 📸</div>;

  return (
    <div className="gallery-container">
      
      <div className="page-title">
        <FaImages /> Galeria Zdjęć
      </div>

      <div className="gallery-feed">
        {albums.length === 0 ? (
          <div className="empty-gallery">Brak albumów do wyświetlenia.</div>
        ) : (
          albums.map(album => (
            <div key={album.id} className="gallery-card">
              
              <div className="gallery-header">
                <div className="gallery-avatar">P</div>
                <div className="gallery-info">
                  <h4>Dyrektor Przedszkola</h4>
                  <span className="gallery-date">
                    <FaRegClock /> {album.formatted_date}
                  </span>
                </div>
              </div>

              <h3 className="album-title">{album.title}</h3>
              {album.description && (
                <div className="album-desc">{album.description}</div>
              )}

              {/* Komponent z mozaiką zdjęć */}
              <ImageGrid images={album.images} />

              {/* PASEK AKCJI */}
              <div className="post-actions-bar">
                 <button 
                    className={`action-btn like-btn ${album.is_liked_by_user ? 'liked' : ''}`}
                    onClick={() => handleLike(album.id)}
                 >
                    {album.is_liked_by_user ? <FaHeart color="#e0245e" /> : <FaRegHeart />} 
                    <span>{album.likes_count > 0 ? album.likes_count : 'Lubię to'}</span>
                 </button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Gallery;