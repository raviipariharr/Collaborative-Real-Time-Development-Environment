import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

interface UseWebSocketProps {
  documentId: string;
  userId: string;
  userName: string;
  onCodeUpdate?: (data: { code: string; userId: string }) => void;
  onUserJoined?: (data: { userId: string; userName: string; socketId: string }) => void;
  onUserLeft?: (data: { socketId: string }) => void;
}

export const useWebSocket = ({
  documentId,
  userId,
  userName,
  onCodeUpdate,
  onUserJoined,
  onUserLeft
}: UseWebSocketProps) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      socket.emit('join-document', { documentId, userId, userName });
    });

    if (onCodeUpdate) {
      socket.on('code-update', onCodeUpdate);
    }

    if (onUserJoined) {
      socket.on('user-joined', onUserJoined);
    }

    if (onUserLeft) {
      socket.on('user-left', onUserLeft);
    }

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [documentId, userId, userName, onCodeUpdate, onUserJoined, onUserLeft]);

  const emitCodeChange = (code: string) => {
    if (socketRef.current) {
      socketRef.current.emit('code-change', { documentId, code, userId });
    }
  };

  return { socket: socketRef.current, emitCodeChange };
};