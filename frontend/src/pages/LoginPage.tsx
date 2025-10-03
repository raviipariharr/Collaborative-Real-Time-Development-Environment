import React, { useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { state, login, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (state.user && state.initialized) {
      navigate('/dashboard');
    }
  }, [state.user, state.initialized, navigate]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      try {
        await login(credentialResponse.credential);
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  };

  if (!state.initialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'white',
        padding: '3rem',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: '#667eea' }}>
          CodeCollab
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          Collaborative Real-Time Development Environment
        </p>
        
        <div style={{ margin: '2rem 0' }}>
          {state.loading ? (
            <p>Signing you in...</p>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => console.error('Google login failed')}
              size="large"
              width="300"
            />
          )}
        </div>

        {state.error && (
          <div style={{ 
            background: '#fee', 
            color: '#c33', 
            padding: '1rem', 
            borderRadius: '8px',
            marginTop: '1rem'
          }}>
            {state.error}
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <span style={{ color: '#999' }}>Web & Mobile</span>
          <span style={{ color: '#999' }}>Real-time</span>
          <span style={{ color: '#999' }}>Secure</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;