import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import io, { Socket } from 'socket.io-client';
import ChatPanel from '../components/ChatPanel';
import FileTree from '../components/FileTree';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

interface Document {
  id: string;
  name: string;
  language: string;
  folderId: string | null;
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

const EditorPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Project data
  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [code, setCode] = useState('// Start coding here...\n');

  // Modals
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Real-time
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const isRemoteChange = useRef(false);

  // Load project data
  useEffect(() => {
    if (projectId) {
      loadProject();
      loadDocuments();
      loadFolders();
    }
  }, [projectId]);

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

      socket.on('code-update', (data: { code: string; userId: string }) => {
        if (data.userId !== state.user?.id) {
          isRemoteChange.current = true;
          setCode(data.code);
        }
      });

      socket.on('users-in-document', (data: { count: number }) => {
        console.log(`${data.count} users in document`);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [selectedDoc, state.user]);

  const loadProject = async () => {
    try {
      const data = await apiService.getProject(projectId!);
      setProject(data);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const data = await apiService.getProjectDocuments(projectId!);
      setDocuments(data);
      if (data.length > 0 && !selectedDoc) {
        setSelectedDoc(data[0]);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadFolders = async () => {
    try {
      const data = await apiService.getFolders(projectId!);
      setFolders(data);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };
  
  const handleCreateFolder = (parentId: string | null) => {
    setNewFolderParentId(parentId);
    setShowNewFolderModal(true);
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await apiService.renameFolder(folderId, newName);
      loadFolders();
    } catch (error) {
      console.error('Failed to rename folder:', error);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
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
  }
};

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await apiService.deleteFolder(folderId);
      loadFolders();
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  const handleCreateFileInFolder = (folderId: string | null) => {
    setNewFolderParentId(folderId);
    setShowNewFile(true);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    
    if (!isRemoteChange.current) {
      setCode(value);
      
      if (socketRef.current && selectedDoc && state.user) {
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
  try {
    await apiService.deleteDocument(fileId);
    setDocuments(documents.filter(d => d.id !== fileId));
    if (selectedDoc?.id === fileId) {
      setSelectedDoc(null);
      setCode('// Start coding here...\n');
    }
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
};

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '0.75rem 1.5rem',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{project?.name || 'Loading...'}</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.15)',
            padding: '0.4rem 0.8rem',
            borderRadius: '20px'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: '#00ff88',
              display: 'inline-block',
              boxShadow: '0 0 8px #00ff88'
            }}></span>
            <span style={{ fontSize: '0.9rem' }}>{activeUsers.length + 1} active</span>
          </div>

          <button onClick={toggleTheme} style={{
            background: 'rgba(255,255,255,0.3)',
            border: '2px solid rgba(255,255,255,0.5)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
            <span style={{ fontSize: '0.8rem' }}>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.15)',
            padding: '0.4rem 0.8rem',
            borderRadius: '20px'
          }}>
            <span style={{ fontSize: '0.9rem' }}>{state.user?.name}</span>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar with File Tree */}
        <div style={{
          width: '250px',
          background: theme === 'dark' ? '#1e1e1e' : '#252526',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          <div style={{ 
            padding: '1rem',
            borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#444'}`
          }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase' }}>
              Explorer
            </h3>
          </div>
          
          <div style={{ flex: 1, padding: '0.5rem' }}>
            <FileTree
              folders={folders}
              documents={documents}
              selectedDocId={selectedDoc?.id || null}
              onSelectDoc={setSelectedDoc}
              onCreateFolder={handleCreateFolder}
              onCreateFile={handleCreateFileInFolder}
              onDeleteFolder={handleDeleteFolder}
              onDeleteFile={handleDeleteFile} 
              onRenameFolder={handleRenameFolder}
              onRenameFile={handleRenameFile}
              theme={theme}
            />
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedDoc && (
            <div style={{ 
              background: theme === 'dark' ? '#1e1e1e' : '#f3f3f3',
              padding: '0.5rem 1rem', 
              color: theme === 'dark' ? 'white' : '#333',
              fontSize: '0.9rem',
              borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`
            }}>
              {selectedDoc.name}
            </div>
          )}
          <Editor
            height="100%"
            defaultLanguage={selectedDoc?.language || 'javascript'}
            language={selectedDoc?.language || 'javascript'}
            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
            value={code}
            onChange={handleEditorChange}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            options={{
              fontSize: 14,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true
            }}
          />
        </div>
      </div>

      {/* New File Modal */}
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
          zIndex: 1000
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
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '400px'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3>Create New File</h3>
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
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  background: theme === 'dark' ? '#1e1e1e' : 'white',
                  color: theme === 'dark' ? 'white' : '#333'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => {
                  setShowNewFile(false);
                  setNewFileName('');
                  setNewFolderParentId(null);
                }} style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333'
                }}>
                  Cancel
                </button>
                <button type="submit" style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
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
          zIndex: 1000
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
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '400px'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3>Create New Folder</h3>
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
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  background: theme === 'dark' ? '#1e1e1e' : 'white',
                  color: theme === 'dark' ? 'white' : '#333'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                  setNewFolderParentId(null);
                }} style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333'
                }}>
                  Cancel
                </button>
                <button type="submit" style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {projectId && state.user && (
        <ChatPanel 
          projectId={projectId} 
          socket={socketRef.current}
          currentUserId={state.user.id}
        />
      )}
    </div>
  );
};
export default EditorPage;