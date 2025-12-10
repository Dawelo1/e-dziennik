// frontend/src/ImageGrid.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <--- 1. NOWY IMPORT
import './ImageGrid.css';
import { FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const ImageGrid = ({ images }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const count = images.length;
  const displayImages = images.slice(0, 4);
  const remaining = count - 4;
  const gridClass = count >= 4 ? 'grid-4' : `grid-${count}`;

  const openLightbox = (index) => {
    setPhotoIndex(index);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setIsOpen(false);
    document.body.style.overflow = 'auto';
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + images.length - 1) % images.length);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage(e);
      if (e.key === 'ArrowLeft') prevImage(e);
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // --- HTML DLA LIGHTBOXA ---
  const lightboxContent = (
    <div className="lightbox-overlay" onClick={closeLightbox}>
      
      <button className="lightbox-close-btn" onClick={closeLightbox}>
        <FaTimes />
      </button>

      {images.length > 1 && (
        <button className="lightbox-nav-btn prev" onClick={prevImage}>
          <FaChevronLeft />
        </button>
      )}

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img 
          src={images[photoIndex].image} 
          alt={`Gallery preview ${photoIndex + 1}`} 
        />
        <div className="lightbox-counter">
          {photoIndex + 1} / {images.length}
        </div>
      </div>

      {images.length > 1 && (
        <button className="lightbox-nav-btn next" onClick={nextImage}>
          <FaChevronRight />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* 1. Zwykła siatka (Zostaje w miejscu) */}
      <div className={`fb-image-grid ${gridClass}`}>
        {displayImages.map((imgObj, index) => (
          <div 
            key={imgObj.id} 
            className={`grid-item item-${index}`}
            onClick={() => openLightbox(index)}
          >
            <img src={imgObj.image} alt="Gallery thumbnail" loading="lazy" />
            {index === 3 && remaining > 0 && (
              <div className="more-overlay"><span>+{remaining}</span></div>
            )}
          </div>
        ))}
      </div>

      {/* 2. Lightbox (Wyrzucony do body przez Portal) */}
      {isOpen && createPortal(lightboxContent, document.body)}
    </>
  );
};

export default ImageGrid;