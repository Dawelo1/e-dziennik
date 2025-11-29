import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';

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
      </Routes>
    </Router>
  );
}

export default App;