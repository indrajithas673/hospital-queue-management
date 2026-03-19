import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminPanel from './pages/AdminPanel';
import TrackToken from './pages/TrackToken';
import WaitingRoomDisplay from './pages/WaitingRoomDisplay';
import NotFound from './pages/NotFound';

const Home = () => {
  const { user } = useAuth();
  if (user) {
    if (user.role === 'patient') return <Navigate to="/patient" replace />;
    if (user.role === 'doctor') return <Navigate to="/doctor" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public — no navbar */}
          <Route path="/track/:tokenNumber" element={<TrackToken />} />
          <Route path="/display/:department" element={<WaitingRoomDisplay />} />

          {/* With navbar */}
          <Route path="/" element={<><Navbar /><Home /></>} />
          <Route path="/login" element={<><Navbar /><Login /></>} />
          <Route path="/register" element={<><Navbar /><Register /></>} />
          <Route path="/patient" element={
            <ProtectedRoute allowedRoles={['patient']}>
              <><Navbar /><PatientDashboard /></>
            </ProtectedRoute>
          } />
          <Route path="/doctor" element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <><Navbar /><DoctorDashboard /></>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <><Navbar /><AdminPanel /></>
            </ProtectedRoute>
          } />
          <Route path="/unauthorized" element={
            <><Navbar /><div style={{ textAlign: 'center', marginTop: '80px' }}><h2>403 — Not Authorized</h2></div></>
          } />
          {/* 404 */}
          <Route path="*" element={<><Navbar /><NotFound /></>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
