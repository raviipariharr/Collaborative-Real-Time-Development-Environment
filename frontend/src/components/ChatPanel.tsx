import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { apiService } from '../services/api';

type ClientSocket = ReturnType<typeof io>;

interface Message {
  id: string;
  message: string;
  createdAt: string;
  readBy: string[];
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  replyTo?: {
    id: string;
    message: string;
    userName: string;
  };
}

interface ChatPanelProps {
  projectId: string;
  socket: ClientSocket | null;
  currentUserId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ projectId, socket, currentUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; message: string; userName: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiService.getProjectMessages(projectId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [projectId]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiService.getUnreadCount(projectId);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadMessages();
    loadUnreadCount();
    const interval = setInterval(() => {
      if (!isOpen) {
        loadUnreadCount();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [projectId, isOpen, loadMessages, loadUnreadCount]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleNewMessage = (message: Message) => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });

      if (!isOpen && message.user.id !== currentUserId) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleDeleteMessage = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    };

    socket.emit('join-project-chat', projectId);
    socket.off('new-chat-message', handleNewMessage);
    socket.on('new-chat-message', handleNewMessage);
    socket.off('delete-chat-message', handleDeleteMessage);
    socket.on('delete-chat-message', handleDeleteMessage);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
      socket.off('delete-chat-message', handleDeleteMessage);
    };
  }, [socket, projectId, isOpen, currentUserId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const markAsRead = useCallback(async () => {
    try {
      await apiService.markMessagesAsRead(projectId);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAsRead();
    }
  }, [isOpen, markAsRead, unreadCount]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const message = await apiService.sendChatMessage({
        projectId,
        message: newMessage,
        replyToId: replyingTo?.id
      });

      if (socket) {
        socket.emit('send-chat-message', { projectId, message });
      }

      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      await apiService.deleteChatMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      
      if (socket) {
        socket.emit('delete-chat-message', { projectId, messageId });
      }
      
      setShowContextMenu(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    }
  };

  const handleCopyMessage = (message: string) => {
    navigator.clipboard.writeText(message);
    setShowContextMenu(null);
    // Optional: Show toast notification
  };

  const handleReplyMessage = (msg: Message) => {
    setReplyingTo({
      id: msg.id,
      message: msg.message,
      userName: msg.user.name
    });
    setShowContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setShowContextMenu({
      messageId,
      x: e.clientX,
      y: e.clientY
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      audioChunksRef.current = [];
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64 or upload to storage
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        const message = await apiService.sendChatMessage({
          projectId,
          message: '🎤 Voice message',
          audioData: base64Audio
        });

        if (socket) {
          socket.emit('send-chat-message', { projectId, message });
        }
      };
    } catch (error) {
      console.error('Failed to send voice message:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 999,
        }}
      >
        💬
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ff4444',
            color: 'white',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '350px',
          height: '500px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '1rem',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Team Chat</h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            background: '#f5f5f5'
          }}>
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#999',
                marginTop: '2rem'
              }}>
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = msg.user.id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: '1rem',
                      display: 'flex',
                      flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                      gap: '0.5rem',
                      position: 'relative'
                    }}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                  >
                    {/* Avatar */}
                    {!isOwnMessage && (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: msg.user.avatar ? `url(${msg.user.avatar})` : '#667eea',
                        backgroundSize: 'cover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.85rem',
                        flexShrink: 0
                      }}>
                        {!msg.user.avatar && msg.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div style={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOwnMessage ? 'flex-end' : 'flex-start'
                    }}>
                      {!isOwnMessage && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#666',
                          marginBottom: '0.25rem'
                        }}>
                          {msg.user.name}
                        </span>
                      )}

                      {/* Reply Preview */}
                      {msg.replyTo && (
                        <div style={{
                          background: 'rgba(0,0,0,0.1)',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          marginBottom: '0.3rem',
                          fontSize: '0.75rem',
                          borderLeft: '2px solid #667eea',
                          maxWidth: '100%',
                          wordBreak: 'break-word'
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.1rem' }}>
                            {msg.replyTo.userName}
                          </div>
                          <div style={{ opacity: 0.8 }}>
                            {msg.replyTo.message.substring(0, 50)}
                            {msg.replyTo.message.length > 50 ? '...' : ''}
                          </div>
                        </div>
                      )}

                      <div style={{
                        background: isOwnMessage ? '#667eea' : 'white',
                        color: isOwnMessage ? 'white' : '#333',
                        padding: '0.75rem',
                        borderRadius: isOwnMessage ? '12px 12px 0 12px' : '12px 12px 12px 0',
                        wordBreak: 'break-word',
                        position: 'relative'
                      }}>
                        {msg.message}
                        
                        {/* Hover Arrow */}
                        {hoveredMessageId === msg.id && (
                          <button
                            onClick={(e) => handleContextMenu(e as any, msg.id)}
                            style={{
                              position: 'absolute',
                              right: isOwnMessage ? 'auto' : '-30px',
                              left: isOwnMessage ? '-30px' : 'auto',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'rgba(0,0,0,0.1)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              color: '#666'
                            }}
                          >
                            ▼
                          </button>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#999',
                        marginTop: '0.25rem'
                      }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Preview */}
          {replyingTo && (
            <div style={{
              background: '#e8eaf6',
              padding: '0.5rem 1rem',
              borderTop: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem'
            }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', color: '#667eea' }}>
                  Replying to {replyingTo.userName}
                </div>
                <div style={{ 
                  color: '#666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {replyingTo.message}
                </div>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Recording UI */}
          {isRecording && (
            <div style={{
              background: '#fff3e0',
              padding: '1rem',
              borderTop: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#f44336',
                animation: 'pulse 1s infinite'
              }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                {formatRecordingTime(recordingTime)}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={cancelRecording}
                style={{
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={stopRecording}
                style={{
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          )}

          {/* Input */}
          {!isRecording && (
            <form onSubmit={handleSendMessage} style={{
              padding: '1rem',
              borderTop: '1px solid #ddd',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={startRecording}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Record voice message"
              >
                🎤
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '20px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                style={{
                  background: newMessage.trim() ? '#667eea' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ➤
              </button>
            </form>
          )}
        </div>
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: showContextMenu.y,
            left: showContextMenu.x,
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'hidden',
            minWidth: '150px'
          }}
        >
          {messages.find(m => m.id === showContextMenu.messageId)?.user.id === currentUserId && (
            <button
              onClick={() => handleDeleteMessage(showContextMenu.messageId)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#f44336',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🗑️ Delete
            </button>
          )}
          <button
            onClick={() => {
              const msg = messages.find(m => m.id === showContextMenu.messageId);
              if (msg) handleReplyMessage(msg);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ↩️ Reply
          </button>
          <button
            onClick={() => {
              const msg = messages.find(m => m.id === showContextMenu.messageId);
              if (msg) handleCopyMessage(msg.message);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📋 Copy
          </button>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default ChatPanel;