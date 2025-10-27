import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface FolderPermission {
  id: string;
  userId: string;
  canEdit: boolean;
  canDelete: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface ProjectMember {
  id: string;
  userId: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface FolderPermissionModalProps {
  folderId: string;
  folderName: string;
  projectId: string;
  onClose: () => void;
}

const FolderPermissionModal: React.FC<FolderPermissionModalProps> = ({
  folderId,
  folderName,
  projectId,
  onClose
}) => {
  const [permissions, setPermissions] = useState<FolderPermission[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [canEdit, setCanEdit] = useState(true);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [perms, members] = await Promise.all([
        apiService.getFolderPermissions(folderId),
        apiService.getProjectMembers(projectId)
      ]);
      setPermissions(perms);
      setProjectMembers(members);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantPermission = async () => {
    if (!selectedUserId) return;

    try {
      await apiService.grantFolderPermission(folderId, {
        userId: selectedUserId,
        canEdit,
        canDelete
      });
      setShowAddModal(false);
      setSelectedUserId('');
      setCanEdit(true);
      setCanDelete(false);
      loadData();
    } catch (error) {
      console.error('Failed to grant permission:', error);
      alert('Failed to grant permission');
    }
  };

  const handleRevokePermission = async (userId: string, userName: string) => {
    if (!window.confirm(`Remove folder access for ${userName}?`)) return;

    try {
      await apiService.revokeFolderPermission(folderId, userId);
      loadData();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      alert('Failed to revoke permission');
    }
  };

  const handleTogglePermission = async (permissionId: string, field: 'canEdit' | 'canDelete', value: boolean) => {
    try {
      const perm = permissions.find(p => p.id === permissionId);
      if (!perm) return;

      await apiService.grantFolderPermission(folderId, {
        userId: perm.userId,
        canEdit: field === 'canEdit' ? value : perm.canEdit,
        canDelete: field === 'canDelete' ? value : perm.canDelete
      });
      loadData();
    } catch (error) {
      console.error('Failed to update permission:', error);
      alert('Failed to update permission');
    }
  };

  // Filter out members who already have permissions
  const availableMembers = projectMembers.filter(
    member => !permissions.find(p => p.userId === member.userId)
  );

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
      padding: '1rem'
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
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
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Folder Permissions</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📁</span> {folderName}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                fontSize: '1.3rem'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {permissions.length} user{permissions.length !== 1 ? 's' : ''} with special access
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: '#667eea',
                color: 'white',
                border: 'none',
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}
            >
              + Grant Access
            </button>
          </div>

          {/* Info Box */}
          <div style={{
            background: '#e3f2fd',
            border: '1px solid #2196f3',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: '#1976d2'
          }}>
            <strong>ℹ️ How it works:</strong> By default, Editors can edit all folders. You can grant specific Viewers/Editors access to edit only this folder and its contents.
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
              Loading permissions...
            </div>
          ) : permissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
              <p>No special folder permissions set</p>
              <p style={{ fontSize: '0.85rem' }}>Grant specific users access to this folder</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  {/* Avatar */}
                  {perm.user.avatar ? (
                    <img 
                      src={perm.user.avatar} 
                      alt={perm.user.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {perm.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* User Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                      {perm.user.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {perm.user.email}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={perm.canEdit}
                        onChange={(e) => handleTogglePermission(perm.id, 'canEdit', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      Edit
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={perm.canDelete}
                        onChange={(e) => handleTogglePermission(perm.id, 'canDelete', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      Delete
                    </label>
                    <button
                      onClick={() => handleRevokePermission(perm.userId, perm.user.name)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #f44336',
                        color: '#f44336',
                        borderRadius: '6px',
                        padding: '0.4rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        width: '32px',
                        height: '32px'
                      }}
                      title="Revoke access"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Permission Modal */}
      {showAddModal && (
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
        onClick={() => setShowAddModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '450px',
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1.5rem' }}>Grant Folder Access</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                Select User *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                <option value="">Choose a member...</option>
                {availableMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', fontSize: '0.9rem' }}>
                Permissions
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>
                <input
                  type="checkbox"
                  checked={canEdit}
                  onChange={(e) => setCanEdit(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Can Edit - User can create and edit files in this folder
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>
                <input
                  type="checkbox"
                  checked={canDelete}
                  onChange={(e) => setCanDelete(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Can Delete - User can delete files in this folder
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUserId('');
                  setCanEdit(true);
                  setCanDelete(false);
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
                onClick={handleGrantPermission}
                disabled={!selectedUserId}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: selectedUserId ? '#667eea' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedUserId ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Grant Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderPermissionModal;