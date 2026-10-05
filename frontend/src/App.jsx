import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/common/AppLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateMeeting from './pages/CreateMeeting';
import MeetingLobby from './pages/MeetingLobby';

function RouteTree() {
  return <Routes><Route element={<AppLayout />}>
    <Route path="/" element={<Landing />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
    <Route element={<ProtectedRoute />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/meetings/new" element={<CreateMeeting />} /><Route path="/meetings/:code" element={<MeetingLobby />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes>;
}

export default function App() {
  return <AuthProvider><ToastProvider><BrowserRouter><RouteTree /></BrowserRouter></ToastProvider></AuthProvider>;
}
