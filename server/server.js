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
app.use(express.json());

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos/');
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/watchparty', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active socket connections
const activeConnections = new Map();

// Authentication middleware for socket
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
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
  console.log('User connected:', socket.userId, socket.user.username);
  
  activeConnections.set(socket.id, {
    userId: socket.userId,
    username: socket.user.username,
    roomId: null
  });

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
      
      const room = await Room.findOne({ roomId, isActive: true });
      
      if (!room) {
        if (actualCallback) actualCallback({ success: false, message: 'Room not found or inactive' });
        return;
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
        username: username
      });
      
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
      
      // Update room.users to match active connections (remove leaving user) using findOneAndUpdate to avoid version conflicts
      if (roomId) {
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
      }
      
      // Leave the socket room
      socket.leave(roomId);
      
      // Clear room from active connection
      if (connection) {
        connection.roomId = null;
      }
      
      // Notify others in the room
      socket.to(roomId).emit('user_left', {
        userId: socket.userId,
        username: socket.user.username
      });
      
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
      socketId: socket.id  // Also send socket.id for compatibility
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
      socketId: socket.id   // Also send socket.id for compatibility
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
    socket.to(data.roomId).emit('video_seek', {
      currentTime: data.currentTime,
      initiatedBy: socket.userId || socket.id
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

  socket.on('video_speed_change', (data) => {
    const userId = socket.userId || socket.id;
    console.log(`Speed change from ${userId} in room ${data.roomId} to ${data.speed}x`);
    
    // Broadcast to all users in room (except sender)
    socket.to(data.roomId).emit('video_speed_change', {
      speed: data.speed,
      initiatedBy: userId,
      socketId: socket.id
    });
  });

  socket.on('video_url_change', async (data) => {
    socket.to(data.roomId).emit('video_url_change', {
      videoUrl: data.videoUrl,
      videoTitle: data.videoTitle,
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
    
    // Notify other users in voice chat that a new user joined
    const voiceChatUsers = Array.from(global.voiceChatUsers.get(roomId));
    voiceChatUsers.forEach(userId => {
      if (userId !== socket.id) {
        io.to(userId).emit('new_user_joined_voice', {
          userId: socket.id,
          roomId
        });
      }
    });
  });
  
  socket.on('leave_voice_chat', (data) => {
    const connection = activeConnections.get(socket.id);
    const roomId = data.roomId || (connection ? connection.roomId : null);
    if (!roomId) return;
    
    // Remove user from voice chat users for this room
    if (global.voiceChatUsers.has(roomId)) {
      global.voiceChatUsers.get(roomId).delete(socket.id);
      
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

  // ============= Screen Sharing =============
  
  socket.on('start_screen_share', (data) => {
    console.log(`${socket.user.username} started screen sharing in room ${data.roomId}`);
    socket.to(data.roomId).emit('user_started_screen_share', {
      userId: socket.userId,
      username: socket.user.username
    });
  });

  socket.on('stop_screen_share', (data) => {
    console.log(`${socket.user.username} stopped screen sharing in room ${data.roomId}`);
    socket.to(data.roomId).emit('user_stopped_screen_share', {
      userId: socket.userId
    });
  });

  socket.on('screen_share_signal', (payload) => {
    io.to(payload.userToSignal).emit('screen_share_offer', {
      signal: payload.signal,
      callerID: payload.callerID
    });
  });

  socket.on('screen_share_return_signal', (payload) => {
    io.to(payload.callerID).emit('screen_share_answer', {
      signal: payload.signal,
      id: socket.id
    });
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
    console.log('User disconnected:', socket.userId);
    
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
      
      // Update room.users to match active connections (remove disconnected user) using findOneAndUpdate to avoid version conflicts
      if (connection.roomId) {
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
      }
      
      // Notify others
      socket.to(connection.roomId).emit('user_left', {
        userId: socket.userId,
        username: socket.user.username
      });
    }
    
    activeConnections.delete(socket.id);
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
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

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

// Video upload endpoint (host only)
app.post('/api/rooms/:roomId/upload-video', upload.single('video'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }
    
    // Find the room and verify user is host
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    if (room.host !== userId) {
      return res.status(403).json({ message: 'Only the host can upload videos' });
    }
    
    // Create video URL (use environment variable for production)
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const videoUrl = `${baseUrl}/uploads/videos/${req.file.filename}`;
    const videoTitle = req.file.originalname;
    
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
    
    console.log(`Video uploaded for room ${roomId}: ${videoTitle}`);
    
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
    res.status(500).json({ message: 'Upload failed' });
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
