// frontend/src/Gallery.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Gallery.css'; // Styl podobny do Dashboard/Settings
import ImageGrid from './ImageGrid';
import { FaImages, FaRegClock } from 'react-icons/fa';

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
        // Pobieramy dane z naszego nowego endpointu
        const res = await axios.get('http://127.0.0.1:8000/api/gallery/', getAuthHeaders());
        setAlbums(res.data);
      } catch (err) {
        console.error("Błąd pobierania galerii:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbums();
  }, []);

  if (loading) return <div style={{padding: 20}}>Ładowanie galerii... 📸</div>;

  return (
    <div className="gallery-container">
      
      {/* TYTUŁ (Spójny z resztą) */}
      <h2 className="page-title">
        <FaImages /> Galeria Zdjęć
      </h2>

      <div className="gallery-feed">
        {albums.length === 0 ? (
          <div className="empty-gallery">Brak albumów do wyświetlenia.</div>
        ) : (
          albums.map(album => (
            <div key={album.id} className="gallery-card">
              
              {/* Header Karty (Autor + Data) */}
              <div className="gallery-header">
                <div className="gallery-avatar">P</div>
                <div className="gallery-info">
                  <h4>Dyrektor Przedszkola</h4>
                  <span className="gallery-date">
                    <FaRegClock /> {album.formatted_date}
                  </span>
                </div>
              </div>

              {/* Tytuł i Opis Albumu */}
              <h3 className="album-title">{album.title}</h3>
              {album.description && (
                <div className="album-desc">{album.description}</div>
              )}

              {/* MOZAIKA ZDJĘĆ */}
              <ImageGrid images={album.images} />

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Gallery;