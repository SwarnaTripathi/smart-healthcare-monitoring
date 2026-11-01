import { io } from 'socket.io-client';

// Create socket in disconnected state — we'll connect manually after auth
const socket = io('/', {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 20,
});

/**
 * Call this after a successful login or on app startup if a token exists.
 * Connects the socket (or reconnects it) and emits join-rooms with the JWT.
 */
export function connectSocket() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // If already connected, just re-emit join-rooms (e.g. after token refresh)
  if (socket.connected) {
    socket.emit('join-rooms', { token });
    return;
  }

  // Once connected, authenticate immediately
  socket.once('connect', () => {
    socket.emit('join-rooms', { token: localStorage.getItem('token') });
  });

  socket.connect();
}

/**
 * Call this on logout to cleanly close the socket.
 */
export function disconnectSocket() {
  socket.disconnect();
}

// Re-authenticate on every reconnect attempt (e.g. after network blip)
socket.on('reconnect', () => {
  const token = localStorage.getItem('token');
  if (token) socket.emit('join-rooms', { token });
});

export default socket;
