import React, { useState, useEffect, useRef ,useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { apiService } from '../services/api';
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
}

interface ChatPanelProps {
  projectId: string;
  socket: Socket | null;
  currentUserId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ projectId, socket, currentUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const loadMessages = useCallback(async () => {
    try {
      const data = await apiService.getProjectMessages(projectId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },[projectId]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiService.getUnreadCount(projectId);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  },[projectId]);

  useEffect(() => {
    loadMessages();
    loadUnreadCount();
    // Poll for unread count every 10 seconds when chat is closed
    const interval = setInterval(() => {
      if (!isOpen) {
        loadUnreadCount();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [projectId, isOpen,loadMessages,loadUnreadCount]);

  useEffect(() => {
    if (socket && projectId) {
      socket.emit('join-project-chat', projectId);

      socket.on('new-chat-message', (message: Message) => {
        setMessages(prev => [...prev, message]);
        
        // If chat is closed and message is from someone else, increment unread
        if (!isOpen && message.user.id !== currentUserId) {
          setUnreadCount(prev => prev + 1);
        }
      });

      return () => {
        socket.off('new-chat-message');
      };
    }
  }, [socket, projectId, isOpen, currentUserId]);
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesEndRef]);


  useEffect(() => {
    scrollToBottom();
  }, [messages,scrollToBottom]);

  // Mark messages as read when chat is opened
  const markAsRead = useCallback(async () => {
    try {
      await apiService.markMessagesAsRead(projectId);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },[projectId]);
  
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAsRead();
    }
  }, [isOpen,markAsRead,unreadCount]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const message = await apiService.sendChatMessage({
        projectId,
        message: newMessage
      });

      setMessages(prev => [...prev, message]);

      if (socket) {
        socket.emit('send-chat-message', { projectId, message });
      }

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Will be marked as read by the useEffect
    }
  };

  return (
    <>
      {/* Chat Toggle Button with Badge */}
      <button
        onClick={toggleChat}
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
              onClick={toggleChat}
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
                      gap: '0.5rem'
                    }}
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
                      <div style={{
                        background: isOwnMessage ? '#667eea' : 'white',
                        color: isOwnMessage ? 'white' : '#333',
                        padding: '0.75rem',
                        borderRadius: isOwnMessage ? '12px 12px 0 12px' : '12px 12px 12px 0',
                        wordBreak: 'break-word'
                      }}>
                        {msg.message}
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

          {/* Input */}
          <form onSubmit={handleSendMessage} style={{
            padding: '1rem',
            borderTop: '1px solid #ddd',
            display: 'flex',
            gap: '0.5rem'
          }}>
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
        </div>
      )}
    </>
  );
};

export default ChatPanel;