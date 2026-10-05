import { io } from 'socket.io-client';
import { session } from './session';
import { refreshAccessToken } from './axios';

let socket;
export const getSocket = () => {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000', {
      autoConnect: false,
      auth: (callback) => callback({ token: session.getAccessToken() }),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 5000,
    });
    let refreshingAfterAuthFailure = false;
    socket.on('connect_error', (error) => {
      if (!/authentication required|invalid or expired access token|user not found/i.test(error.message) || refreshingAfterAuthFailure) return;
      refreshingAfterAuthFailure = true;
      refreshAccessToken().then(() => {
        refreshingAfterAuthFailure = false;
        socket.connect();
      }).catch(() => {
        refreshingAfterAuthFailure = false;
        session.expire();
      });
    });
  }
  return socket;
};
export const disconnectSocket = () => { socket?.disconnect(); };
