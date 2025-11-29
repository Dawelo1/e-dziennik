import React from 'react';
import { Link } from 'react-router-dom';
import './Login.css';
import bgImage from './assets/bg.png';

const Terms = () => {
  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})`, alignItems: 'flex-start', paddingTop: '50px', paddingBottom: '50px', overflowY: 'auto' }}>
      <div className="login-card" style={{ maxWidth: '800px', textAlign: 'left', margin: 'auto' }}>
        
        <h2 style={{ color: '#5d4037', marginBottom: '20px', borderBottom: '2px solid #f2c94c', paddingBottom: '10px' }}>
          Regulamin Przedszkola
        </h2>

        <div style={{ color: '#444', lineHeight: '1.6', fontSize: '14px' }}>
          <p><strong>§1. Postanowienia ogólne</strong></p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>

          <p><strong>§2. Opłaty i Płatności</strong></p>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>

          <p><strong>§3. Obecność i Nieobecność</strong></p>
          <p>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, 
            eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </p>
          
          <p>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos 
            qui ratione voluptatem sequi nesciunt.
          </p>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Link to="/" className="login-btn" style={{ textDecoration: 'none', display: 'inline-block', width: 'auto', padding: '12px 40px' }}>
            Zamknij i wróć
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Terms;