import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import io from 'socket.io-client';
import ChatPanel from '../components/ChatPanel';
import FileTree from '../components/FileTree';
import FolderPermissionModal from '../components/FolderPermissionModal';
const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

interface Document {
  id: string;
  name: string;
  language: string;
  folderId: string | null;
  content: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

interface ActiveUser {
  userId: string;
  userName: string;
  socketId: string;
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

const EditorPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Responsive states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);
  const [showChat, setShowChat] = useState(false);

  // Project data
  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());

  // Permission states
  const [userRole, setUserRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER' | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [folderPermissions, setFolderPermissions] = useState<Map<string, boolean>>(new Map()); // Track folder edit permissions
  const [showFolderPermissionModal, setShowFolderPermissionModal] = useState(false);
  const [selectedFolderForPermission, setSelectedFolderForPermission] = useState<{ id: string; name: string } | null>(null);
  const [documentPermissions, setDocumentPermissions] = useState<Map<string, boolean>>(new Map());

  // Modals
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Real-time
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const editorRef = useRef<any>(null);
  const isRemoteChange = useRef(false);

  // Saving 
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveContentRef = useRef<string>('');
  const prevDocId = useRef<string | null>(null);
  //saving state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Permission helper functions
  const canEdit = () => {
    return isOwner || userRole === 'ADMIN' || userRole === 'EDITOR';
  };

  const canEditCurrentDoc = () => {
    if (!selectedDoc) return false;

    // Owner and Admin can always edit
    if (isOwner || userRole === 'ADMIN') return true;

    // Check if there's a document-level permission (highest priority)
    const docPermissions = documentPermissions.get(selectedDoc.id);
    if (docPermissions ==true ) {
      return true;
    }

    // Check folder-level permission
    if (selectedDoc.folderId) {
      const hasFolderPermission = folderPermissions.get(selectedDoc.folderId);
      if (hasFolderPermission !== undefined) {
        return hasFolderPermission;
      }
      return false;
    }

    // Default to role-based permission
    return false;
  };

  const canManageProject = () => {
    return isOwner || userRole === 'ADMIN';
  };

  const getCurrentContent = () => {
    if (!selectedDoc) return '';
    return fileContents.get(selectedDoc.id) || '// Start coding here...\n';
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile && !showSidebar) {
        setShowSidebar(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSidebar]);

  const loadProject = useCallback(async () => {
    try {
      const data = await apiService.getProject(projectId!);
      setProject(data);
      setIsOwner(data.owner.id === state.user?.id);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, [projectId, state.user?.id]);

  const loadProjectMembers = useCallback(async () => {
    try {
      const data = await apiService.getProjectMembers(projectId!);
      setProjectMembers(data);

      // Find current user's role
      const currentMember = data.find((m: ProjectMember) => m.userId === state.user?.id);
      if (currentMember) {
        setUserRole(currentMember.role);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  }, [projectId, state.user?.id]);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await apiService.getProjectDocuments(projectId!);
      setDocuments(data);

      const newContents = new Map<string, string>();
      data.forEach((doc: Document) => {
        newContents.set(doc.id, doc.content || '// Start coding here...\n');
      });
      setFileContents(newContents);

      if (data.length > 0 && !selectedDoc) {
        setSelectedDoc(data[0]);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }, [projectId, selectedDoc]);

  const loadDocumentPermissions = useCallback(async () => {
    if (!selectedDoc || !state.user) return;

    try {
      const perm = await apiService.checkDocumentEditPermission(selectedDoc.id);
      setDocumentPermissions(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedDoc.id, perm.canEdit);
        return newMap;
      });
    } catch (error) {
      console.error(`Failed to check permission for document ${selectedDoc.id}:`, error);
      setDocumentPermissions(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedDoc.id, false);
        return newMap;
      });
    }
  }, [selectedDoc, state.user]);

  const saveContent = useCallback(async (docId: string, content: string) => {
    // Don't save if already saving or content hasn't changed
    if (isSaving || lastSaveContentRef.current === content) {
      return;
    }

    // Check permission
    if (!isOwner && userRole !== 'ADMIN' && userRole !== 'EDITOR') {
      console.log('No permission to save');
      return;
    }

    try {
      setIsSaving(true);
      await apiService.saveDocumentContent(docId, content);
      lastSaveContentRef.current = content;
      setLastSaved(new Date());
      console.log('Content saved for document:', docId);
    } catch (error) {
      console.error('Failed to save content:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isOwner, userRole]);

  const loadFolders = useCallback(async () => {
    try {
      const data = await apiService.getFolders(projectId!);
      // Ensure data is an array
      const foldersArray = Array.isArray(data) ? data : [];
      setFolders(foldersArray);

      // Load permissions for each folder
      if (foldersArray.length > 0 && state.user) {
        const permissionsMap = new Map<string, boolean>();
        await Promise.all(
          foldersArray.map(async (folder) => {
            try {
              const perm = await apiService.checkFolderEditPermission(folder.id);
              permissionsMap.set(folder.id, perm.canEdit);
            } catch (error) {
              console.error(`Failed to check permission for folder ${folder.id}:`, error);
              permissionsMap.set(folder.id, false);
            }
          })
        );
        setFolderPermissions(permissionsMap);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      setFolders([]); // Set to empty array on error
    }
  }, [projectId, state.user]);

  // Load project data
  useEffect(() => {
    if (projectId) {
      loadProject();
      loadDocuments();
      loadFolders();
      loadProjectMembers();
    }
  }, [projectId, loadProject, loadDocuments, loadFolders, loadProjectMembers]);

  useEffect(() => {
    if (selectedDoc) {
      loadDocumentPermissions();
    }
  }, [selectedDoc, loadDocumentPermissions]);

  // WebSocket connection
  useEffect(() => {
    if (selectedDoc && state.user) {
      socketRef.current = io(SOCKET_URL);
      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Connected to WebSocket');
        socket.emit('join-document', {
          documentId: selectedDoc.id,
          userId: state.user!.id,
          userName: state.user!.name
        });
      });

      socket.on('user-joined', (data: { userId: string; userName: string; socketId: string }) => {
        console.log(`${data.userName} joined the document`);
        setActiveUsers(prev => [...prev, data]);
      });

      socket.on('user-left', (data: { socketId: string }) => {
        setActiveUsers(prev => prev.filter(u => u.socketId !== data.socketId));
      });

      socket.on('code-update', (data: { code: string; userId: string; documentId: string }) => {
        if (!state.user || data.userId === state.user.id) return;

        isRemoteChange.current = true;
        setFileContents(prev => {
          const newMap = new Map(prev);
          newMap.set(data.documentId, data.code);
          return newMap;
        });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [selectedDoc, state.user]);

  useEffect(() => {
    if (!selectedDoc) return;

    setFileContents(prev => {
      if (!prev.has(selectedDoc.id)) {
        const newMap = new Map(prev);
        newMap.set(selectedDoc.id, '// Start coding here...\n');
        return newMap;
      }
      return prev;
    });
  }, [selectedDoc]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (selectedDoc && fileContents.has(selectedDoc.id)) {
        const content = fileContents.get(selectedDoc.id);
        if (content && (isOwner || userRole === 'ADMIN' || userRole === 'EDITOR')) {
          saveContent(selectedDoc.id, content);
        }
      }
    };
  }, [selectedDoc, fileContents, saveContent, isOwner, userRole]);

  // Save when switching documents
  useEffect(() => {
    return () => {
      if (prevDocId.current && fileContents.has(prevDocId.current)) {
        const content = fileContents.get(prevDocId.current);
        if (content && (isOwner || userRole === 'ADMIN' || userRole === 'EDITOR')) {
          saveContent(prevDocId.current, content);
        }
      }
    };
  }, [fileContents, saveContent, isOwner, userRole]);

  useEffect(() => {
    if (selectedDoc) {
      // Update prevDocId after switching
      prevDocId.current = selectedDoc.id;
    }
  }, [selectedDoc]);

  // Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (selectedDoc && fileContents.has(selectedDoc.id)) {
          const content = fileContents.get(selectedDoc.id);
          if (content && (isOwner || userRole === 'ADMIN' || userRole === 'EDITOR')) {
            saveContent(selectedDoc.id, content);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDoc, fileContents, saveContent, isOwner, userRole]);

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit()) {
      alert('You do not have permission to create files');
      return;
    }

    try {
      const doc = await apiService.createDocument({
        projectId: projectId!,
        folderId: newFolderParentId || undefined,
        name: newFileName,
        language: 'javascript'
      });
      setDocuments([...documents, doc]);
      setSelectedDoc(doc);
      setShowNewFile(false);
      setNewFileName('');
      setNewFolderParentId(null);
    } catch (error) {
      console.error('Failed to create file:', error);
      alert('Failed to create file. You may not have permission.');
    }
  };

  const handleCreateFolder = (parentId: string | null) => {
    if (!canEdit()) {
      alert('You do not have permission to create folders');
      return;
    }
    setNewFolderParentId(parentId);
    setShowNewFolderModal(true);
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit()) {
      alert('You do not have permission to create folders');
      return;
    }

    try {
      await apiService.createFolder({
        projectId: projectId!,
        name: newFolderName,
        parentId: newFolderParentId || undefined
      });
      setShowNewFolderModal(false);
      setNewFolderName('');
      setNewFolderParentId(null);
      loadFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. You may not have permission.');
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!canEdit()) {
      alert('You do not have permission to rename folders');
      return;
    }

    try {
      await apiService.renameFolder(folderId, newName);
      loadFolders();
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert('Failed to rename folder. You may not have permission.');
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    if (!canEdit()) {
      alert('You do not have permission to rename files');
      return;
    }

    try {
      await apiService.renameDocument(fileId, newName);
      setDocuments(documents.map(d =>
        d.id === fileId ? { ...d, name: newName } : d
      ));
      if (selectedDoc?.id === fileId) {
        setSelectedDoc({ ...selectedDoc, name: newName });
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('Failed to rename file. You may not have permission.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!canEdit()) {
      alert('You do not have permission to delete folders');
      return;
    }

    try {
      await apiService.deleteFolder(folderId);
      loadFolders();
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert('Failed to delete folder. You may not have permission.');
    }
  };

  const handleCreateFileInFolder = (folderId: string | null) => {
    if (!canEdit()) {
      alert('You do not have permission to create files');
      return;
    }
    setNewFolderParentId(folderId);
    setShowNewFile(true);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !selectedDoc) return;

    // Don't allow changes if user can't edit
    if (!canEdit()) {
      return;
    }

    if (!isRemoteChange.current) {
      setFileContents(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedDoc.id, value);
        return newMap;
      });

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Increase debounce to 3 seconds to reduce API calls
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(selectedDoc.id, value);
      }, 3000);

      // Emit to socket (less frequently using throttle)
      if (socketRef.current && state.user) {
        socketRef.current.emit('code-change', {
          documentId: selectedDoc.id,
          code: value,
          userId: state.user.id
        });
      }
    } else {
      isRemoteChange.current = false;
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!canEdit()) {
      alert('You do not have permission to delete files');
      return;
    }

    try {
      await apiService.deleteDocument(fileId);
      setDocuments(prev => prev.filter(d => d.id !== fileId));
      setFileContents(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });

      if (selectedDoc?.id === fileId) {
        setSelectedDoc(null);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file. You may not have permission.');
    }
  };

  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const handleManageFolderAccess = (folderId: string, folderName: string) => {
    if (!canManageProject()) {
      alert('Only project owner or admin can manage folder permissions');
      return;
    }
    setSelectedFolderForPermission({ id: folderId, name: folderName });
    setShowFolderPermissionModal(true);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 3vw, 1.5rem)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)' }}>
          {isMobile && (
            <button onClick={() => setShowSidebar(!showSidebar)} style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center'
            }}>
              ☰
            </button>
          )}

          <button onClick={() => navigate('/dashboard')} style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.6rem, 2vw, 1rem)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
            fontWeight: '500'
          }}>
            ← {isMobile ? '' : 'Back'}
          </button>

          <h2 style={{
            margin: 0,
            fontSize: 'clamp(0.9rem, 2.5vw, 1.2rem)',
            maxWidth: isMobile ? '150px' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {project?.name || 'Loading...'}
          </h2>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(0.4rem, 1.5vw, 1rem)',
          flexWrap: 'wrap'
        }}>
          {/* Role Badge */}
          {userRole && (
            <div style={{
              background: userRole === 'ADMIN' ? 'rgba(255,215,0,0.3)' :
                userRole === 'EDITOR' ? 'rgba(76,175,80,0.3)' :
                  'rgba(158,158,158,0.3)',
              padding: 'clamp(0.3rem, 1vw, 0.4rem) clamp(0.5rem, 1.5vw, 0.8rem)',
              borderRadius: '20px',
              fontSize: 'clamp(0.7rem, 1.5vw, 0.85rem)',
              border: `1px solid ${userRole === 'ADMIN' ? 'rgba(255,215,0,0.6)' :
                userRole === 'EDITOR' ? 'rgba(76,175,80,0.6)' :
                  'rgba(158,158,158,0.6)'
                }`,
              fontWeight: 'bold'
            }}>
              {isOwner ? '👑 Owner' : userRole}
            </div>
          )}

          {/* Active Users */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.15)',
            padding: 'clamp(0.3rem, 1vw, 0.4rem) clamp(0.5rem, 1.5vw, 0.8rem)',
            borderRadius: '20px',
            fontSize: 'clamp(0.75rem, 1.5vw, 0.9rem)'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00ff88',
              display: 'inline-block',
              boxShadow: '0 0 6px #00ff88'
            }}></span>
            <span>{activeUsers.length + 1}</span>
          </div>

          <button onClick={toggleTheme} style={{
            background: 'rgba(255,255,255,0.3)',
            border: '2px solid rgba(255,255,255,0.5)',
            color: 'white',
            padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.6rem, 2vw, 1rem)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            {theme === 'light' ? '🌙' : '☀️'}
            {!isMobile && (
              <span style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)' }}>
                {theme === 'light' ? 'Dark' : 'Light'}
              </span>
            )}
          </button>

          {isMobile && (
            <button onClick={() => setShowChat(!showChat)} style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}>
              💬
            </button>
          )}

          {!isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.15)',
              padding: '0.4rem 0.8rem',
              borderRadius: '20px',
              fontSize: '0.9rem'
            }}>
              <span>{state.user?.name}</span>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mobile Sidebar Overlay */}
        {isMobile && showSidebar && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 999
            }}
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Sidebar */}
        <div style={{
          width: isMobile ? '80%' : 'clamp(200px, 20vw, 300px)',
          maxWidth: isMobile ? '280px' : 'none',
          background: theme === 'dark' ? '#1e1e1e' : '#252526',
          color: 'white',
          display: showSidebar ? 'flex' : 'none',
          flexDirection: 'column',
          overflowY: 'auto',
          position: isMobile ? 'fixed' : 'relative',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          boxShadow: isMobile ? '2px 0 8px rgba(0,0,0,0.3)' : 'none'
        }}>
          <div style={{
            padding: 'clamp(0.75rem, 2vw, 1rem)',
            borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#444'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
              textTransform: 'uppercase'
            }}>
              Explorer
            </h3>
            {isMobile && (
              <button onClick={() => setShowSidebar(false)} style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0'
              }}>
                ✕
              </button>
            )}
          </div>

          <div style={{ flex: 1, padding: '0.5rem', overflowY: 'auto' }}>
            <FileTree
              folders={Array.isArray(folders) ? folders : []}
              documents={Array.isArray(documents) ? documents : []}
              selectedDocId={selectedDoc?.id || null}
              onSelectDoc={handleSelectDoc}
              onCreateFolder={handleCreateFolder}
              onCreateFile={handleCreateFileInFolder}
              onDeleteFolder={handleDeleteFolder}
              onDeleteFile={handleDeleteFile}
              onRenameFolder={handleRenameFolder}
              onRenameFile={handleRenameFile}
              onManageFolderAccess={handleManageFolderAccess}
              theme={theme}
            />
          </div>
        </div>

        {/* Editor */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          {selectedDoc && (
            <div style={{
              background: theme === 'dark' ? '#2d2d2d' : '#f8f9fa',
              padding: 'clamp(0.6rem, 2vw, 0.75rem) clamp(0.75rem, 2vw, 1.5rem)',
              color: theme === 'dark' ? '#e0e0e0' : '#333',
              fontSize: 'clamp(0.85rem, 1.5vw, 0.95rem)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}`,
              gap: '1rem',
              flexWrap: 'wrap',
              minHeight: '50px',
              boxShadow: theme === 'dark'
                ? '0 2px 4px rgba(0,0,0,0.3)'
                : '0 1px 3px rgba(0,0,0,0.1)'
            }}>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flex: '1 1 auto',
                minWidth: 0,
              }}>
                <span style={{
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  📄
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: '600',
                    fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                    color: theme === 'dark' ? '#fff' : '#1a1a1a'
                  }}
                  title={selectedDoc.name}
                >
                  {selectedDoc.name}
                </span>
              </div>
              {/* Status Indicators */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexShrink: 0,
                flexWrap: 'wrap'
              }}>
                {/* Read-Only Badge */}
                {!canEditCurrentDoc() && (
                  <span style={{
                    background: theme === 'dark'
                      ? 'rgba(255, 152, 0, 0.2)'
                      : 'rgba(255, 152, 0, 0.15)',
                    color: theme === 'dark' ? '#ffb74d' : '#e65100',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: 'clamp(0.75rem, 1.2vw, 0.85rem)',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    border: `1.5px solid ${theme === 'dark' ? '#ff9800' : '#ff9800'}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <span style={{ fontSize: '1rem' }}>🔒</span>
                    READ-ONLY
                  </span>
                )}

                {/* Divider */}
                {!canEditCurrentDoc() && (
                  <div style={{
                    width: '1px',
                    height: '24px',
                    background: theme === 'dark' ? '#555' : '#ddd'
                  }} />
                )}

                {/* Save Status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  background: !canEditCurrentDoc()
                    ? theme === 'dark' ? 'rgba(158, 158, 158, 0.15)' : 'rgba(158, 158, 158, 0.1)'
                    : isSaving
                      ? theme === 'dark' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255, 193, 7, 0.1)'
                      : theme === 'dark' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)',
                  border: `1.5px solid ${!canEditCurrentDoc()
                      ? theme === 'dark' ? '#9e9e9e' : '#bdbdbd'
                      : isSaving
                        ? theme === 'dark' ? '#ffc107' : '#ffb300'
                        : theme === 'dark' ? '#66bb6a' : '#4caf50'
                    }`,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {/* Status Icon */}
                  <span style={{
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {!canEditCurrentDoc() ? '👁️' : isSaving ? '⏳' : '✓'}
                  </span>

                  {/* Status Text */}
                  <span style={{
                    fontSize: 'clamp(0.75rem, 1.2vw, 0.85rem)',
                    fontWeight: '600',
                    color: !canEditCurrentDoc()
                      ? theme === 'dark' ? '#bdbdbd' : '#757575'
                      : isSaving
                        ? theme === 'dark' ? '#ffd54f' : '#f57f17'
                        : theme === 'dark' ? '#81c784' : '#2e7d32',
                    whiteSpace: 'nowrap'
                  }}>
                    {!canEditCurrentDoc() ? (
                      'View Mode'
                    ) : isSaving ? (
                      'Saving...'
                    ) : lastSaved ? (
                      <>
                        <span style={{ display: window.innerWidth < 640 ? 'none' : 'inline' }}>
                          Saved{' '}
                        </span>
                        {lastSaved.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          ...(window.innerWidth >= 640 && { second: '2-digit' })
                        })}
                      </>
                    ) : (
                      'All changes saved'
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
          <Editor
            height="100%"
            defaultLanguage={selectedDoc?.language || 'javascript'}
            language={selectedDoc?.language || 'javascript'}
            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
            value={getCurrentContent()}
            onChange={handleEditorChange}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            options={{
              fontSize: isMobile ? 12 : 14,
              minimap: { enabled: !isMobile },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              lineNumbers: isMobile ? 'off' : 'on',
              glyphMargin: !isMobile,
              readOnly: !canEditCurrentDoc(), // Make read-only if no permission
              domReadOnly: !canEditCurrentDoc(),
              cursorStyle: canEditCurrentDoc() ? 'line' : 'block-outline',
            }}
          />
        </div>

        {/* Chat Panel */}
        {state.user && (
          <div
            style={{
              position: isMobile ? 'fixed' : 'relative',
              right: 0,
              bottom: 0,
              top: isMobile ? 'auto' : 0,
              width: isMobile ? '100%' : '300px',
              height: isMobile ? '70vh' : '100%',
              display: showChat || !isMobile ? 'flex' : 'none',
              flexDirection: 'column',
              zIndex: 1001,
              boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.3)' : 'none',
              background: theme === 'dark' ? '#1e1e1e' : '#f3f3f3',
              transition: 'transform 0.3s ease',
              transform: isMobile
                ? showChat
                  ? 'translateY(0%)'
                  : 'translateY(100%)'
                : 'none',
            }}
          >
            {isMobile && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  background: theme === 'dark' ? '#2d2d2d' : '#ddd',
                }}
              >
                <span>Chat</span>
                <button
                  onClick={() => setShowChat(false)}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <ChatPanel
              projectId={projectId!}
              socket={socketRef.current}
              currentUserId={state.user.id}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewFile && (
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
          onClick={() => {
            setShowNewFile(false);
            setNewFileName('');
            setNewFolderParentId(null);
          }}
        >
          <div style={{
            background: theme === 'dark' ? '#2d2d2d' : 'white',
            color: theme === 'dark' ? 'white' : '#333',
            padding: 'clamp(1.5rem, 3vw, 2rem)',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '400px'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}>Create New File</h3>
            <form onSubmit={handleCreateFile}>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.js"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  background: theme === 'dark' ? '#1e1e1e' : 'white',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => {
                  setShowNewFile(false);
                  setNewFileName('');
                  setNewFolderParentId(null);
                }} style={{
                  padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem)',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: 'clamp(0.85rem, 1.5vw, 0.9rem)'
                }}>
                  Cancel
                </button>
                <button type="submit" style={{
                  padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem)',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: 'clamp(0.85rem, 1.5vw, 0.9rem)'
                }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewFolderModal && (
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
          onClick={() => {
            setShowNewFolderModal(false);
            setNewFolderName('');
            setNewFolderParentId(null);
          }}
        >
          <div style={{
            background: theme === 'dark' ? '#2d2d2d' : 'white',
            color: theme === 'dark' ? 'white' : '#333',
            padding: 'clamp(1.5rem, 3vw, 2rem)',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '400px'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}>Create New Folder</h3>
            <form onSubmit={handleCreateFolderSubmit}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  background: theme === 'dark' ? '#1e1e1e' : 'white',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                  setNewFolderParentId(null);
                }} style={{
                  padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem)',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: 'clamp(0.85rem, 1.5vw, 0.9rem)'
                }}>
                  Cancel
                </button>
                <button type="submit" style={{
                  padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem)',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: 'clamp(0.85rem, 1.5vw, 0.9rem)'
                }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Folder Permission Modal */}
      {showFolderPermissionModal && selectedFolderForPermission && (
        <FolderPermissionModal
          folderId={selectedFolderForPermission.id}
          folderName={selectedFolderForPermission.name}
          projectId={projectId!}
          onClose={() => {
            setShowFolderPermissionModal(false);
            setSelectedFolderForPermission(null);
            loadFolders(); // Reload to update permissions
          }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .monaco-editor .margin,
          .monaco-editor .minimap {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default EditorPage;