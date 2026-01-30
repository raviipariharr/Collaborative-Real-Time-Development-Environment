import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';

interface Invitation {
  id: string;
  email: string;
  role: string;
  project: { 
    id: string; 
    name: string; 
    description: string | null;
  };
  inviter: { 
    name: string; 
    email: string; 
    avatar: string | null;
  };
  createdAt: string;
}

const InvitationBadge: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInvitations();
    
    // Poll for new invitations every 30 seconds
    const interval = setInterval(() => {
      loadInvitations();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadInvitations = async () => {
    try {
      const data = await apiService.getPendingInvitations();
      console.log('📨 Loaded invitations:', data);
      setInvitations(data);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleAccept = async (invitationId: string) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const result = await apiService.acceptInvitation(invitationId);
      console.log('✅ Invitation accepted:', result);
      
      // Remove from list
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      
      // Show success message
      alert('Invitation accepted! Reloading to show new project...');
      
      // Reload to show new project
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      alert(error.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (invitationId: string) => {
    if (loading) return;
    
    if (!window.confirm('Are you sure you want to reject this invitation?')) {
      return;
    }
    
    setLoading(true);
    try {
      await apiService.rejectInvitation(invitationId);
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      alert('Failed to reject invitation');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  if (invitations.length === 0) return null;

  return (
    <>
      <button 
        onClick={() => setShowModal(true)} 
        style={{
          position: 'relative',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.2)',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: 'none',
          color: 'white',
          fontSize: '0.9rem',
          fontWeight: '500',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span>📨 Invitations</span>
        <span style={{
          background: '#ff4444',
          color: 'white',
          borderRadius: '50%',
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          animation: invitations.length > 0 ? 'pulse 2s infinite' : 'none'
        }}>
          {invitations.length > 99 ? '99+' : invitations.length}
        </span>
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          backdropFilter: 'blur(4px)'
        }}
        onClick={() => setShowModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '0',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '1.5rem',
              borderRadius: '16px 16px 0 0',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                  📨 Pending Invitations
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                  {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} waiting
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {invitations.map((invitation, index) => (
                <div key={invitation.id} style={{
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: index < invitations.length - 1 ? '1rem' : '0',
                  background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
                  transition: 'all 0.3s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  {/* Project Info */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}>
                        💼
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontSize: '1.2rem',
                          color: '#1a1a1a',
                          fontWeight: '700'
                        }}>
                          {invitation.project.name}
                        </h3>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginTop: '0.25rem'
                        }}>
                          <span style={{
                            background: 'rgba(102, 126, 234, 0.1)',
                            color: '#667eea',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {invitation.role}
                          </span>
                          <span style={{
                            fontSize: '0.75rem',
                            color: '#999'
                          }}>
                            • {formatDate(invitation.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {invitation.project.description && (
                      <p style={{ 
                        color: '#666', 
                        margin: '0.75rem 0',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        padding: '0.75rem',
                        background: 'rgba(0,0,0,0.02)',
                        borderRadius: '8px',
                        borderLeft: '3px solid #667eea'
                      }}>
                        {invitation.project.description}
                      </p>
                    )}
                  </div>

                  {/* Inviter Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(102, 126, 234, 0.05)',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}>
                    {invitation.inviter.avatar ? (
                      <img
                        src={invitation.inviter.avatar}
                        alt={invitation.inviter.name}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: '2px solid #667eea'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        border: '2px solid #667eea'
                      }}>
                        {invitation.inviter.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666',
                        fontWeight: '500'
                      }}>
                        Invited by
                      </div>
                      <div style={{ 
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#1a1a1a'
                      }}>
                        {invitation.inviter.name}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem',
                    marginTop: '1rem'
                  }}>
                    <button 
                      onClick={() => handleAccept(invitation.id)} 
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!loading) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                        }
                      }}
                    >
                      {loading ? '⏳ Processing...' : '✓ Accept'}
                    </button>
                    <button 
                      onClick={() => handleReject(invitation.id)}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        background: loading ? '#f5f5f5' : 'white',
                        color: loading ? '#999' : '#f44336',
                        border: `2px solid ${loading ? '#e0e0e0' : '#f44336'}`,
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading) {
                          e.currentTarget.style.background = '#f44336';
                          e.currentTarget.style.color = 'white';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!loading) {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.color = '#f44336';
                        }
                      }}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
      `}</style>
    </>
  );
};

export default InvitationBadge;