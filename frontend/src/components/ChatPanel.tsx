import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { apiService } from '../services/api';

type ClientSocket = ReturnType<typeof io>;

interface Message {
  id: string;
  message: string;
  createdAt: string;
  readBy: string[];
  isPinned?: boolean;
  audioData?: string;
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
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; message: string; userName: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiService.getProjectMessages(projectId);
      setMessages(data);
      setPinnedMessages(data.filter((m: Message) => m.isPinned));
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
      setPinnedMessages(prev => prev.filter(m => m.id !== data.messageId));
    };

    const handlePinMessage = (data: { messageId: string; isPinned: boolean }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, isPinned: data.isPinned } : m
      ));
      if (data.isPinned) {
        const msg = messages.find(m => m.id === data.messageId);
        if (msg) setPinnedMessages(prev => [...prev, { ...msg, isPinned: true }]);
      } else {
        setPinnedMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
    };

    socket.emit('join-project-chat', projectId);
    socket.on('new-chat-message', handleNewMessage);
    socket.on('delete-chat-message', handleDeleteMessage);
    socket.on('pin-chat-message', handlePinMessage);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
      socket.off('delete-chat-message', handleDeleteMessage);
      socket.off('pin-chat-message', handlePinMessage);
    };
  }, [socket, projectId, isOpen, currentUserId, messages]);

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
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));

      if (socket) {
        socket.emit('delete-chat-message', { projectId, messageId });
      }

      setShowContextMenu(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return;

      const newPinnedState = !msg.isPinned;
      await apiService.pinChatMessage(messageId, newPinnedState);

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isPinned: newPinnedState } : m
      ));

      if (newPinnedState) {
        setPinnedMessages(prev => [...prev, { ...msg, isPinned: true }]);
      } else {
        setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
      }

      if (socket) {
        socket.emit('pin-chat-message', { projectId, messageId, isPinned: newPinnedState });
      }

      setShowContextMenu(null);
    } catch (error) {
      console.error('Failed to pin message:', error);
      alert('Failed to pin message');
    }
  };

  const handleCopyMessage = (message: string) => {
    navigator.clipboard.writeText(message);
    setShowContextMenu(null);
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

  const base64ToBlob = (base64: string) => {
  const parts = base64.split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid base64 audio format");
  }

  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  if (!mimeMatch) {
    throw new Error("Invalid base64 MIME header");
  }

  const mime = mimeMatch[1];
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  return new Blob([array], { type: mime });
};
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const pickMimeType = () => {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          return "audio/webm;codecs=opus";
        }
        if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          return "audio/ogg;codecs=opus";
        }
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          return "audio/mp4";
        }
        return "";
      };

      const mimeType = pickMimeType();

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      console.log("Recording with mimeType:", mimeType);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type);
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
      alert('Microphone access denied or not available');
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
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        console.log('Base64 audio length:', base64Audio.length);
        console.log('Audio data starts with:', base64Audio.substring(0, 50));

        const message = await apiService.sendChatMessage({
          projectId,
          message: '🎤 Voice message',
          audioData: base64Audio
        });

        console.log('Voice message sent:', message);

        if (socket) {
          socket.emit('send-chat-message', { projectId, message });
        }
      };
      reader.onerror = (error) => {
        console.error('Failed to read audio blob:', error);
        alert('Failed to process voice message');
      };
    } catch (error) {
      console.error('Failed to send voice message:', error);
      alert('Failed to send voice message');
    }
  };

  const playAudio = (messageId: string, audioData: string) => {
    // Stop currently playing audio
    if (playingAudio && playingAudio !== messageId) {
      const prevAudio = audioRefs.current.get(playingAudio);
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
    }

    let audio = audioRefs.current.get(messageId);

    if (!audio) {
      const blob = base64ToBlob(audioData);
      const url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.volume = 1.0; // Set volume to maximum
      audioRefs.current.set(messageId, audio);

      audio.onended = () => {
        setPlayingAudio(null);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        alert('Failed to play audio. The audio format may be unsupported.');
        setPlayingAudio(null);
      };

      audio.onloadeddata = () => {
        console.log('Audio loaded successfully');
      };
    }

    if (playingAudio === messageId) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingAudio(null);
    } else {
      audio.play()
        .then(() => {
          console.log('Audio playing');
          setPlayingAudio(messageId);
        })
        .catch((error) => {
          console.error('Play failed:', error);
          alert('Failed to play audio: ' + error.message);
          setPlayingAudio(null);
        });
    }
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.animation = 'highlight 1s ease-in-out';
      setTimeout(() => {
        element.style.animation = '';
      }, 1000);
    }
    setShowPinnedPanel(false);
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

  const findOriginalMessage = (replyToId: string) => {
    return messages.find(m => m.id === replyToId);
  };

  return (
    <>
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {pinnedMessages.length > 0 && (
                <button
                  onClick={() => setShowPinnedPanel(!showPinnedPanel)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="View pinned messages"
                >
                  📌 {pinnedMessages.length}
                </button>
              )}
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
          </div>

          {showPinnedPanel && pinnedMessages.length > 0 && (
            <div style={{
              background: '#fff9e6',
              borderBottom: '2px solid #ffd700',
              maxHeight: '150px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: '#666',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>PINNED MESSAGES</span>
                <button
                  onClick={() => setShowPinnedPanel(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>
              {pinnedMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => scrollToMessage(msg.id)}
                  style={{
                    background: 'white',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    border: '1px solid #ffd700',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#667eea', marginBottom: '0.25rem' }}>
                    {msg.user.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                const originalReplyMsg = msg.replyTo ? findOriginalMessage(msg.replyTo.id) : null;

                return (
                  <div
                    id={`msg-${msg.id}`}
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

                      {msg.replyTo && (
                        <div
                          onClick={() => scrollToMessage(msg.replyTo!.id)}
                          style={{
                            background: 'rgba(0,0,0,0.1)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            marginBottom: '0.3rem',
                            fontSize: '0.75rem',
                            borderLeft: '2px solid #667eea',
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.15)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
                        >
                          <div style={{ fontWeight: 'bold', marginBottom: '0.1rem', color: '#667eea' }}>
                            ↩️ {msg.replyTo.userName}
                          </div>
                          <div style={{ opacity: 0.8 }}>
                            {originalReplyMsg ? originalReplyMsg.message : msg.replyTo.message}
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
                        {msg.isPinned && (
                          <div style={{
                            position: 'absolute',
                            top: '-8px',
                            right: isOwnMessage ? 'auto' : '-8px',
                            left: isOwnMessage ? '-8px' : 'auto',
                            background: '#ffd700',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}>
                            📌
                          </div>
                        )}

                        {msg.message.includes('🎤 Voice message') || msg.audioData ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (msg.audioData) {
                                  playAudio(msg.id, msg.audioData);
                                } else {
                                  alert('Audio data not available');
                                }
                              }}
                              style={{
                                background: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(102,126,234,0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                color: isOwnMessage ? 'white' : '#667eea',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = isOwnMessage ? 'rgba(255,255,255,0.3)' : 'rgba(102,126,234,0.3)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(102,126,234,0.2)';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              title={msg.audioData ? 'Play voice message' : 'Audio not available'}
                            >
                              {playingAudio === msg.id ? '⏸️' : '▶️'}
                            </button>
                            <span style={{ fontSize: '0.9rem' }}>🎤 Voice message</span>
                          </div>
                        ) : (
                          msg.message
                        )}

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
                  cursor: 'pointer',
                  fontSize: '0.9rem'
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
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Send
              </button>
            </div>
          )}

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
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#5568d3';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#667eea';
                  e.currentTarget.style.transform = 'scale(1)';
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
                  outline: 'none',
                  fontSize: '0.9rem'
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
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (newMessage.trim()) {
                    e.currentTarget.style.background = '#5568d3';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (newMessage.trim()) {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                ➤
              </button>
            </form>
          )}
        </div>
      )}

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
            minWidth: '150px',
            border: '1px solid #e0e0e0'
          }}
        >
          <button
            onClick={() => handlePinMessage(showContextMenu.messageId)}
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
              fontSize: '0.9rem',
              color: '#333'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📌 {messages.find(m => m.id === showContextMenu.messageId)?.isPinned ? 'Unpin' : 'Pin'}
          </button>
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
              fontSize: '0.9rem',
              color: '#333'
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
              fontSize: '0.9rem',
              color: '#333'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📋 Copy
          </button>
          {messages.find(m => m.id === showContextMenu.messageId)?.user.id === currentUserId && (
            <>
              <div style={{ height: '1px', background: '#e0e0e0', margin: '0.25rem 0' }} />
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
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244,67,54,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                🗑️ Delete
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes highlight {
          0%, 100% { background: transparent; }
          50% { background: rgba(255, 215, 0, 0.3); }
        }
      `}</style>
    </>
  );
};

export default ChatPanel;