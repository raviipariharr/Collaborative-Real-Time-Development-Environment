import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children?: Folder[];
  documents?: Document[];
}

interface Document {
  id: string;
  name: string;
  folderId: string | null;
}

interface Permission {
  id: string;
  type: 'folder' | 'document';
  resourceId: string;
  resourceName: string;
  canEdit: boolean;
  canDelete: boolean;
}

interface Member {
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

interface MemberPermissionManagerProps {
  member: Member;
  projectId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const MemberPermissionManager: React.FC<MemberPermissionManagerProps> = ({
  member,
  projectId,
  onClose,
  onUpdate
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState<'assigned' | 'manage'>('assigned');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [foldersData, docsData, permsData] = await Promise.all([
        apiService.getFolders(projectId),
        apiService.getProjectDocuments(projectId),
        apiService.getMemberPermissions(member.userId, projectId)
      ]);
      setFolders(buildTree(foldersData, docsData));
      setDocuments(docsData.filter((d: Document) => !d.folderId));
      setPermissions(permsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (foldersData: any[], docsData: any[]): Folder[] => {
    const buildSubtree = (parentId: string | null): Folder[] => {
      return foldersData
        .filter(f => f.parentId === parentId)
        .map(folder => ({
          ...folder,
          children: buildSubtree(folder.id),
          documents: docsData.filter(d => d.folderId === folder.id)
        }));
    };
    return buildSubtree(null);
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const hasPermission = (type: 'folder' | 'document', resourceId: string) => {
    return permissions.find(p => p.type === type && p.resourceId === resourceId);
  };

  const handleTogglePermission = async (
    type: 'folder' | 'document',
    resourceId: string,
    resourceName: string,
    currentPermission: Permission | undefined
  ) => {
    try {
      if (currentPermission) {
        // Remove permission
        await apiService.revokeMemberPermission(member.userId, type, resourceId);
        setPermissions(permissions.filter(p => 
          !(p.type === type && p.resourceId === resourceId)
        ));
      } else {
        // Grant permission
        const newPerm = await apiService.grantMemberPermission({
          userId: member.userId,
          projectId,
          type,
          resourceId,
          canEdit: true,
          canDelete: member.role === 'EDITOR'
        });
        setPermissions([...permissions, {
          id: newPerm.id,
          type,
          resourceId,
          resourceName,
          canEdit: true,
          canDelete: member.role === 'EDITOR'
        }]);
      }
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle permission:', error);
      alert('Failed to update permission');
    }
  };

  const handleUpdatePermission = async (
    permId: string,
    field: 'canEdit' | 'canDelete',
    value: boolean
  ) => {
    try {
      const perm = permissions.find(p => p.id === permId);
      if (!perm) return;

      await apiService.updateMemberPermission(permId, {
        canEdit: field === 'canEdit' ? value : perm.canEdit,
        canDelete: field === 'canDelete' ? value : perm.canDelete
      });

      setPermissions(permissions.map(p =>
        p.id === permId
          ? { ...p, [field]: value }
          : p
      ));
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const renderFolder = (folder: Folder, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const permission = hasPermission('folder', folder.id);
    const hasChildren = folder.children && folder.children.length > 0;
    const hasDocuments = folder.documents && folder.documents.length > 0;

    return (
      <div key={folder.id} style={{ marginLeft: `${depth * 20}px` }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.5rem',
          borderRadius: '6px',
          marginBottom: '0.25rem',
          background: permission ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
          border: permission ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid transparent',
          transition: 'all 0.2s'
        }}>
          {(hasChildren || hasDocuments) && (
            <button
              onClick={() => toggleFolder(folder.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '0.8rem',
                marginRight: '0.5rem'
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <span style={{ fontSize: '1rem', marginRight: '0.5rem' }}>
            {permission ? '📂' : '📁'}
          </span>
          <span style={{ flex: 1, fontSize: '0.9rem' }}>{folder.name}</span>
          {permission && (
            <span style={{
              fontSize: '0.7rem',
              background: '#4caf50',
              color: 'white',
              padding: '0.2rem 0.5rem',
              borderRadius: '10px',
              marginRight: '0.5rem'
            }}>
              ✓ Access
            </span>
          )}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}>
            <input
              type="checkbox"
              checked={!!permission}
              onChange={() => handleTogglePermission('folder', folder.id, folder.name, permission)}
              style={{ cursor: 'pointer' }}
            />
            Grant Access
          </label>
        </div>

        {isExpanded && (
          <>
            {folder.children?.map(child => renderFolder(child, depth + 1))}
            {folder.documents?.map(doc => renderDocument(doc, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderDocument = (doc: Document, depth: number = 0) => {
    const permission = hasPermission('document', doc.id);

    return (
      <div
        key={doc.id}
        style={{
          marginLeft: `${depth * 20}px`,
          display: 'flex',
          alignItems: 'center',
          padding: '0.5rem',
          borderRadius: '6px',
          marginBottom: '0.25rem',
          background: permission ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
          border: permission ? '1px solid rgba(33, 150, 243, 0.3)' : '1px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        <span style={{ fontSize: '1rem', marginRight: '0.5rem' }}>
          {permission ? '📄' : '📃'}
        </span>
        <span style={{ flex: 1, fontSize: '0.85rem' }}>{doc.name}</span>
        {permission && (
          <span style={{
            fontSize: '0.7rem',
            background: '#2196f3',
            color: 'white',
            padding: '0.2rem 0.5rem',
            borderRadius: '10px',
            marginRight: '0.5rem'
          }}>
            ✓ Access
          </span>
        )}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          cursor: 'pointer',
          fontSize: '0.85rem'
        }}>
          <input
            type="checkbox"
            checked={!!permission}
            onChange={() => handleTogglePermission('document', doc.id, doc.name, permission)}
            style={{ cursor: 'pointer' }}
          />
          Grant Access
        </label>
      </div>
    );
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
      padding: '1rem'
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '1.5rem',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Manage Access</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                {member.user.name} ({member.role})
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

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e0e0e0',
          background: '#f5f5f5'
        }}>
          <button
            onClick={() => setSelectedTab('assigned')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: selectedTab === 'assigned' ? 'white' : 'transparent',
              borderBottom: selectedTab === 'assigned' ? '3px solid #667eea' : 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: selectedTab === 'assigned' ? '600' : 'normal',
              color: selectedTab === 'assigned' ? '#667eea' : '#666'
            }}
          >
            Assigned Access ({permissions.length})
          </button>
          <button
            onClick={() => setSelectedTab('manage')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: selectedTab === 'manage' ? 'white' : 'transparent',
              borderBottom: selectedTab === 'manage' ? '3px solid #667eea' : 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: selectedTab === 'manage' ? '600' : 'normal',
              color: selectedTab === 'manage' ? '#667eea' : '#666'
            }}
          >
            Manage Access
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1.5rem'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
              Loading...
            </div>
          ) : selectedTab === 'assigned' ? (
            // Assigned Access Tab
            <div>
              {member.role !== 'VIEWER' && (
                <div style={{
                  background: '#e3f2fd',
                  border: '1px solid #2196f3',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.85rem',
                  color: '#1976d2'
                }}>
                  <strong>ℹ️ {member.role === 'ADMIN' ? 'Admin Access' : 'Editor Access'}:</strong> {
                    member.role === 'ADMIN' 
                      ? 'This user has full access to all folders and files.' 
                      : permissions.length === 0
                        ? 'This user currently has no specific folder/file access. They can only view.'
                        : 'Below are the specific folders and files this user can edit.'
                  }
                </div>
              )}

              {permissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                  <p>No specific access assigned</p>
                  <p style={{ fontSize: '0.85rem' }}>
                    {member.role === 'ADMIN' 
                      ? 'Admin has access to everything' 
                      : 'Go to "Manage Access" tab to grant permissions'}
                  </p>
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
                        gap: '1rem',
                        background: perm.type === 'folder' ? 'rgba(76, 175, 80, 0.05)' : 'rgba(33, 150, 243, 0.05)'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>
                        {perm.type === 'folder' ? '📂' : '📄'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                          {perm.resourceName}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
                          {perm.type === 'folder' ? 'Folder' : 'File'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
                            onChange={(e) => handleUpdatePermission(perm.id, 'canEdit', e.target.checked)}
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
                            onChange={(e) => handleUpdatePermission(perm.id, 'canDelete', e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          Delete
                        </label>
                        <button
                          onClick={() => handleTogglePermission(perm.type, perm.resourceId, perm.resourceName, perm)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #f44336',
                            color: '#f44336',
                            borderRadius: '6px',
                            padding: '0.4rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
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
          ) : (
            // Manage Access Tab
            <div>
              <div style={{
                background: '#fff9c4',
                border: '1px solid #fbc02d',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
                color: '#f57f17'
              }}>
                <strong>💡 Tip:</strong> Check folders/files to grant {member.user.name} specific access. 
                {member.role === 'ADMIN' && ' Note: Admins already have full access.'}
              </div>

              <div style={{ 
                background: '#f5f5f5', 
                padding: '1rem', 
                borderRadius: '8px',
                maxHeight: '500px',
                overflow: 'auto'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#666' }}>
                  Project Files & Folders
                </h4>
                {folders.map(folder => renderFolder(folder))}
                {documents.map(doc => renderDocument(doc))}
                
                {folders.length === 0 && documents.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                    No files or folders in this project yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberPermissionManager;