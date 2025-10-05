import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import InvitationBadge from '../components/InvitationBadge';

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
  
  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  
  //update and rename
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
 
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
          <InvitationBadge />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Your Projects</h2>
          <button onClick={() => setShowCreateModal(true)} style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}>
            + New Project
          </button>
        </div>

        {loading ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '1.2rem', color: '#666' }}>No projects yet. Create your first project!</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {projects.map(project => (
              <div key={project.id} style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onClick={() => navigate(`/editor/${project.id}`)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <h3 style={{ marginBottom: '0.5rem' }}>{project.name}</h3>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {project.description || 'No description'}
                </p>
                <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '1rem' }}>
                  <div>{project._count.documents} files • {project._count.members} members</div>
                  <div>Owner: {project.owner.name}</div>
                </div>

                {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                onClick={(e) => openEditModal(project, e)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
        }}
      >
        Edit
      </button>
      <button 
        onClick={(e) => openInviteModal(project.id, e)}
        style={{
          flex: 1,
          padding: '0.5rem',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem'
        }}
      >
        Invite
      </button>
      <button 
        onClick={(e) => confirmDelete(project.id, e)}
        style={{
          padding: '0.5rem 0.75rem',
          background: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem'
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

      {/* Create Project Modal */}
      {showCreateModal && (
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
        onClick={() => setShowCreateModal(false)}
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
            <h2 style={{ marginBottom: '1.5rem' }}>Create New Project</h2>
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
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
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
                <button type="button" onClick={() => setShowCreateModal(false)} style={{
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>
                  Create Project
                </button>
              </div>
            </form>
          </div>
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
    </div>
  );
};

export default Dashboard;