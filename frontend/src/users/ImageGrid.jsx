import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ImageGrid.css';
import { FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const ImageGrid = ({ images }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const galleryImages = images || [];
  const count = galleryImages.length;
  const displayImages = galleryImages.slice(0, 4);
  const remaining = count - 4;
  const gridClass = count >= 4 ? 'grid-4' : `grid-${count}`;
  const imageCount = galleryImages.length;

  const openLightbox = (index) => {
    setPhotoIndex(index);
    setIsOpen(true);
  };

  const closeLightbox = () => {
    setIsOpen(false);
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % imageCount);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + imageCount - 1) % imageCount);
  };

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';

    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') {
        setPhotoIndex((prev) => (prev + 1) % imageCount);
      }
      if (e.key === 'ArrowLeft') {
        setPhotoIndex((prev) => (prev + imageCount - 1) % imageCount);
      }
    };

    if (isOpen && imageCount > 0) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, imageCount]);

  if (imageCount === 0) return null;

  // --- HTML DLA LIGHTBOXA ---
  const lightboxContent = (
    <div className="lightbox-overlay" onClick={closeLightbox}>
      
      <button className="lightbox-close-btn" onClick={closeLightbox}>
        <FaTimes />
      </button>

      {imageCount > 1 && (
        <button className="lightbox-nav-btn prev" onClick={prevImage}>
          <FaChevronLeft />
        </button>
      )}

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img 
          src={galleryImages[photoIndex].image} 
          alt={`Gallery preview ${photoIndex + 1}`} 
        />
        <div className="lightbox-counter">
          {photoIndex + 1} / {imageCount}
        </div>
      </div>

      {imageCount > 1 && (
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