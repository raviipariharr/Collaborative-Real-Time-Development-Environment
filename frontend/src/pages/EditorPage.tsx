import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import io from 'socket.io-client';
import ChatPanel from '../components/ChatPanel';
import FileTree from '../components/FileTree';
import { useCallback } from 'react';
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
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, [projectId]) ;

  const loadDocuments = useCallback(async () => {
    try {
      const data = await apiService.getProjectDocuments(projectId!);
      setDocuments(data);
      if (data.length > 0 && !selectedDoc) {
        setSelectedDoc(data[0]);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }, [projectId,selectedDoc]);

  const loadFolders = useCallback(async () => {
    try {
      const data = await apiService.getFolders(projectId!);
      setFolders(data);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, [projectId]);
  

  // Load project data
  useEffect(() => {
    if (projectId) {
      loadProject();
      loadDocuments();
      loadFolders();
    }
  }, [projectId,loadProject, loadDocuments, loadFolders]);

  // WebSocket connection
  // eslint-disable-next-line react-hooks/exhaustive-deps

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
        if (!state.user || data.userId === state.user.id) return; // ignore self updates
    

    isRemoteChange.current = true;

    // Update content only for that documentId
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
    if (selectedDoc) {
      if (!fileContents.has(selectedDoc.id)) {
        setFileContents(prev => {
          const newMap = new Map(prev);
          newMap.set(selectedDoc.id, '// Start coding here...\n');
          return newMap;
        });
      }
    }
  }, [selectedDoc?.id]);

  useEffect(() => {
  if (selectedDoc) {
    // If we don't have content for this file yet, load it
    if (!fileContents.has(selectedDoc.id)) {
      // In a real app, you'd fetch from backend
      // For now, initialize with default content
      setFileContents(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedDoc.id, '// Start coding here...\n');
        return newMap;
      });
    }
  }
}, [selectedDoc,fileContents]);


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
  if (!value || !selectedDoc) return;
  
  if (!isRemoteChange.current) {
    // Update content for current file only
    setFileContents(prev => {
      const newMap = new Map(prev);
      newMap.set(selectedDoc.id, value);
      return newMap;
    });
    
    // Emit code change to other users
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
  try {
    // Delete on backend
    await apiService.deleteDocument(fileId);

    // Remove from local documents list
    setDocuments(prev => prev.filter(d => d.id !== fileId));

    // Remove the deleted file from the fileContents map
    setFileContents(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });

    // If the deleted file was currently selected, clear selection
    if (selectedDoc?.id === fileId) {
      setSelectedDoc(null);
    }
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
};
  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Responsive Header */}
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
          {/* Mobile Menu Toggle */}
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
          {/* Active Users Badge */}
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

          {/* Theme Toggle */}
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

          {/* Chat Toggle (Mobile) */}
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

          {/* User Info (Desktop only) */}
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

        {/* Sidebar with File Tree */}
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
              folders={folders}
              documents={documents}
              selectedDocId={selectedDoc?.id || null}
              onSelectDoc={handleSelectDoc}
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
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: 0
        }}>
          {selectedDoc && (
            <div style={{ 
              background: theme === 'dark' ? '#1e1e1e' : '#f3f3f3',
              padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem)', 
              color: theme === 'dark' ? 'white' : '#333',
              fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
              borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {selectedDoc.name}
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
              glyphMargin: !isMobile
            }}
          />
        </div>

        {/* Chat Panel - Responsive */}
        {projectId && state.user && (
          <div style={{
            position: isMobile ? 'fixed' : 'relative',
            right: 0,
            bottom: 0,
            top: isMobile ? 'auto' : 0,
            width: isMobile ? '100%' : 'auto',
            maxHeight: isMobile ? '70vh' : 'none',
            display: (isMobile && !showChat) ? 'none' : 'block',
            zIndex: isMobile ? 1001 : 1,
            boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.3)' : 'none'
          }}>
            <ChatPanel 
              projectId={projectId} 
              socket={socketRef.current}
              currentUserId={state.user.id}
            />
            {isMobile && showChat && (
              <button 
                onClick={() => setShowChat(false)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
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
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Responsive Modals */}
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