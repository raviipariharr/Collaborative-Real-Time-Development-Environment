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
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: '2rem',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          Loading...
        </div>
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
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Background Elements */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        top: '-250px',
        right: '-250px',
        animation: 'float 20s infinite ease-in-out'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        bottom: '-200px',
        left: '-200px',
        animation: 'float 15s infinite ease-in-out reverse'
      }} />

      {/* Main Glass Card */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '3rem 2.5rem',
        borderRadius: '30px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        animation: 'slideUp 0.6s ease-out'
      }}>
        {/* Logo/Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 1.5rem',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
          animation: 'glow 2s infinite ease-in-out'
        }}>
          💻
        </div>

        {/* Title */}
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '0.5rem', 
          color: 'white',
          fontWeight: '700',
          letterSpacing: '-0.5px',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
        }}>
          CodeCollab
        </h1>

        {/* Subtitle */}
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          marginBottom: '2.5rem',
          fontSize: '1.05rem',
          fontWeight: '300',
          letterSpacing: '0.5px'
        }}>
          Collaborative Real-Time Development
        </p>
        
        {/* Divider */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          marginBottom: '2rem'
        }} />

        {/* Login Button Container */}
        <div style={{ 
          margin: '2rem 0',
          display: 'flex',
          justifyContent: 'center'
        }}>
          {state.loading ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              padding: '1rem 2rem',
              borderRadius: '15px',
              color: 'white',
              fontSize: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              animation: 'pulse 1.5s infinite'
            }}>
              <span style={{ marginRight: '0.5rem' }}>⏳</span>
              Signing you in...
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              padding: '1.2rem',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
            }}
            >
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => console.error('Google login failed')}
                size="large"
                width="300"
                theme="filled_blue"
              />
            </div>
          )}
        </div>

        {/* Error Message */}
        {state.error && (
          <div style={{ 
            background: 'rgba(244, 67, 54, 0.15)',
            backdropFilter: 'blur(10px)',
            color: 'white', 
            padding: '1rem 1.2rem', 
            borderRadius: '15px',
            marginTop: '1.5rem',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            fontSize: '0.95rem',
            fontWeight: '500',
            animation: 'shake 0.5s'
          }}>
            <span style={{ marginRight: '0.5rem' }}>⚠️</span>
            {state.error}
          </div>
        )}

        {/* Features */}
        <div style={{ 
          marginTop: '2.5rem', 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '2rem',
          flexWrap: 'wrap'
        }}>
          {[
            { icon: '🌐', text: 'Web & Mobile' },
            { icon: '⚡', text: 'Real-time' },
            { icon: '🔐', text: 'Secure' }
          ].map((feature, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '0.95rem',
              fontWeight: '500',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(5px)',
              padding: '0.6rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transition: 'all 0.3s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            >
              <span style={{ fontSize: '1.2rem' }}>{feature.icon}</span>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Footer Text */}
        <p style={{
          marginTop: '2rem',
          fontSize: '0.85rem',
          color: 'rgba(255, 255, 255, 0.7)',
          fontWeight: '300'
        }}>
          By signing in, you agree to our terms and privacy policy
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-5deg); }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
          }
          50% {
            box-shadow: 0 4px 25px rgba(255, 255, 255, 0.4);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .glass-card {
            padding: 2rem 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;