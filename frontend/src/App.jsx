import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importy Publiczne i Rodzica
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
import Gallery from './Gallery';

// --- NOWE IMPORTY DLA DYREKTORA ---
import DirectorRoute from './DirectorRoute';
import DirectorLayout from './DirectorLayout';
import DirectorDashboard from './director/DirectorDashboard';
import DirectorUsers from './director/DirectorUsers';
import DirectorGroups from './director/DirectorGroups';
import DirectorChildren from './director/DirectorChildren';
import DirectorPosts from './director/DirectorPosts';
import DirectorGallery from './director/DirectorGallery';
import DirectorMessages from './director/DirectorMessages';
import DirectorAttendance from './director/DirectorAttendance';
import DirectorSchedule from './director/DirectorSchedule';
import DirectorMenu from './director/DirectorMenu';
import DirectorCalendar from './director/DirectorCalendar';
import DirectorSettings from './director/DirectorSettings';

function App() {
  return (
    <Router>
      <Routes>
        {/* ==========================
            STREFA PUBLICZNA
           ========================== */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-hasla" element={<ResetPassword />} />
        <Route path="/regulamin" element={<Terms />} />
        <Route path="/polityka-prywatnosci" element={<PrivacyPolicy />} />

        {/* ==========================
            STREFA RODZICA (Chroniona)
           ========================== */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/calendar" element={<Calendar />} /> 
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/meals" element={<Meals />} /> 
          <Route path="/payments" element={<Payments />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/info" element={<Info />} />
        </Route>

        {/* ==========================
            STREFA DYREKTORA (Chroniona + Admin)
           ========================== */}
        <Route element={<DirectorRoute />}>
          <Route element={<DirectorLayout />}>
            
            {/* Główny pulpit */}
            <Route path="/director/dashboard" element={<DirectorDashboard />} />

            {/* Tymczasowe przekierowanie reszty linków do Dashboardu, 
                żeby można było testować menu bez błędów 404. 
                W kolejnych krokach będziemy podmieniać DirectorDashboard na właściwe komponenty. */}
            <Route path="/director/posts" element={<DirectorPosts />} />
            <Route path="/director/messages" element={<DirectorMessages />} />
            <Route path="/director/attendance" element={<DirectorAttendance />} />
            <Route path="/director/schedule" element={<DirectorSchedule />} />
            <Route path="/director/menu" element={<DirectorMenu />} />
            <Route path="/director/gallery" element={<DirectorGallery />} />
            <Route path="/director/calendar" element={<DirectorCalendar />} />
            <Route path="/director/payments" element={<DirectorDashboard />} />
            <Route path="/director/groups" element={<DirectorGroups />} />
            <Route path="/director/children" element={<DirectorChildren />} />
            <Route path="/director/users" element={<DirectorUsers />} /> 
            <Route path="/director/settings" element={<DirectorSettings />} />

          </Route>
        </Route>

      </Routes>
    </Router>
  );
}

export default App;