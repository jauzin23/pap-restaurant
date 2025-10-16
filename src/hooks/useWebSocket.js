import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAuthToken } from '../lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      console.warn('⚠️ No auth token - WebSocket not initialized');
      return;
    }

    // Create socket connection with optimized settings
    const newSocket = io(API_BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000, // Exponential backoff max
      reconnectionAttempts: 10, // Increased attempts
      timeout: 10000, // Connection timeout
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      upgrade: true, // Allow transport upgrade
      rememberUpgrade: true, // Remember successful upgrades
    });

    socketRef.current = newSocket;

    // Connection established
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      setReconnecting(false);
    });

    // Connection lost
    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnected(false);
    });

    // Connection error
    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      setConnected(false);
      setReconnecting(true);
    });

    // Reconnecting
    newSocket.on('reconnect_attempt', () => {
      console.log('🔄 WebSocket reconnecting...');
      setReconnecting(true);
    });

    // Reconnected
    newSocket.on('reconnect', () => {
      console.log('✅ WebSocket reconnected');
      setConnected(true);
      setReconnecting(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🔌 WebSocket disconnecting...');
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return { socket, connected, reconnecting };
};
