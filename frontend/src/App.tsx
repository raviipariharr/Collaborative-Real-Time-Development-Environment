import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EditorPage from './pages/EditorPage';
import { ThemeProvider } from './contexts/ThemeContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  
  if (!state.initialized) {
    return null;
  }
  
  if (!state.user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  
  if (state.user && state.initialized) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Configuration Error</h2>
        <p>Google Client ID is missing. Please check environment variables.</p>
        <p>Current: {GOOGLE_CLIENT_ID}</p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/editor/:projectId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
          </Routes>
        </Router>
        </AuthProvider>
        </ThemeProvider>
        </GoogleOAuthProvider>
  );
}

export default App;