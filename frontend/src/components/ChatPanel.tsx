import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { apiService } from '../services/api';

interface Message {
  id: string;
  message: string;
  createdAt: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [projectId]);

  useEffect(() => {
    if (socket && projectId) {
      socket.emit('join-project-chat', projectId);

      socket.on('new-chat-message', (message: Message) => {
        setMessages(prev => [...prev, message]);
      });

      return () => {
        socket.off('new-chat-message');
      };
    }
  }, [socket, projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await apiService.getProjectMessages(projectId);
      setMessages(data);
      console.log('Loaded messages:', data.length);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
      alert('Failed to send message. Check console for details.');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          zIndex: 999
        }}
      >
        💬
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
            {messages.map((msg) => {
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
            })}
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