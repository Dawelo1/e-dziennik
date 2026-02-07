// frontend/src/LoadingScreen.jsx
import React from 'react';
import './LoadingScreen.css';
import beeImage from '../assets/bee.png'; // Twoja pszczółka
import bgImage from '../assets/bg-main.png';   // Twoje tło

const LoadingScreen = ({ message = "Ładowanie..." }) => {
  return (
    <div className="loading-overlay" style={{ backgroundImage: `url(${bgImage})` }}>
      {/* Ciemniejsza warstwa, żeby napisy były czytelne */}
      <div className="loading-backdrop"></div>

      <div className="loading-content">
        
        {/* Kontener z Pszczółką i Magią */}
        <div className="bee-loader-wrapper">
          {/* Obracające się pierścienie/iskierki */}
          <div className="magic-ring"></div>
          <div className="magic-ring-inner"></div>
          
          {/* Pszczółka */}
          <img src={beeImage} alt="Loading..." className="floating-bee" />
        </div>

        {/* Tekst */}
        <h2 className="loading-text">
          {message}
        </h2>

        {/* Pasek postępu */}
        <div className="loading-bar-container">
          <div className="loading-bar-fill"></div>
        </div>

      </div>
    </div>
  );
};

export default LoadingScreen;