// frontend/src/pages/LoginPage.tsx
import React, { useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { state, login, clearError } = useAuth();
  const navigate = useNavigate();

  // Clear any previous errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Redirect if already logged in
  useEffect(() => {
    if (state.user && state.initialized) {
      navigate('/dashboard');
    }
  }, [state.user, state.initialized, navigate]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      try {
        await login(credentialResponse.credential);
        // Navigation will be handled by the useEffect above
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  };

  const handleGoogleError = () => {
    console.error('Google login failed');
  };

  // Show loading while initializing
  if (!state.initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="text-white text-xl">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {/* Logo and Title */}
          <div className="mb-8">
            <div className="text-4xl mb-4">💻</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">CodeCollab</h1>
            <p className="text-gray-600">Collaborative Real-Time Development</p>
          </div>
          
          {/* Login Button */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size="large"
                width="300"
                logo_alignment="left"
              />
            </div>
            
            {/* Loading State */}
            {state.loading && (
              <div className="text-blue-600 text-sm">Signing you in...</div>
            )}
            
            {/* Error State */}
            {state.error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-red-800 text-sm">{state.error}</div>
              </div>
            )}
          </div>
          
          {/* Features */}
          <div className="mt-8">
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <span>🌍</span>
                <span>Web & Mobile</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>⚡</span>
                <span>Real-time</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>🔐</span>
                <span>Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;