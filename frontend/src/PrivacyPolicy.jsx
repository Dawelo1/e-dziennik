import React from 'react';
import { Link } from 'react-router-dom';
import './Login.css';
import bgImage from './assets/bg.png';

const PrivacyPolicy = () => {
  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})`, alignItems: 'flex-start', paddingTop: '50px', paddingBottom: '50px', overflowY: 'auto' }}>
      <div className="login-card" style={{ maxWidth: '800px', textAlign: 'left', margin: 'auto' }}>
        
        <h2 style={{ color: '#5d4037', marginBottom: '20px', borderBottom: '2px solid #f2c94c', paddingBottom: '10px' }}>
          Polityka Prywatności
        </h2>

        <div style={{ color: '#444', lineHeight: '1.6', fontSize: '14px' }}>
          <p><strong>1. Administrator Danych</strong></p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur vel sem sit amet dolor viverra efficitur. 
            Administratorem Twoich danych osobowych jest Przedszkole "Pszczółka Maja".
          </p>

          <p><strong>2. Cel przetwarzania danych</strong></p>
          <p>
            Przetwarzamy Twoje dane w celu:
            <ul>
                <li>Realizacji usług opiekuńczo-wychowawczych.</li>
                <li>Komunikacji z rodzicami.</li>
                <li>Rozliczeń finansowych.</li>
            </ul>
          </p>

          <p><strong>3. Twoje prawa</strong></p>
          <p>
            Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, 
            omnis voluptas assumenda est, omnis dolor repellendus.
          </p>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Link to="/" className="login-btn" style={{ textDecoration: 'none', display: 'inline-block', width: 'auto', padding: '12px 40px' }}>
            Rozumiem
          </Link>
        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicy;