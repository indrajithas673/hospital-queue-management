import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

const NavbarWrapper = () => {
  const { pathname } = useLocation();
  const hideOn = ['/display/', '/track/'];
  if (hideOn.some(p => pathname.startsWith(p))) return null;
  return <Navbar />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/track/:tokenNumber" element={<TrackToken />} />
    <Route path="/display/:department" element={<WaitingRoomDisplay />} />
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/patient" element={
      <ProtectedRoute allowedRoles={['patient']}><PatientDashboard /></ProtectedRoute>
    } />
    <Route path="/doctor" element={
      <ProtectedRoute allowedRoles={['doctor']}><DoctorDashboard /></ProtectedRoute>
    } />
    <Route path="/admin" element={
      <ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>
    } />
    <Route path="/unauthorized" element={
      <div style={{ textAlign: 'center', marginTop: '80px' }}><h2>403 — Not Authorized</h2></div>
    } />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <Router>
      <NavbarWrapper />
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;