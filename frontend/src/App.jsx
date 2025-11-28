import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';

// Tymczasowy komponent Dashboard, żeby mieć gdzie przekierować po zalogowaniu
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
        {/* Domyślna ścieżka to Login */}
        <Route path="/" element={<Login />} />
        
        {/* Ścieżka panelu (zabezpieczymy ją później) */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;