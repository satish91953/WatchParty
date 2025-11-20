require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import models
const Room = require('./models/Room');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// Middleware
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
app.use(cors({
  origin: CLIENT_URL,
  methods: ["GET", "POST"],
  credentials: true
}));
// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = 'uploads/videos';
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// Serve uploaded videos
app.use('/uploads', express.static('uploads'));

// Connect to MongoDB with connection pooling for scalability
const mongoOptions = {
  maxPoolSize: 50, // Maximum number of connections in the pool
  minPoolSize: 5, // Minimum number of connections
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server
  socketTimeoutMS: 45000, // How long to wait for a socket
  retryWrites: true,
  retryReads: true
};

// Mongoose-specific options (set separately)
mongoose.set('bufferCommands', false);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/watchparty', mongoOptions).then(() => {
  console.log('Connected to MongoDB');
  console.log(`MongoDB connection pool: min=${mongoOptions.minPoolSize}, max=${mongoOptions.maxPoolSize}`);
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit on connection failure
});

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  // Performance optimizations for scalability
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e6, // 1MB max message size
  transports: ['websocket', 'polling'], // Prefer websocket
  allowEIO3: true, // Allow Engine.IO v3 clients
  // Connection limits
  connectTimeout: 45000,
  // Compression
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    threshold: 1024 // Only compress messages larger than 1KB
  }
});

// Rate limiting: Track requests per socket
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // Max 100 requests per minute per socket

function checkRateLimit(socketId) {
  const now = Date.now();
  const record = rateLimitMap.get(socketId);
  
  if (!record) {
    rateLimitMap.set(socketId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [socketId, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(socketId);
    }
  }
}, RATE_LIMIT_WINDOW);

// Store active socket connections with automatic cleanup
const activeConnections = new Map();
const MAX_CONNECTIONS = 5000; // Maximum concurrent connections

// Store pending room deletions (for grace period on page refresh)
const pendingRoomDeletions = new Map();

// Connection tracking for monitoring
let totalConnections = 0;
let activeConnectionsCount = 0;

// Cleanup function for connection tracking
function cleanupConnection(socketId) {
  if (activeConnections.has(socketId)) {
    activeConnections.delete(socketId);
    activeConnectionsCount = activeConnections.size;
    rateLimitMap.delete(socketId);
  }
}

