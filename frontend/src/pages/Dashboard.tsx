import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { state, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1rem 2rem',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0 }}>CodeCollab</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {state.user?.avatar && (
            <img src={state.user.avatar} alt={state.user.name} 
              style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          )}
          <span>{state.user?.name}</span>
          <button onClick={logout} style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer'
          }}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '2rem' }}>Welcome, {state.user?.name}!</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem' 
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3>Real-time Collaboration</h3>
            <p>Code together with your team in real-time with live cursors and conflict resolution.</p>
          </div>

          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3>Secure Authentication</h3>
            <p>Protected by Google OAuth 2.0 and JWT tokens.</p>
          </div>

          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3>Cross-Platform</h3>
            <p>Works on web, mobile, and desktop with seamless synchronization.</p>
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          marginTop: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3>User Info</h3>
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
            {JSON.stringify(state.user, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;