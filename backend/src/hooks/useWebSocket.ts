import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export const useWebSocket = (documentId: string, userId: string, userName: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    socketRef.current = io(SOCKET_URL);

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      
      // Join the document room
      socket.emit('join-document', { documentId, userId, userName });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [documentId, userId, userName]);

  return socketRef.current;
};