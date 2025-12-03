// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importy
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import Terms from './Terms';
import PrivacyPolicy from './PrivacyPolicy';
import Layout from './Layout';
import Dashboard from './Dashboard';
import Info from './Info';
import Settings from './Settings';
import Payments from './Payments';
import Attendance from './Attendance';
import Meals from './Meals';
import Schedule from './Schedule';
import Calendar from './Calendar';
import Messages from './Messages';

const GeneralInfo = () => (
  <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '20px', height: '100%' }}>
    <h2 style={{color: '#5d4037'}}>ℹ️ Informacje o Przedszkolu</h2>
    <p style={{marginTop: '20px', lineHeight: '1.6', color: '#555'}}>
      Witamy w systemie Przedszkola "Pszczółka Maja".<br/>
      Tutaj znajdziesz ogólne informacje o placówce, godziny otwarcia i dane kontaktowe.
    </p>
    <div style={{marginTop: '20px', padding: '20px', background: '#fff8e1', borderRadius: '10px'}}>
        <strong>Godziny otwarcia:</strong> 06:30 - 17:00<br/>
        <strong>Telefon:</strong> 123 456 789<br/>
        <strong>Adres:</strong> ul. Kwiatowa 1, 00-001 Warszawa
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* Publiczne */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-hasla" element={<ResetPassword />} />
        <Route path="/regulamin" element={<Terms />} />
        <Route path="/polityka-prywatnosci" element={<PrivacyPolicy />} />

        {/* Chronione (wewnątrz Layoutu) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/menu" element={<Meals />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/info" element={<Info />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;