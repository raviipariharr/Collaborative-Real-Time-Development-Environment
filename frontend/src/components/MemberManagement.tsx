import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface ProjectMember {
  id: string;
  userId: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface Project {
  id: string;
  name: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

interface MemberManagementProps {
  project: Project;
  currentUserId: string;
  onClose: () => void;
}

const MemberManagement: React.FC<MemberManagementProps> = ({ project, currentUserId, onClose }) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  const isOwner = project.owner.id === currentUserId;

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjectMembers(project.id);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError('');

    try {
      await apiService.sendInvitation({
        projectId: project.id,
        email: inviteEmail,
        role: inviteRole
      });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('EDITOR');
      alert('Invitation sent successfully!');
    } catch (error: any) {
      setInviteError(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'ADMIN' | 'EDITOR' | 'VIEWER') => {
    if (!isOwner) {
      alert('Only the project owner can change member roles');
      return;
    }

    setChangingRoleId(memberId);
    try {
      await apiService.updateMemberRole(memberId, newRole);
      setMembers(members.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    } catch (error) {
      console.error('Failed to change role:', error);
      alert('Failed to change member role');
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isOwner) {
      alert('Only the project owner can remove members');
      return;
    }

    if (!window.confirm(`Remove ${memberName} from this project?`)) {
      return;
    }

    try {
      await apiService.removeMember(memberId);
      setMembers(members.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { bg: 'rgba(255,215,0,0.2)', border: '#ffd700', text: '#b8860b' };
      case 'EDITOR':
        return { bg: 'rgba(76,175,80,0.2)', border: '#4caf50', text: '#2e7d32' };
      case 'VIEWER':
        return { bg: 'rgba(158,158,158,0.2)', border: '#9e9e9e', text: '#616161' };
      default:
        return { bg: '#f5f5f5', border: '#ddd', text: '#666' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem',
      overflow: 'auto'
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
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
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Manage Members</h2>
            <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              {project.name}
            </p>
          </div>
          <button
            onClick={onClose}
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
          {/* Action Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '0.95rem', color: '#666' }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </div>
            {isOwner && (
              <button
                onClick={() => setShowInviteModal(true)}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
              >
                <span style={{ fontSize: '1.2rem' }}>+</span> Invite Member
              </button>
            )}
          </div>

          {/* Owner Section */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,193,7,0.1) 100%)',
            border: '2px solid rgba(255,215,0,0.3)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#b8860b',
              fontWeight: 'bold',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>👑</span> PROJECT OWNER
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {project.owner.avatar ? (
                <img 
                  src={project.owner.avatar} 
                  alt={project.owner.name}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,215,0,0.5)'
                  }}
                />
              ) : (
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  border: '2px solid rgba(255,215,0,0.5)'
                }}>
                  {project.owner.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {project.owner.name}
                  {project.owner.id === currentUserId && (
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      fontSize: '0.8rem', 
                      color: '#666',
                      fontWeight: 'normal'
                    }}>
                      (You)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {project.owner.email}
                </div>
              </div>
            </div>
          </div>

          {/* Members List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
              No members yet. Invite people to collaborate!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {members.map((member) => {
                const roleColors = getRoleBadgeColor(member.role);
                const isCurrentUser = member.userId === currentUserId;
                
                return (
                  <div
                    key={member.id}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      transition: 'box-shadow 0.2s',
                      background: 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                  >
                    {/* Avatar */}
                    {member.user.avatar ? (
                      <img 
                        src={member.user.avatar} 
                        alt={member.user.name}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          border: '2px solid #e0e0e0'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Member Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '1rem', 
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {member.user.name}
                        </span>
                        {isCurrentUser && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: '#666',
                            background: '#f5f5f5',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontWeight: 'normal'
                          }}>
                            You
                          </span>
                        )}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {member.user.email}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                        Joined {formatDate(member.joinedAt)}
                      </div>
                    </div>

                    {/* Role Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      {isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value as any)}
                          disabled={changingRoleId === member.id}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: `2px solid ${roleColors.border}`,
                            borderRadius: '8px',
                            background: roleColors.bg,
                            color: roleColors.text,
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            minWidth: '100px'
                          }}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="EDITOR">Editor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      ) : (
                        <span style={{
                          padding: '0.5rem 0.75rem',
                          border: `2px solid ${roleColors.border}`,
                          borderRadius: '8px',
                          background: roleColors.bg,
                          color: roleColors.text,
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          minWidth: '100px',
                          textAlign: 'center'
                        }}>
                          {member.role}
                        </span>
                      )}

                      {/* Remove Button */}
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.user.name)}
                          style={{
                            background: 'transparent',
                            border: '2px solid #f44336',
                            color: '#f44336',
                            borderRadius: '8px',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f44336';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#f44336';
                          }}
                          title="Remove member"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Role Descriptions */}
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#f9f9f9',
            borderRadius: '12px',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '0.95rem',
              color: '#666',
              fontWeight: '600'
            }}>
              Role Permissions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{
                  padding: '0.3rem 0.6rem',
                  background: 'rgba(255,215,0,0.2)',
                  border: '1px solid #ffd700',
                  borderRadius: '6px',
                  color: '#b8860b',
                  fontWeight: '600',
                  minWidth: '70px',
                  textAlign: 'center'
                }}>
                  ADMIN
                </span>
                <span style={{ color: '#666' }}>
                  Full access: Create, edit, delete files/folders, manage members
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{
                  padding: '0.3rem 0.6rem',
                  background: 'rgba(76,175,80,0.2)',
                  border: '1px solid #4caf50',
                  borderRadius: '6px',
                  color: '#2e7d32',
                  fontWeight: '600',
                  minWidth: '70px',
                  textAlign: 'center'
                }}>
                  EDITOR
                </span>
                <span style={{ color: '#666' }}>
                  Can create, edit, and delete files/folders
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{
                  padding: '0.3rem 0.6rem',
                  background: 'rgba(158,158,158,0.2)',
                  border: '1px solid #9e9e9e',
                  borderRadius: '6px',
                  color: '#616161',
                  fontWeight: '600',
                  minWidth: '70px',
                  textAlign: 'center'
                }}>
                  VIEWER
                </span>
                <span style={{ color: '#666' }}>
                  Read-only access: Can view files but cannot edit
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
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
          zIndex: 2001
        }}
        onClick={() => setShowInviteModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>Invite Team Member</h3>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                  Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="ADMIN">Admin - Full access</option>
                  <option value="EDITOR">Editor - Can edit files</option>
                  <option value="VIEWER">Viewer - Read-only</option>
                </select>
              </div>

              {inviteError && (
                <div style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}>
                  {inviteError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteError('');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: inviteLoading ? '#ccc' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: inviteLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagement;