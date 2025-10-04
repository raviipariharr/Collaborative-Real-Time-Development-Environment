import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';

interface Invitation {
  id: string;
  email: string;
  project: { id: string; name: string; description: string | null };
  inviter: { name: string; email: string; avatar: string | null };
  createdAt: string;
}

const InvitationBadge: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      const data = await apiService.getPendingInvitations();
      setInvitations(data);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleAccept = async (invitationId: string) => {
    try {
      await apiService.acceptInvitation(invitationId);
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      window.location.reload(); // Refresh to show new project
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    }
  };

  const handleReject = async (invitationId: string) => {
    try {
      await apiService.rejectInvitation(invitationId);
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (error) {
      console.error('Failed to reject invitation:', error);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <>
      <div onClick={() => setShowModal(true)} style={{
        position: 'relative',
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.2)',
        padding: '0.5rem 1rem',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>Invitations</span>
        <span style={{
          background: '#ff6b6b',
          color: 'white',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 'bold'
        }}>
          {invitations.length}
        </span>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '1.5rem' }}>Pending Invitations ({invitations.length})</h2>
            
            {invitations.map(invitation => (
              <div key={invitation.id} style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '1rem'
              }}>
                <h3 style={{ marginBottom: '0.5rem' }}>{invitation.project.name}</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  {invitation.project.description || 'No description'}
                </p>
                <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '1rem' }}>
                  Invited by: {invitation.inviter.name} ({invitation.inviter.email})
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleAccept(invitation.id)} style={{
                    padding: '0.5rem 1rem',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}>
                    Accept
                  </button>
                  <button onClick={() => handleReject(invitation.id)} style={{
                    padding: '0.5rem 1rem',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default InvitationBadge;