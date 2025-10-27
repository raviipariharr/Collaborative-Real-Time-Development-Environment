import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import InvitationBadge from '../components/InvitationBadge';
import { useTheme } from '../contexts/ThemeContext';
import MemberManagement from '../components/MemberManagement';

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner: { name: string };
  _count: { documents: number; members: number };
  updatedAt: string;
}

const Dashboard: React.FC = () => {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<Project | null>(null);
  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Update and rename
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const openEditModal = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setEditForm({
      name: project.name,
      description: project.description || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      const updated = await apiService.updateProject(editingProject.id, editForm);
      setProjects(projects.map(p => p.id === updated.id ? updated : p));
      setShowEditModal(false);
      setEditingProject(null);
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('Failed to update project');
    }
  };

  const confirmDelete = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingProjectId(projectId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProject = async () => {
    if (!deletingProjectId) return;

    try {
      await apiService.deleteProject(deletingProjectId);
      setProjects(projects.filter(p => p.id !== deletingProjectId));
      setShowDeleteConfirm(false);
      setDeletingProjectId(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await apiService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const project = await apiService.createProject(newProject);
      setProjects([project, ...projects]);
      setShowCreateModal(false);
      setNewProject({ name: '', description: '' });
      navigate(`/editor/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteProjectId) return;

    setInviteLoading(true);
    setInviteError('');

    try {
      await apiService.sendInvitation({
        projectId: inviteProjectId,
        email: inviteEmail,
        role: 'EDITOR'
      });
      alert('Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteProjectId(null);
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      setInviteError(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const openInviteModal = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setInviteProjectId(projectId);
    setShowInviteModal(true);
    setInviteError('');
  };

  const openMemberManagement = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectForMembers(project);
    setShowMemberModal(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: theme === 'dark' ? '#1e1e1e' : '#f5f5f5' }}>
      {/* Responsive Header */}
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1rem',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.8rem)' }}>CodeCollab</h1>

        {/* Desktop Menu */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }} className="desktop-menu">
          <InvitationBadge />
          <button onClick={toggleTheme} style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1.2rem'
          }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {state.user?.avatar && (
            <img src={state.user.avatar} alt={state.user.name}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: window.innerWidth < 768 ? 'none' : 'block'
              }} />
          )}
          <span style={{ display: window.innerWidth < 768 ? 'none' : 'inline' }}>
            {state.user?.name}
          </span>
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

        {/* Mobile Menu Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          style={{
            display: window.innerWidth < 768 ? 'block' : 'none',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1.5rem'
          }}
        >
          ☰
        </button>
      </header>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div style={{
          background: theme === 'dark' ? '#2d2d2d' : 'white',
          padding: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: window.innerWidth < 768 ? 'block' : 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {state.user?.avatar && (
                <img src={state.user.avatar} alt={state.user.name}
                  style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              )}
              <span style={{ color: theme === 'dark' ? 'white' : '#333' }}>
                {state.user?.name}
              </span>
            </div>
          </div>
        </div>
      )}

      <main style={{
        padding: 'clamp(1rem, 3vw, 2rem)',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)' }}>Your Projects</h2>
          <button onClick={() => setShowCreateModal(true)} style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: 'clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: 'clamp(0.9rem, 2vw, 1rem)',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}>
            + New Project
          </button>
        </div>

        {loading ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#666' }}>
              No projects yet. Create your first project!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(1rem, 2vw, 1.5rem)'
          }}>
            {projects.map(project => (
              <div key={project.id} style={{
                background: theme === 'dark' ? '#2d2d2d' : 'white',
                color: theme === 'dark' ? 'white' : '#333',
                padding: 'clamp(1rem, 2vw, 1.5rem)',
                borderRadius: '12px',
                boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
                onClick={() => navigate(`/editor/${project.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <h3 style={{
                  marginBottom: '0.5rem',
                  fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                  wordBreak: 'break-word'
                }}>{project.name}</h3>
                <p style={{
                  color: '#666',
                  fontSize: 'clamp(0.85rem, 1.5vw, 0.9rem)',
                  marginBottom: '1rem',
                  wordBreak: 'break-word'
                }}>
                  {project.description || 'No description'}
                </p>
                <div style={{
                  fontSize: 'clamp(0.8rem, 1.5vw, 0.85rem)',
                  color: '#999',
                  marginBottom: '1rem'
                }}>
                  <div>{project._count.documents} files • {project._count.members} members</div>
                  <div style={{ wordBreak: 'break-word' }}>Owner: {project.owner.name}</div>
                </div>

                {/* Action Buttons - Responsive */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: window.innerWidth < 480 ? '1fr 1fr' : '1fr 1fr auto',
                  gap: '0.5rem'
                }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(project, e);
                    }}
                    style={{
                      padding: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.8rem, 1.5vw, 0.85rem)'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openInviteModal(project.id, e);
                    }}
                    style={{
                      padding: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.8rem, 1.5vw, 0.85rem)'
                    }}
                  >
                    Invite
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Extra safety
                      openMemberManagement(project, e);
                    }}
                    style={{
                      padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.6rem, 2vw, 0.75rem)',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.8rem, 1.5vw, 0.85rem)',

                    }}
                  >
                    Members
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); 
                      confirmDelete(project.id, e);
                    }}
                    style={{
                      padding: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.8rem, 1.5vw, 0.85rem)',
                      gridColumn: window.innerWidth < 480 ? 'span 2' : 'auto'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Responsive Modal Wrapper */}
      {(showCreateModal || showInviteModal || showEditModal || showDeleteConfirm) && (
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
          zIndex: 1000,
          padding: '1rem',
          overflow: 'auto'
        }}>
          {/* Create Project Modal */}
          {showCreateModal && (
            <div style={{
              background: theme === 'dark' ? '#2d2d2d' : 'white',
              color: theme === 'dark' ? 'white' : '#333',
              padding: 'clamp(1.5rem, 3vw, 2rem)',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{
                marginBottom: '1.5rem',
                fontSize: 'clamp(1.2rem, 3vw, 1.5rem)'
              }}>Create New Project</h2>
              <form onSubmit={handleCreateProject}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Project Name *</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                      background: theme === 'dark' ? '#1e1e1e' : 'white',
                      color: theme === 'dark' ? 'white' : '#333',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                      resize: 'vertical',
                      background: theme === 'dark' ? '#1e1e1e' : 'white',
                      color: theme === 'dark' ? 'white' : '#333',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setShowCreateModal(false)} style={{
                    padding: 'clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: theme === 'dark' ? '#1e1e1e' : 'white',
                    color: theme === 'dark' ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: 'clamp(0.9rem, 2vw, 1rem)'
                  }}>
                    Cancel
                  </button>
                  <button type="submit" style={{
                    padding: 'clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: 'clamp(0.9rem, 2vw, 1rem)'
                  }}>
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Other modals similar structure... */}
        </div>
      )}

      {/* Invite Member Modal */}
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
          zIndex: 1000
        }}
          onClick={() => {
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteError('');
          }}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '1.5rem' }}>Invite Member to Project</h2>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email Address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                  They will receive an invitation to join this project
                </p>
              </div>

              {inviteError && (
                <div style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '0.75rem',
                  borderRadius: '6px',
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
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer'
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
                    borderRadius: '6px',
                    cursor: inviteLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && editingProject && (
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
          onClick={() => setShowEditModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Project</h2>
            <form onSubmit={handleUpdateProject}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Project Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer'
                }}>
                  Cancel
                </button>
                <button type="submit" style={{
                  padding: '0.75rem 1.5rem',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '1rem', color: '#f44336' }}>Delete Project?</h2>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              Are you sure you want to delete this project? This action cannot be undone.
              All files and data will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer'
              }}>
                Cancel
              </button>
              <button onClick={handleDeleteProject} style={{
                padding: '0.75rem 1.5rem',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}>
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Management Modal */}
      {showMemberModal && selectedProjectForMembers && state.user && (
        <MemberManagement
          project={selectedProjectForMembers}
          currentUserId={state.user.id}
          onClose={() => {
            setShowMemberModal(false);
            setSelectedProjectForMembers(null);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;