// Periodic cleanup of stale connections (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  // Clean up rate limit map
  for (const [socketId, record] of rateLimitMap.entries()) {
    if (now > record.resetTime + RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(socketId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} stale rate limit records`);
  }
}, 5 * 60 * 1000);

// Authentication middleware for socket with rate limiting
io.use(async (socket, next) => {
  // Check connection limit
  if (activeConnections.size >= MAX_CONNECTIONS) {
    console.warn(`Connection limit reached: ${MAX_CONNECTIONS}`);
    return next(new Error('Server at capacity. Please try again later.'));
  }
  
  // Check rate limit
  if (!checkRateLimit(socket.id)) {
    console.warn(`Rate limit exceeded for socket: ${socket.id}`);
    return next(new Error('Too many requests. Please slow down.'));
  }
  
  try {
    const token = socket.handshake.auth.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        throw new Error('User not found');
      }
      socket.userId = user._id.toString();
      socket.user = user;
    } else {
      // Allow anonymous users with temporary ID
      socket.userId = socket.id;
      socket.user = { username: `Guest-${socket.id.substring(0, 6)}` };
    }
    next();
  } catch (err) {
    socket.userId = socket.id;
    socket.user = { username: `Guest-${socket.id.substring(0, 6)}` };
    next();
  }
});

io.on('connection', (socket) => {
  totalConnections++;
  activeConnectionsCount = activeConnections.size + 1;
  
  console.log(`User connected: ${socket.userId} (${socket.user.username}) [Total: ${totalConnections}, Active: ${activeConnectionsCount}]`);
  
  // Track connection metadata
  const connectionData = {
    userId: socket.userId,
    username: socket.user.username,
    roomId: null,
    connectedAt: Date.now(),
    lastActivity: Date.now()
  };
  
  activeConnections.set(socket.id, connectionData);

  // ============= Room Management =============
  
  socket.on('create_room', async (data, callback) => {
    try {
      const roomId = generateRoomId();
      
      // Require a username
      let username = data.username || '';
      
      // Reject if username is empty or still has "Guest-" prefix
      if (!username || username.trim() === '' || username.startsWith('Guest-')) {
        callback({ 
          success: false, 
          message: 'Please provide your name before creating a room' 
        });
        return;
      }
      
      username = username.trim();
      
      // Update active connection with the username
      if (activeConnections.has(socket.id)) {
        activeConnections.get(socket.id).username = username;
      }
      
      // Create room in database
      const room = new Room({
        roomId,
        name: data.roomName || 'Untitled Room',
        host: socket.userId,
        isPrivate: data.isPrivate || false,
        password: data.isPrivate && data.password ? data.password.trim() : null,
        users: [{
          userId: socket.userId,
          username: username,
          isHost: true,
          hasVideo: false,
          hasAudio: false
        }]
      });
      
      await room.save();
      
      socket.join(roomId);
      activeConnections.get(socket.id).roomId = roomId;
      
      // Get currently active users (should only be the creator)
      const activeUsersInRoom = Array.from(activeConnections.values())
        .filter(conn => conn.roomId === roomId)
        .map(conn => ({
          userId: conn.userId,
          username: conn.username
        }));
      
      // Return room with only active users
      const roomData = room.toObject();
      roomData.users = activeUsersInRoom;
      
      console.log(`Room ${roomId} created by ${username}`);
      callback({ 
        success: true, 
        roomId,
        room: roomData
      });
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ success: false, message: 'Failed to create room' });
    }
  });

  socket.on('join_room', async (roomId, data, callback) => {
    try {
      // Handle both old format (roomId, callback) and new format (roomId, {username}, callback)
      let username, actualCallback;
      if (typeof data === 'function') {
        // Old format: (roomId, callback) - reject it, require username
        actualCallback = data;
        if (actualCallback) {
          actualCallback({ 
            success: false, 
            message: 'Please provide your name before joining the room' 
          });
        }
        return;
      } else {
        // New format: (roomId, {username}, callback)
        username = data?.username || '';
        actualCallback = callback;
      }
      
      // Require a username - reject if empty or still has "Guest-" prefix
      if (!username || username.trim() === '' || username.startsWith('Guest-')) {
        if (actualCallback) {
          actualCallback({ 
            success: false, 
            message: 'Please provide your name before joining the room' 
          });
        }
        return;
      }
      
      username = username.trim();
      
      // Cancel any pending deletion for this room (user is reconnecting)
      if (pendingRoomDeletions.has(roomId)) {
        clearTimeout(pendingRoomDeletions.get(roomId));
        pendingRoomDeletions.delete(roomId);
        console.log(`Cancelled pending deletion for room ${roomId} - user reconnecting`);
      }
      
      const room = await Room.findOne({ roomId, isActive: true });
      
      if (!room) {
        if (actualCallback) actualCallback({ 
          success: false, 
          message: 'Room not found. This room may have been closed or deleted because all users left.' 
        });
        return;
      }
      
      // Check if room is private and verify password
      if (room.isPrivate) {
        const providedPassword = data?.password || '';
        if (!providedPassword || providedPassword.trim() !== room.password) {
          if (actualCallback) actualCallback({ 
            success: false, 
            message: 'Incorrect password. This is a private room.' 
          });
          return;
        }
      }
      
      // Update active connection with the username
      if (activeConnections.has(socket.id)) {
        activeConnections.get(socket.id).username = username;
      }
      
      socket.join(roomId);
      activeConnections.get(socket.id).roomId = roomId;
      
      // Get currently active users in this room from activeConnections
      const activeUsersInRoom = Array.from(activeConnections.values())
        .filter(conn => conn.roomId === roomId)
        .map(conn => ({
          userId: conn.userId,
          username: conn.username
        }));
      
      // Update room.users to match active connections using findOneAndUpdate to avoid version conflicts
      await Room.findOneAndUpdate(
        { roomId },
        {
          $set: {
            users: activeUsersInRoom.map(user => ({
              userId: user.userId,
              username: user.username,
              isHost: user.userId === room.host,
              hasVideo: false,
              hasAudio: false
            }))
          }
        },
        { new: true } // Return updated document
      );
      
      // Fetch the updated room for response
      const updatedRoom = await Room.findOne({ roomId });
      
      // Notify existing users
      socket.to(roomId).emit('user_joined', {
        userId: socket.userId,
        socketId: socket.id, // Include socket.id for voice chat matching
        username: username
      });
      
      // Send current video state to the newly joined user
      if (updatedRoom && updatedRoom.currentVideo && updatedRoom.currentVideo.url) {
        const currentState = {
          videoUrl: updatedRoom.currentVideo.url,
          videoTitle: updatedRoom.currentVideo.title || 'Video',
          currentTime: updatedRoom.currentVideo.currentTime || 0,
          isPlaying: updatedRoom.currentVideo.isPlaying || false,
          playbackSpeed: updatedRoom.currentVideo.playbackSpeed || 1.0,
          lastUpdated: updatedRoom.currentVideo.lastUpdated || Date.now()
        };
        
        // Send sync state to new user after a short delay to ensure their player is ready
        setTimeout(() => {
          socket.emit('video_sync_state', {
            roomId,
            ...currentState,
            initiatedBy: 'server',
            isInitialSync: true
          });
        }, 1000);
      }
      
      // Return room with only active users
      const roomData = updatedRoom ? updatedRoom.toObject() : room.toObject();
      roomData.users = activeUsersInRoom;
      
      if (actualCallback) {
        actualCallback({ 
          success: true, 
          room: roomData
        });
      }
      
      console.log(`User ${username} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      if (typeof data === 'function') {
        data({ success: false, message: 'Failed to join room' });
      } else if (callback) {
        callback({ success: false, message: 'Failed to join room' });
      }
    }
  });

  socket.on('leave_room', async (data) => {
    try {
      const connection = activeConnections.get(socket.id);
      const roomId = data?.roomId || (connection ? connection.roomId : null);
      
      if (!roomId) {
        console.warn(`User ${socket.userId} tried to leave but no roomId found`);
        return;
      }
      
      // Remove user from voice chat users
      if (global.voiceChatUsers && global.voiceChatUsers.has(roomId)) {
        global.voiceChatUsers.get(roomId).delete(socket.id);
        if (global.voiceChatUsers.get(roomId).size === 0) {
          global.voiceChatUsers.delete(roomId);
        }
      }
      
      // Get currently active users in this room (excluding the leaving user)
      const activeUsersInRoom = Array.from(activeConnections.values())
        .filter(conn => conn.roomId === roomId && conn.userId !== socket.userId)
        .map(conn => ({
          userId: conn.userId,
          username: conn.username
        }));
      
      // If this is the last user leaving, schedule deletion with grace period (for page refresh)
      if (activeUsersInRoom.length === 0) {
        const room = await Room.findOne({ roomId });
        if (room) {
          // Cancel any pending deletion for this room
          if (pendingRoomDeletions.has(roomId)) {
            clearTimeout(pendingRoomDeletions.get(roomId));
            pendingRoomDeletions.delete(roomId);
            console.log(`Cancelled pending deletion for room ${roomId} - user is leaving explicitly`);
          }
          
          // Delete immediately if user explicitly left (not a disconnect)
          await Room.deleteOne({ roomId });
          console.log(`Room ${roomId} deleted - last user left`);
          
          // Notify all sockets in the room that the room was deleted
          io.to(roomId).emit('room_deleted', {
            roomId,
            message: 'Room deleted - all users have left'
          });
        }
      } else {
        // Update room.users to match active connections (remove leaving user) using findOneAndUpdate to avoid version conflicts
        const room = await Room.findOne({ roomId });
        if (room) {
          await Room.findOneAndUpdate(
            { roomId },
            {
              $set: {
                users: activeUsersInRoom.map(user => ({
                  userId: user.userId,
                  username: user.username,
                  isHost: user.userId === room.host,
                  hasVideo: false,
                  hasAudio: false
                }))
              }
            }
          );
        }
        
        // Notify others in the room
        socket.to(roomId).emit('user_left', {
          userId: socket.userId,
          username: socket.user.username
        });
      }
      
      // Leave the socket room
      socket.leave(roomId);
      
      // Clear room from active connection
      if (connection) {
        connection.roomId = null;
      }
      
      console.log(`User ${socket.user.username} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // ============= Video Synchronization =============
  
  socket.on('video_play', async (data) => {
    const userId = socket.userId || socket.id;
    console.log(`Play event from ${userId} (socket.id: ${socket.id}) in room ${data.roomId} at time ${data.currentTime}`);
    
    // Broadcast to all users in room (except sender)
    socket.to(data.roomId).emit('video_play', {
      currentTime: data.currentTime,
      initiatedBy: userId, // Use consistent ID
      socketId: socket.id,  // Also send socket.id for compatibility
      eventId: data.eventId || Date.now(), // Include eventId for deduplication
      timestamp: data.timestamp || Date.now() // Include timestamp for deduplication
    });
    
    // Update room state in database
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        'currentVideo.isPlaying': true,
        'currentVideo.currentTime': data.currentTime,
        'currentVideo.lastUpdated': Date.now()
      }
    );
  });

  socket.on('video_pause', async (data) => {
    const userId = socket.userId || socket.id;
    console.log(`Pause event from ${userId} (socket.id: ${socket.id}) in room ${data.roomId} at time ${data.currentTime}`);
    
    // Broadcast to all users in room (except sender)
    socket.to(data.roomId).emit('video_pause', {
      currentTime: data.currentTime,
      initiatedBy: userId, // Use consistent ID
      socketId: socket.id,   // Also send socket.id for compatibility
      eventId: data.eventId || Date.now(), // Include eventId for deduplication
      timestamp: data.timestamp || Date.now() // Include timestamp for deduplication
    });
    
    // Also log for debugging
    const room = await Room.findOne({ roomId: data.roomId });
    if (room) {
      console.log(`Room ${data.roomId} has ${room.users.length} users`);
    }
    
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        'currentVideo.isPlaying': false,
        'currentVideo.currentTime': data.currentTime,
        'currentVideo.lastUpdated': Date.now()
      }
    );
  });

  socket.on('video_seek', async (data) => {
    const userId = socket.userId || socket.id;
    socket.to(data.roomId).emit('video_seek', {
      currentTime: data.currentTime,
      initiatedBy: userId,
      socketId: socket.id, // Include socket.id for compatibility
      eventId: data.eventId || Date.now(), // Include eventId for deduplication
      timestamp: data.timestamp || Date.now() // Include timestamp for deduplication
    });
    
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        'currentVideo.currentTime': data.currentTime,
        'currentVideo.lastUpdated': Date.now()
      }
    );
  });

  // ============= Room Timer =============
  
  socket.on('room_timer_start', (data) => {
    console.log(`Timer started in room ${data.roomId} for ${data.seconds} seconds`);
    // Broadcast to all users in room (including sender for sync)
    io.to(data.roomId).emit('room_timer_start', {
      seconds: data.seconds
    });
  });

  socket.on('room_timer_stop', (data) => {
    console.log(`Timer stopped in room ${data.roomId}`);
    // Broadcast to all users in room
    io.to(data.roomId).emit('room_timer_stop');
  });

  socket.on('video_speed_change', async (data) => {
    const userId = socket.userId || socket.id;
    console.log(`Speed change from ${userId} in room ${data.roomId} to ${data.speed}x`);
    
    // Broadcast to all users in room (except sender)
    socket.to(data.roomId).emit('video_speed_change', {
      speed: data.speed,
      initiatedBy: userId,
      socketId: socket.id
    });
    
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        'currentVideo.playbackSpeed': data.speed,
        'currentVideo.lastUpdated': Date.now()
      }
    );
  });

  // Request current video state (for new users or re-sync)
  socket.on('request_video_state', async (data) => {
    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (room && room.currentVideo && room.currentVideo.url) {
        const currentState = {
          videoUrl: room.currentVideo.url,
          videoTitle: room.currentVideo.title || 'Video',
          currentTime: room.currentVideo.currentTime || 0,
          isPlaying: room.currentVideo.isPlaying || false,
          playbackSpeed: room.currentVideo.playbackSpeed || 1.0,
          lastUpdated: room.currentVideo.lastUpdated || Date.now()
        };
        
        socket.emit('video_sync_state', {
          roomId: data.roomId,
          ...currentState,
          initiatedBy: 'server',
          isInitialSync: true
        });
      }
    } catch (error) {
      console.error('Error sending video state:', error);
    }
  });

  socket.on('video_url_change', async (data) => {
    socket.to(data.roomId).emit('video_url_change', {
      videoUrl: data.videoUrl,
      videoTitle: data.videoTitle,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      isBlobUrl: data.isBlobUrl,
      uploadedBy: data.uploadedBy || socket.userId,
      initiatedBy: socket.userId
    });
    
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        'currentVideo.url': data.videoUrl,
        'currentVideo.title': data.videoTitle,
        'currentVideo.currentTime': 0,
        'currentVideo.lastUpdated': Date.now()
      }
    );
  });

  // Handle video file sharing (browser-only, no server storage)
  socket.on('video_file_shared', (data) => {
    socket.to(data.roomId).emit('video_file_shared', {
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      uploadedBy: data.uploadedBy || socket.userId
    });
  });

  // ============= WebRTC Signaling =============
  
  // Track users in voice chat per room
  if (!global.voiceChatUsers) {
    global.voiceChatUsers = new Map(); // roomId -> Set of userIds
  }
  
  socket.on('join_voice_chat', (data) => {
    const connection = activeConnections.get(socket.id);
    const roomId = data.roomId || (connection ? connection.roomId : null);
    if (!roomId) {
      console.warn(`User ${socket.id} tried to join voice chat but no roomId found`);
      return;
    }
    
    // Add user to voice chat users for this room
    if (!global.voiceChatUsers.has(roomId)) {
      global.voiceChatUsers.set(roomId, new Set());
    }
    global.voiceChatUsers.get(roomId).add(socket.id);
    
    console.log(`User ${socket.id} joined voice chat in room ${roomId}`);
    
    // Get list of existing voice chat users (excluding the joining user)
    const voiceChatUsers = Array.from(global.voiceChatUsers.get(roomId));
    const existingUsers = voiceChatUsers.filter(userId => userId !== socket.id);
    
    // Notify other users in voice chat that a new user joined
    // This allows existing users to create peer connections to the new user
    // The new user will receive signals from existing users via 'user_joined_voice' event
    existingUsers.forEach(userId => {
      io.to(userId).emit('new_user_joined_voice', {
        userId: socket.id,
        roomId
      });
    });
  });
  
  socket.on('leave_voice_chat', (data) => {
    const connection = activeConnections.get(socket.id);
    const roomId = data.roomId || (connection ? connection.roomId : null);
    if (!roomId) return;
    
    // Remove user from voice chat users for this room
    if (global.voiceChatUsers.has(roomId)) {
      global.voiceChatUsers.get(roomId).delete(socket.id);
      
      // Notify other users in voice chat that this user left
      const voiceChatUsers = Array.from(global.voiceChatUsers.get(roomId));
      voiceChatUsers.forEach(userId => {
        io.to(userId).emit('user_left_voice', {
          userId: socket.id,
          roomId
        });
      });
      
      // If no users left in voice chat, remove the room entry
      if (global.voiceChatUsers.get(roomId).size === 0) {
        global.voiceChatUsers.delete(roomId);
      }
    }
    
    console.log(`User ${socket.id} left voice chat in room ${roomId}`);
  });
  
  socket.on('sending_signal', (payload) => {
    io.to(payload.userToSignal).emit('user_joined_voice', {
      signal: payload.signal,
      callerID: payload.callerID,
      hasVideo: payload.hasVideo || false
    });
  });

  socket.on('returning_signal', (payload) => {
    io.to(payload.callerID).emit('receiving_returned_signal', {
      signal: payload.signal,
      id: socket.id,
      hasVideo: payload.hasVideo || false
    });
  });

  // Handle signal retry requests (when peer connection fails)
  socket.on('request_voice_signal', (payload) => {
    const connection = activeConnections.get(socket.id);
    const roomId = payload.roomId || (connection ? connection.roomId : null);
    if (!roomId) return;
    
    // Check if requested user is in voice chat
    if (global.voiceChatUsers.has(roomId) && 
        global.voiceChatUsers.get(roomId).has(payload.userId)) {
      // Notify the requested user to send their signal again
      io.to(payload.userId).emit('retry_voice_connection', {
        requestingUserId: socket.id,
        roomId
      });
    }
  });

  // Handle request for existing voice signals (when a new user joins)
  socket.on('request_existing_voice_signals', (data) => {
    const connection = activeConnections.get(socket.id);
    const roomId = data.roomId || (connection ? connection.roomId : null);
    if (!roomId) return;
    
    // Get all existing voice chat users (excluding the requesting user)
    if (global.voiceChatUsers.has(roomId)) {
      const voiceChatUsers = Array.from(global.voiceChatUsers.get(roomId));
      const existingUsers = voiceChatUsers.filter(userId => userId !== socket.id);
      
      // Notify each existing user to send their signal to the new user
      existingUsers.forEach(existingUserId => {
        io.to(existingUserId).emit('send_signal_to_user', {
          targetUserId: socket.id,
          roomId
        });
      });
    }
  });

  // ============= Reactions =============
  
  socket.on('send_reaction', async (data) => {
    const reaction = {
      userId: socket.userId,
      username: socket.user.username,
      emoji: data.emoji,
      timestamp: Date.now()
    };
    
    // Broadcast to all users in room
    io.to(data.roomId).emit('reaction_received', reaction);
    
    // Save to database
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        $push: { 
          reactions: {
            userId: socket.userId,
            emoji: data.emoji,
            timestamp: Date.now()
          }
        }
      }
    );
  });

  // ============= Subtitles =============
  
  socket.on('subtitle_upload', async (data) => {
    console.log(`Subtitle uploaded for room ${data.roomId}`);
    
    socket.to(data.roomId).emit('subtitle_updated', {
      url: data.url,
      language: data.language,
      uploadedBy: socket.user.username
    });
    
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 
        'subtitles.url': data.url,
        'subtitles.language': data.language,
        'subtitles.offset': data.offset || 0
      }
    );
  });

  socket.on('subtitle_sync', async (data) => {
    socket.to(data.roomId).emit('subtitle_sync_update', {
      offset: data.offset
    });
    
    await Room.findOneAndUpdate(
      { roomId: data.roomId },
      { 'subtitles.offset': data.offset }
    );
  });

  // ============= Chat =============
  
  socket.on('chat_message', async (data) => {
    try {
      // Validate data
      if (!data || !data.roomId || !data.message || !data.message.trim()) {
        console.warn('Invalid chat message data:', data);
        return;
      }

      const connection = activeConnections.get(socket.id);
      const roomId = data.roomId || (connection ? connection.roomId : null);
      
      if (!roomId) {
        console.warn(`User ${socket.id} tried to send chat message but no roomId found`);
        return;
      }

      // Verify user is in the room
      const room = await Room.findOne({ roomId, isActive: true });
      if (!room) {
        console.warn(`Chat message sent to non-existent room: ${roomId}`);
        return;
      }

      // Get the actual username from activeConnections (not socket.user which might be "Guest-")
      const senderUsername = connection?.username || socket.user.username;
      
      // Make sure we don't use "Guest-" names
      if (!senderUsername || senderUsername.startsWith('Guest-')) {
        console.warn(`User ${socket.id} tried to send chat message but has invalid username: ${senderUsername}`);
        return;
      }

      const message = {
        sender: senderUsername,
        message: data.message.trim(),
        timestamp: Date.now()
      };
      
      // Broadcast to all users in the room (including sender for consistency)
      io.to(roomId).emit('chat_message', message);
      
      console.log(`Chat message from ${senderUsername} in room ${roomId}: ${data.message.substring(0, 50)}...`);
      
      // Save to database
      await Room.findOneAndUpdate(
        { roomId },
        { 
          $push: { 
            messages: {
              sender: senderUsername,
              message: data.message.trim(),
              timestamp: Date.now()
            }
          }
        }
      );
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  });

  // ============= Disconnect =============
  
  socket.on('disconnect', async () => {
    activeConnectionsCount = activeConnections.size - 1;
    console.log(`User disconnected: ${socket.userId} [Active: ${activeConnectionsCount}]`);
    
    const connection = activeConnections.get(socket.id);
    if (connection && connection.roomId) {
      // Remove user from voice chat users
      if (global.voiceChatUsers && global.voiceChatUsers.has(connection.roomId)) {
        global.voiceChatUsers.get(connection.roomId).delete(socket.id);
        if (global.voiceChatUsers.get(connection.roomId).size === 0) {
          global.voiceChatUsers.delete(connection.roomId);
        }
      }
      
      // Get currently active users in this room (excluding the disconnecting user)
      const activeUsersInRoom = Array.from(activeConnections.values())
        .filter(conn => conn.roomId === connection.roomId && conn.userId !== socket.userId)
        .map(conn => ({
          userId: conn.userId,
          username: conn.username
        }));
      
      // If this is the last user leaving, schedule deletion with grace period (for page refresh)
      if (activeUsersInRoom.length === 0) {
        const room = await Room.findOne({ roomId: connection.roomId });
        if (room) {
          // Cancel any existing pending deletion
          if (pendingRoomDeletions.has(connection.roomId)) {
            clearTimeout(pendingRoomDeletions.get(connection.roomId));
          }
          
          // Schedule deletion after 5 seconds (grace period for page refresh)
          const deletionTimeout = setTimeout(async () => {
            try {
              const roomStillExists = await Room.findOne({ roomId: connection.roomId });
              if (roomStillExists) {
                // Check if room is still empty
                const stillActiveUsers = Array.from(activeConnections.values())
                  .filter(conn => conn.roomId === connection.roomId)
                  .length;
                
                if (stillActiveUsers === 0) {
                  await Room.deleteOne({ roomId: connection.roomId });
                  console.log(`Room ${connection.roomId} deleted - grace period expired, no reconnection`);
                  
                  // Notify all sockets in the room that the room was deleted
                  io.to(connection.roomId).emit('room_deleted', {
                    roomId: connection.roomId,
                    message: 'Room deleted - all users have left'
                  });
                } else {
                  console.log(`Room ${connection.roomId} not deleted - user reconnected during grace period`);
                }
              }
            } catch (error) {
              console.error(`Error deleting room ${connection.roomId}:`, error);
            } finally {
              pendingRoomDeletions.delete(connection.roomId);
            }
          }, 5000); // 5 second grace period
          
          pendingRoomDeletions.set(connection.roomId, deletionTimeout);
          console.log(`Room ${connection.roomId} scheduled for deletion in 5 seconds (grace period for reconnection)`);
        }
      } else {
        // Update room.users to match active connections (remove disconnected user) using findOneAndUpdate to avoid version conflicts
        try {
          const room = await Room.findOne({ roomId: connection.roomId });
          if (room) {
            await Room.findOneAndUpdate(
              { roomId: connection.roomId },
              {
                $set: {
                  users: activeUsersInRoom.map(user => ({
                    userId: user.userId,
                    username: user.username,
                    isHost: user.userId === room.host,
                    hasVideo: false,
                    hasAudio: false
                  }))
                }
              }
            );
          }
          
          // Notify others
          socket.to(connection.roomId).emit('user_left', {
            userId: socket.userId,
            username: socket.user.username
          });
        } catch (error) {
          console.error(`Error updating room ${connection.roomId} on disconnect:`, error);
        }
      }
    }
    
    // Clean up connection tracking
    cleanupConnection(socket.id);
  });
});

// ============= REST API Endpoints =============

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Watch Party Server is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/',
      register: '/api/auth/register',
      login: '/api/auth/login',
      rooms: '/api/rooms/history'
    }
  });
});

app.get('/health', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const mongoState = mongoose.connection.readyState;
    const mongoStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      uptimeFormatted: formatUptime(process.uptime()),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB'
      },
      connections: {
        total: totalConnections || 0,
        active: activeConnectionsCount || activeConnections.size || 0,
        max: MAX_CONNECTIONS,
        percentage: Math.round(((activeConnectionsCount || activeConnections.size || 0) / MAX_CONNECTIONS) * 100)
      },
      mongodb: {
        status: mongoStates[mongoState] || 'unknown',
        readyState: mongoState,
        host: mongoose.connection.host || 'N/A',
        name: mongoose.connection.name || 'N/A'
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists' 
      });
    }
    
    // Create new user
    const user = new User({ username, email, password });
    await user.save();
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ 
      $or: [{ email: username }, { username }] 
    });
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid credentials' 
      });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Invalid credentials' 
      });
    }
    
    // Update last active
    user.lastActive = Date.now();
    await user.save();
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get room history
app.get('/api/rooms/history', async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true })
      .sort('-createdAt')
      .limit(10)
      .select('roomId name createdAt users');
    
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching room history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Video upload endpoint (anyone can upload)
app.post('/api/rooms/:roomId/upload-video', upload.single('video'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    console.log(`📤 Upload request for room ${roomId} from user ${userId}`);
    
    if (!req.file) {
      console.error('❌ No file in upload request');
      return res.status(400).json({ message: 'No video file provided' });
    }
    
    console.log(`📁 File received: ${req.file.originalname} (${(req.file.size / (1024 * 1024)).toFixed(2)} MB)`);
    
    // Find the room - anyone can upload videos
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Verify user is in the room (optional check - can be removed if not needed)
    const userInRoom = room.users && room.users.some(u => u.userId === userId);
    if (!userInRoom && room.host !== userId) {
      console.warn(`User ${userId} not found in room ${roomId}, but allowing upload anyway`);
    }
    
    // Create video URL (use environment variable for production)
    const baseUrl = process.env.BASE_URL || process.env.CLIENT_URL || 'http://localhost:5000';
    const videoUrl = `${baseUrl}/uploads/videos/${req.file.filename}`;
    const videoTitle = req.file.originalname;
    
    console.log(`🔗 Video URL created: ${videoUrl} (BASE_URL: ${baseUrl})`);
    
    // Get video format from filename
    const videoFormat = path.extname(req.file.originalname).toLowerCase().substring(1);
    
    // Update room with new video and add to library
    await Room.findOneAndUpdate(
      { roomId },
      {
        $set: {
          'currentVideo.url': videoUrl,
          'currentVideo.title': videoTitle,
          'currentVideo.filename': req.file.filename,
          'currentVideo.size': req.file.size,
          'currentVideo.format': videoFormat,
          'currentVideo.uploadedAt': Date.now(),
          'currentVideo.currentTime': 0,
          'currentVideo.isPlaying': false,
          'currentVideo.lastUpdated': Date.now()
        },
        $push: {
          videoLibrary: {
            url: videoUrl,
            title: videoTitle,
            filename: req.file.filename,
            size: req.file.size,
            format: videoFormat,
            uploadedAt: Date.now(),
            uploadedBy: userId
          }
        }
      }
    );
    
    console.log(`✅ Video uploaded successfully for room ${roomId}: ${videoTitle}`);
    console.log(`   File saved to: ${req.file.path}`);
    console.log(`   Video URL: ${videoUrl}`);
    
    // Notify all room members about the new video
    const videoData = {
      videoUrl,
      videoTitle,
      filename: req.file.filename,
      size: req.file.size,
      format: videoFormat,
      uploadedBy: userId
    };
    
    // Emit both events for backward compatibility
    io.to(roomId).emit('video_uploaded', videoData);
    io.to(roomId).emit('host_video_uploaded', videoData);
    
    res.json({
      success: true,
      video: {
        url: videoUrl,
        title: videoTitle,
        filename: req.file.filename,
        size: req.file.size
      }
    });
    
  } catch (error) {
    console.error('Video upload error:', error);
    
    // Clean up uploaded file if it exists but processing failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up failed upload file:', req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      message: 'Upload failed: ' + (error.message || 'Unknown error'),
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get room videos
app.get('/api/rooms/:roomId/videos', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId }).select('currentVideo videoLibrary host');
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Ensure currentVideo is in library (migration for old rooms)
    if (room.currentVideo?.url && room.currentVideo?.url !== '') {
      const videoInLibrary = room.videoLibrary?.some(v => v.url === room.currentVideo.url);
      
      if (!videoInLibrary && room.videoLibrary) {
        // Add current video to library if it's not there using findOneAndUpdate to avoid version conflicts
        await Room.findOneAndUpdate(
          { roomId },
          {
            $push: {
              videoLibrary: {
                url: room.currentVideo.url,
                title: room.currentVideo.title || 'Unknown Video',
                filename: room.currentVideo.filename || '',
                size: room.currentVideo.size || 0,
                format: room.currentVideo.format || 'mp4',
                uploadedAt: room.currentVideo.uploadedAt || Date.now(),
                uploadedBy: room.host
              }
            }
          }
        );
      }
    }
    
    res.json({ 
      currentVideo: room.currentVideo,
      library: room.videoLibrary || []
    });
  } catch (error) {
    console.error('Error fetching room videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Select video from library
app.post('/api/rooms/:roomId/select-video', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { videoUrl, userId } = req.body;
    
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Any user can select videos from the library
    // Find video in library (flexible matching for URL variations)
    let video = room.videoLibrary.find(v => v.url === videoUrl);
    
    // If exact match fails, try matching by filename or URL path
    if (!video) {
      const urlPath = videoUrl.split('/').pop(); // Get filename from URL
      video = room.videoLibrary.find(v => {
        const vPath = v.url.split('/').pop();
        return vPath === urlPath || v.filename === urlPath || v.url === videoUrl;
      });
    }
    
    if (!video) {
      console.error('Video not found in library:', {
        requestedUrl: videoUrl,
        librarySize: room.videoLibrary?.length || 0,
        libraryUrls: room.videoLibrary?.map(v => v.url) || []
      });
      return res.status(404).json({ 
        message: 'Video not found in library',
        debug: {
          requestedUrl: videoUrl,
          librarySize: room.videoLibrary?.length || 0
        }
      });
    }
    
    // Update current video
    await Room.findOneAndUpdate(
      { roomId },
      {
        $set: {
          'currentVideo.url': video.url,
          'currentVideo.title': video.title,
          'currentVideo.filename': video.filename,
          'currentVideo.size': video.size,
          'currentVideo.format': video.format,
          'currentVideo.currentTime': 0,
          'currentVideo.isPlaying': false,
          'currentVideo.lastUpdated': Date.now()
        }
      }
    );
    
    // Notify all room members
    io.to(roomId).emit('video_selected', {
      videoUrl: video.url,
      videoTitle: video.title,
      selectedBy: userId
    });
    
    res.json({ success: true, video });
  } catch (error) {
    console.error('Error selecting video:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Watch Party Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Serving React app from: ${path.join(__dirname, '../client/build')}`);
  }
});
