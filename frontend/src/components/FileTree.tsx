import React, { useState, useEffect, useRef } from 'react';

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
  onDeleteFile: (fileId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onManageFolderAccess?: (folderId: string, folderName: string) => void;
  theme: 'light' | 'dark';
}

type DeleteTarget =
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'file'; id: string; name: string }
  | null;

type RenameTarget =
  | { kind: 'folder'; id: string }
  | { kind: 'file'; id: string }
  | null;

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
  theme,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'folder' | 'file' | 'root';
    id: string | null;
  } | null>(null);

  // Custom delete modal state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  // Inline rename state
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        closeContextMenu();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
        setDeleteTarget(null);
        setRenameTarget(null);
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

  // Focus rename input when it appears
  useEffect(() => {
    if (renameTarget && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameTarget]);

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
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', id: folderId });
  };

  const handleFileContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'file', id: fileId });
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'root', id: null });
  };

  const closeContextMenu = () => setContextMenu(null);

  // ── Rename helpers ──────────────────────────────────────────────────────────

  const startRename = (kind: 'folder' | 'file', id: string, currentName: string) => {
    setRenameTarget({ kind, id });
    setRenameValue(currentName);
    closeContextMenu();
    // Expand folder so the inline input is visible
    if (kind === 'folder') {
      setExpandedFolders((prev) => new Set([...prev, id]));
    }
  };

  const commitRename = () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      if (renameTarget.kind === 'folder') {
        onRenameFolder(renameTarget.id, trimmed);
      } else {
        onRenameFile(renameTarget.id, trimmed);
      }
    }
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setRenameTarget(null);
      setRenameValue('');
    }
  };

  // ── Delete helpers ──────────────────────────────────────────────────────────

  const requestDelete = (kind: 'folder' | 'file', id: string, name: string) => {
    setDeleteTarget({ kind, id, name });
    closeContextMenu();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'folder') onDeleteFolder(deleteTarget.id);
    else onDeleteFile(deleteTarget.id);
    setDeleteTarget(null);
  };

  // ── Tree builder ────────────────────────────────────────────────────────────

  const buildTree = (parentId: string | null): Folder[] => {
    if (!Array.isArray(folders)) return [];
    return folders
      .filter((f) => f.parentId === parentId)
      .map((folder) => ({
        ...folder,
        children: buildTree(folder.id),
        documents: Array.isArray(documents)
          ? documents.filter((d) => d.folderId === folder.id)
          : [],
      }));
  };

  // ── Colours ─────────────────────────────────────────────────────────────────

  const colors = {
    hover: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    text: theme === 'dark' ? '#d4d4d4' : '#333',
    subtext: theme === 'dark' ? '#888' : '#999',
    menuBg: theme === 'dark' ? '#2d2d2d' : '#ffffff',
    menuBorder: theme === 'dark' ? '#444' : '#e0e0e0',
    menuHover: theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f5f5f5',
    inputBg: theme === 'dark' ? '#1e1e1e' : '#ffffff',
    inputBorder: theme === 'dark' ? '#555' : '#bbb',
    inputFocus: '#667eea',
  };

  // ── Render folder ───────────────────────────────────────────────────────────

  const renderFolder = (folder: Folder, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isRenaming =
      renameTarget?.kind === 'folder' && renameTarget.id === folder.id;
    const hasChildren =
      (folder.children?.length ?? 0) > 0 ||
      (folder.documents?.length ?? 0) > 0;

    return (
      <div key={folder.id} style={{ marginLeft: depth * 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.35rem 0.5rem',
            cursor: 'pointer',
            borderRadius: 4,
            transition: 'background 0.15s',
            userSelect: 'none',
            gap: '0.4rem',
          }}
          onClick={() => !isRenaming && toggleFolder(folder.id)}
          onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = colors.hover)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = 'transparent')
          }
        >
          {/* Chevron */}
          <span
            style={{
              fontSize: '0.6rem',
              color: colors.subtext,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              width: 10,
              flexShrink: 0,
              opacity: hasChildren ? 1 : 0,
            }}
          >
            ▶
          </span>

          {/* Icon */}
          <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>
            {isExpanded ? '📂' : '📁'}
          </span>

          {/* Inline rename input OR label */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                fontSize: '0.88rem',
                padding: '0.15rem 0.4rem',
                border: `1.5px solid ${colors.inputFocus}`,
                borderRadius: 4,
                background: colors.inputBg,
                color: colors.text,
                outline: 'none',
                minWidth: 0,
              }}
            />
          ) : (
            <span
              style={{
                fontSize: '0.88rem',
                color: colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {folder.name}
            </span>
          )}
        </div>

        {isExpanded && (
          <>
            {folder.children?.map((child) => renderFolder(child, depth + 1))}
            {folder.documents?.map((doc) => renderDocument(doc, depth + 1))}
          </>
        )}
      </div>
    );
  };

  // ── Render document ─────────────────────────────────────────────────────────

  const renderDocument = (doc: Document, depth = 0) => {
    const isSelected = doc.id === selectedDocId;
    const isRenaming =
      renameTarget?.kind === 'file' && renameTarget.id === doc.id;

    return (
      <div
        key={doc.id}
        style={{
          marginLeft: depth * 12,
          display: 'flex',
          alignItems: 'center',
          padding: '0.35rem 0.5rem',
          cursor: 'pointer',
          background: isSelected
            ? theme === 'dark'
              ? 'rgba(102,126,234,0.28)'
              : 'rgba(102,126,234,0.18)'
            : 'transparent',
          borderRadius: 4,
          transition: 'background 0.15s',
          userSelect: 'none',
          gap: '0.4rem',
        }}
        onClick={() => !isRenaming && onSelectDoc(doc)}
        onContextMenu={(e) => handleFileContextMenu(e, doc.id)}
        onMouseEnter={(e) => {
          if (!isSelected)
            e.currentTarget.style.background = colors.hover;
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* Indent spacer to align with folder chevron */}
        <span style={{ width: 10, flexShrink: 0 }} />

        <span style={{ fontSize: '0.88rem', flexShrink: 0 }}>
          {getFileIcon(doc.language)}
        </span>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              fontSize: '0.88rem',
              padding: '0.15rem 0.4rem',
              border: `1.5px solid ${colors.inputFocus}`,
              borderRadius: 4,
              background: colors.inputBg,
              color: colors.text,
              outline: 'none',
              minWidth: 0,
            }}
          />
        ) : (
          <span
            style={{
              fontSize: '0.88rem',
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doc.name}
          </span>
        )}
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
      markdown: '📝',
    };
    return icons[language] || '📄';
  };

  const tree = Array.isArray(folders) ? buildTree(null) : [];
  const rootDocuments = Array.isArray(documents)
    ? documents.filter((d) => !d.folderId)
    : [];

  // ── Context menu item ───────────────────────────────────────────────────────

  const MenuItem: React.FC<{
    icon: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }> = ({ icon, label, onClick, danger }) => (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '0.6rem 1rem',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        color: danger ? '#f44336' : colors.text,
        fontSize: '0.88rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        borderRadius: 4,
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = danger
          ? 'rgba(244,67,54,0.1)'
          : colors.menuHover)
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: '0.85rem' }}>{icon}</span>
      {label}
    </button>
  );

  const Divider = () => (
    <div
      style={{
        height: 1,
        background: colors.menuBorder,
        margin: '0.2rem 0',
      }}
    />
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* Tree */}
      <div
        onContextMenu={handleRootContextMenu}
        style={{ minHeight: '100%', padding: '0.5rem' }}
      >
        {tree.map((folder) => renderFolder(folder))}
        {rootDocuments.map((doc) => renderDocument(doc))}

        {tree.length === 0 && rootDocuments.length === 0 && (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: colors.subtext,
              fontSize: '0.83rem',
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📁</div>
            <div>Right-click to create</div>
            <div>folders and files</div>
          </div>
        )}
      </div>

      {/* ── Context Menu ──────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: colors.menuBg,
            border: `1px solid ${colors.menuBorder}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 1000,
            minWidth: 190,
            padding: '0.3rem',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Root / Folder — create actions */}
          {(contextMenu.type === 'root' || contextMenu.type === 'folder') && (
            <>
              <MenuItem
                icon="📁"
                label="New Folder"
                onClick={() => {
                  onCreateFolder(contextMenu.id);
                  closeContextMenu();
                }}
              />
              <MenuItem
                icon="📄"
                label="New File"
                onClick={() => {
                  onCreateFile(contextMenu.id);
                  closeContextMenu();
                }}
              />
            </>
          )}

          {/* Folder-specific */}
          {contextMenu.type === 'folder' && contextMenu.id && (
            <>
              <Divider />
              <MenuItem
                icon="✏️"
                label="Rename"
                onClick={() => {
                  const folder = folders.find((f) => f.id === contextMenu.id);
                  if (folder) startRename('folder', folder.id, folder.name);
                }}
              />
              <MenuItem
                icon="🗑️"
                label="Delete Folder"
                danger
                onClick={() => {
                  const folder = folders.find((f) => f.id === contextMenu.id);
                  if (folder)
                    requestDelete('folder', folder.id, folder.name);
                }}
              />
            </>
          )}

          {/* File-specific */}
          {contextMenu.type === 'file' && contextMenu.id && (
            <>
              <MenuItem
                icon="✏️"
                label="Rename"
                onClick={() => {
                  const file = documents.find((d) => d.id === contextMenu.id);
                  if (file) startRename('file', file.id, file.name);
                }}
              />
              <MenuItem
                icon="🗑️"
                label="Delete File"
                danger
                onClick={() => {
                  const file = documents.find((d) => d.id === contextMenu.id);
                  if (file) requestDelete('file', file.id, file.name);
                }}
              />
            </>
          )}
        </div>
      )}

      {/* ── Custom Delete Modal ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
              borderRadius: 14,
              padding: '2rem',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              border: `1px solid ${theme === 'dark' ? '#333' : '#e5e5e5'}`,
              animation: 'fadeSlideUp 0.18s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(244,67,54,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginBottom: '1.1rem',
              }}
            >
              🗑️
            </div>

            <h3
              style={{
                margin: '0 0 0.5rem',
                fontSize: '1.05rem',
                color: theme === 'dark' ? '#fff' : '#111',
                fontWeight: 700,
              }}
            >
              Delete {deleteTarget.kind === 'folder' ? 'folder' : 'file'}?
            </h3>

            <p
              style={{
                margin: '0 0 1.6rem',
                fontSize: '0.88rem',
                color: theme === 'dark' ? '#aaa' : '#555',
                lineHeight: 1.55,
              }}
            >
              <strong
                style={{ color: theme === 'dark' ? '#eee' : '#222' }}
              >
                "{deleteTarget.name}"
              </strong>{' '}
              will be permanently deleted
              {deleteTarget.kind === 'folder' &&
                ' along with all its contents'}
              . This cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: `1.5px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  borderRadius: 8,
                  background: 'transparent',
                  color: theme === 'dark' ? '#ccc' : '#555',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '0.6rem 1.3rem',
                  border: 'none',
                  borderRadius: 8,
                  background: '#f44336',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  transition: 'background 0.15s, transform 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#d32f2f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f44336';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.97)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Delete
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeSlideUp {
              from { opacity: 0; transform: translateY(12px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)   scale(1);    }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default FileTree;