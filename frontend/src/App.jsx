import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import Terms from './Terms';
import PrivacyPolicy from './PrivacyPolicy';

// Tymczasowy komponent Dashboard
const Dashboard = () => {
  return (
    <div style={{ padding: 20 }}>
      <h1>Witaj w systemie! 🐝</h1>
      <p>Jesteś zalogowany.</p>
      <button onClick={() => {
        localStorage.removeItem('token');
        window.location.href = '/';
      }}>Wyloguj</button>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* 2. Nowa trasa dla linku z e-maila */}
        <Route path="/reset-hasla" element={<ResetPassword />} />
        
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/regulamin" element={<Terms />} />
        <Route path="/polityka-prywatnosci" element={<PrivacyPolicy />} />
      </Routes>
    </Router>
  );
}

export default App;