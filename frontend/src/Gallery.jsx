// frontend/src/Gallery.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Gallery.css';
import ImageGrid from './ImageGrid';
import { FaImages, FaRegClock, FaThumbsUp, FaRegThumbsUp } from 'react-icons/fa';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from './authUtils';

const Gallery = () => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://127.0.0.1:8000${url}`;
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

  if (loading) return <LoadingScreen message="Wczytywanie galerii..." />;

  return (
    <div className="gallery-container">
      
      <h2 className="page-title">
        <FaImages /> Galeria Zdjęć
      </h2>

      <div className="gallery-feed">
        {albums.length === 0 ? (
          <div className="empty-gallery">Brak albumów do wyświetlenia.</div>
        ) : (
          albums.map(album => (
            <div key={album.id} className="gallery-card">
              
              <div className="gallery-header">
                <div className="gallery-avatar">
                  {album.author_avatar ? (
                    <img src={getAvatarUrl(album.author_avatar)} alt="Avatar" />
                  ) : (
                    <div className="gallery-avatar-placeholder">
                      {(album.author_name && album.author_name[0]) ? album.author_name[0].toUpperCase() : 'D'}
                    </div>
                  )}
                </div>
                <div className="gallery-info">
                  <h4>{album.author_name || 'Dyrektor Przedszkola'}</h4>
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
                    {album.is_liked_by_user ? <FaThumbsUp color="#2196f3" /> : <FaRegThumbsUp />} 
                    <span>{album.likes_count > 0 ? album.likes_count : 'Lubię to'}</span>
                    <span className="like-tooltip">
                      {album.likes_count > 0 ? (
                        (() => {
                          const names = Array.isArray(album.likers_names) ? album.likers_names : [];
                          const shown = names.slice(0, 5);
                          const remaining = Math.max(0, names.length - shown.length);
                          return (
                            <>
                              {shown.map((n, i) => (
                                <div className="like-tooltip-item" key={`${n}-${i}`}>{n}</div>
                              ))}
                              {remaining > 0 && (
                                <div className="like-tooltip-item">i {remaining} innych</div>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        'Nikt jeszcze nie polubił'
                      )}
                    </span>
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