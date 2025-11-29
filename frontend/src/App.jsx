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

// Placeholdery (Wkrótce zastąpimy je prawdziwymi plikami)
const Dashboard = () => <h2 style={{color:'white'}}>🏠 Dashboard (Pulpit)</h2>;
const Newsfeed = () => <h2 style={{color:'white'}}>📰 Tablica Postów</h2>;
const Messages = () => <h2 style={{color:'white'}}>📩 Wiadomości</h2>;
const Attendance = () => <h2 style={{color:'white'}}>🤒 Zgłaszanie Nieobecności</h2>;
const Calendar = () => <h2 style={{color:'white'}}>📅 Kalendarz Roczny</h2>;
const Schedule = () => <h2 style={{color:'white'}}>🕒 Plan Tygodniowy</h2>;
const Menu = () => <h2 style={{color:'white'}}>🍲 Jadłospis</h2>;
const Payments = () => <h2 style={{color:'white'}}>💰 Płatności</h2>;
const Settings = () => <h2 style={{color:'white'}}>⚙️ Ustawienia</h2>;

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
          <Route path="/newsfeed" element={<Newsfeed />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;