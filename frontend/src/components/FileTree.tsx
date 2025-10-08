import React, { useState, useEffect, useRef } from 'react';

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
  children?: Folder[];
  documents?: Document[];
}

interface FileTreeProps {
  folders: Folder[];
  documents: Document[];
  selectedDocId: string | null;
  onSelectDoc: (doc: Document) => void;
  onCreateFolder: (parentId: string | null) => void;
  onCreateFile: (folderId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteFile: (fileId: string) => void;  // ADD THIS
  onRenameFolder: (folderId: string, newName: string) => void;
  onRenameFile: (fileId: string, newName: string) => void; 
  theme: 'light' | 'dark';
}

const FileTree: React.FC<FileTreeProps> = ({
  folders,
  documents,
  selectedDocId,
  onSelectDoc,
  onCreateFolder,
  onCreateFile,
  onDeleteFolder,
  onDeleteFile, 
  onRenameFile, 
  onRenameFolder,
  theme
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    type: 'folder' | 'file' | 'root'; 
    id: string | null 
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      type: 'folder',
      id: folderId 
    });
  };

  const handleFileContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      type: 'file',
      id: fileId 
    });
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      type: 'root',
      id: null 
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const buildTree = (parentId: string | null): Folder[] => {
    return folders
      .filter(f => f.parentId === parentId)
      .map(folder => ({
        ...folder,
        children: buildTree(folder.id),
        documents: documents.filter(d => d.folderId === folder.id)
      }));
  };

  const renderFolder = (folder: Folder, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children && folder.children.length > 0;
    const hasDocuments = folder.documents && folder.documents.length > 0;

    return (
      <div key={folder.id} style={{ marginLeft: `${depth * 12}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.4rem 0.5rem',
            cursor: 'pointer',
            background: 'transparent',
            borderRadius: '4px',
            transition: 'background 0.2s',
            userSelect: 'none'
          }}
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
          onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
            {hasChildren || hasDocuments ? (isExpanded ? '📂' : '📁') : '📁'}
          </span>
          <span style={{ fontSize: '0.9rem' }}>{folder.name}</span>
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
    const isSelected = doc.id === selectedDocId;
    
    return (
      <div
        key={doc.id}
        style={{
          marginLeft: `${depth * 12}px`,
          display: 'flex',
          alignItems: 'center',
          padding: '0.4rem 0.5rem',
          cursor: 'pointer',
          background: isSelected ? (theme === 'dark' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)') : 'transparent',
          borderRadius: '4px',
          transition: 'background 0.2s',
          userSelect: 'none'
        }}
        onClick={() => onSelectDoc(doc)}
        onContextMenu={(e) => handleFileContextMenu(e, doc.id)}
        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
          {getFileIcon(doc.language)}
        </span>
        <span style={{ fontSize: '0.9rem' }}>{doc.name}</span>
      </div>
    );
  };

  const getFileIcon = (language: string) => {
    const icons: Record<string, string> = {
      javascript: '📜',
      typescript: '📘',
      python: '🐍',
      html: '🌐',
      css: '🎨',
      json: '📋',
      markdown: '📝'
    };
    return icons[language] || '📄';
  };

  const tree = buildTree(null);
  const rootDocuments = documents.filter(d => !d.folderId);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div 
        onContextMenu={handleRootContextMenu}
        style={{ minHeight: '100%', padding: '0.5rem' }}
      >
        {tree.map(folder => renderFolder(folder))}
        {rootDocuments.map(doc => renderDocument(doc))}
        
        {tree.length === 0 && rootDocuments.length === 0 && (
          <div style={{ 
            padding: '2rem 1rem', 
            textAlign: 'center', 
            color: '#888',
            fontSize: '0.85rem',
            lineHeight: '1.6'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
            <div>Right-click anywhere to create</div>
            <div>folders and files</div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: theme === 'dark' ? '#2d2d2d' : 'white',
            border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: '180px',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Root or Folder Context Menu */}
          {(contextMenu.type === 'root' || contextMenu.type === 'folder') && (
            <>
              <button
                onClick={() => {
                  onCreateFolder(contextMenu.id);
                  closeContextMenu();
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span>📁</span> New Folder
              </button>
              <button
                onClick={() => {
                  onCreateFile(contextMenu.id);
                  closeContextMenu();
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span>📄</span> New File
              </button>
            </>
          )}

          {/* Folder-specific actions */}
          {contextMenu.type === 'folder' && contextMenu.id && (
            <>
              <div style={{ 
                height: '1px', 
                background: theme === 'dark' ? '#444' : '#ddd',
                margin: '0.25rem 0'
              }} />
              <button
                onClick={() => {
                  const newName = prompt('Enter new folder name:');
                  if (newName && newName.trim()) {
                    onRenameFolder(contextMenu.id!, newName.trim());
                  }
                  closeContextMenu();
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: theme === 'dark' ? 'white' : '#333',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span>✏️</span> Rename
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this folder and all its contents?')) {
                    onDeleteFolder(contextMenu.id!);
                  }
                  closeContextMenu();
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#f44336',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244,67,54,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span>🗑️</span> Delete Folder
              </button>
            </>
          )}

          {/* File-specific actions */}
{contextMenu.type === 'file' && contextMenu.id && (
  <>
    <button
      onClick={() => {
        const file = documents.find(d => d.id === contextMenu.id);
        const newName = prompt('Enter new file name:', file?.name);
        if (newName && newName.trim()) {
          onRenameFile(contextMenu.id!, newName.trim());
        }
        closeContextMenu();
      }}
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        color: theme === 'dark' ? 'white' : '#333',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span>✏️</span> Rename
    </button>
    <button
      onClick={() => {
        if (confirm('Delete this file?')) {
          onDeleteFile(contextMenu.id!);
        }
        closeContextMenu();
      }}
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        color: '#f44336',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244,67,54,0.1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span>🗑️</span> Delete File
    </button>
  </>
)}
        </div>
      )}
    </div>
  );
};

export default FileTree;