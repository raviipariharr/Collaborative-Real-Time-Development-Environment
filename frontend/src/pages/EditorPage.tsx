import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import io, { Socket } from 'socket.io-client';
import ChatPanel from '../components/ChatPanel';
import { useTheme } from '../contexts/ThemeContext';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

interface Document {
  id: string;
  name: string;
  language: string;
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
  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [code, setCode] = useState('// Start coding here...\n');
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const isRemoteChange = useRef(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadDocuments();
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedDoc && state.user) {
      // Initialize WebSocket connection
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

      socket.on('user-joined', (data: { userId: string; userName: string }) => {
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
      if (data.length > 0) {
        setSelectedDoc(data[0]);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const doc = await apiService.createDocument({
        projectId: projectId!,
        name: newFileName,
        language: 'javascript'
      });
      setDocuments([...documents, doc]);
      setSelectedDoc(doc);
      setShowNewFile(false);
      setNewFileName('');
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    
    if (!isRemoteChange.current) {
      setCode(value);
      
      // Emit code change to other users
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '0.75rem 1.5rem',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Back
          </button>
          <h2 style={{ margin: 0 }}>{project?.name || 'Loading...'}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Theme Toggle Button */}
    <button onClick={toggleTheme} style={{
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      color: 'white',
      padding: '0.5rem 1rem',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '1.2rem'
    }}></button>
    {/* Theme Toggle Button */}
    <button onClick={toggleTheme} style={{
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      color: 'white',
      padding: '0.5rem 1rem',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '1.2rem'
    }}></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: '#00ff88',
              display: 'inline-block'
            }}></span>
            <span>{activeUsers.length + 1} active</span>
          </div>
          <span>{state.user?.name}</span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: '250px',
          background: theme === 'dark' ? '#1e1e1e' : '#252526',
          color: 'white',
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem' }}>FILES</h3>
            <button onClick={() => setShowNewFile(true)} style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}>
              +
            </button>
          </div>

          {documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              style={{
                padding: '0.5rem',
                margin: '0.25rem 0',
                background: selectedDoc?.id === doc.id ? '#37373d' : 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {doc.name}
            </div>
          ))}

          {documents.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: '#888' }}>No files yet. Create one!</p>
          )}

          {/* Active Users */}
          {activeUsers.length > 0 && (
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #444' }}>
              <h4 style={{ fontSize: '0.8rem', margin: '0 0 0.5rem 0', color: '#888' }}>
                ACTIVE USERS
              </h4>
              {activeUsers.map(user => (
                <div key={user.socketId} style={{ 
                  fontSize: '0.85rem', 
                  padding: '0.25rem 0',
                  color: '#ccc'
                }}>
                  {user.userName}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedDoc && (
            <div style={{ background: '#1e1e1e', padding: '0.5rem 1rem', color: 'white', fontSize: '0.9rem' }}>
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
        onClick={() => setShowNewFile(false)}
        >
          <div style={{
            background: 'white',
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
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '1rem'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowNewFile(false)} style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
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
      {/* Add Chat Panel */}
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