# 🎬 Watch Party Pro

A full-featured watch party application that allows you to watch videos together with friends in real-time. Built with React, Node.js, Socket.IO, and WebRTC.

## ✨ Features

- **🎬 Synchronized Video Playback** - Watch videos together in perfect sync
  - Support for MP4 videos and YouTube videos
  - Real-time play/pause/seek synchronization
  - Playback speed control (synced across all users)
  - Anyone can control playback
- **🎤 Voice Chat** - Crystal-clear WebRTC audio communication
  - Per-participant volume control
  - Mute/unmute functionality
  - Automatic reconnection on connection issues
- **👥 User Management** - See who's in your room
  - Real-time participant list
  - Host/Guest indicators
  - User status indicators
- **⏱️ Room Timer** - Countdown timer for coordinated viewing
  - Quick start options (1 min, 5 min, 10 min)
  - Visual countdown display
  - Synced across all room participants
- **🎭 Emoji Reactions** - Send floating emoji reactions during playback
- **🌓 Dark/Light Theme** - Toggle between themes
- **📱 Responsive Design** - Works on desktop and mobile
- **🔄 Room Persistence** - Rooms are saved in MongoDB
- **🎯 Easy Room Sharing** - Simple 6-character room codes
- **📁 Video Library** - Upload and manage multiple videos per room
- **🔗 URL Video Loading** - Load videos directly from URLs

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Modern web browser with WebRTC support

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd watch-party-app
   ```

2. **Set up the backend:**
   ```bash
   cd server
   npm install
   cp .env-example .env
   # Edit .env with your MongoDB URI and JWT secret
   ```

3. **Set up the frontend:**
   ```bash
   cd ../client
   npm install
   cp .env-example .env
   # Edit .env with your server URL (default: http://localhost:5000)
   ```

### Running the Application

**Option 1: Using the development script (recommended)**
```bash
cd watch-party-app
chmod +x start-dev.sh
./start-dev.sh
```

**Option 2: Manual start**

1. **Start MongoDB** (if using local installation):
   ```bash
   mongod
   ```

2. **Start the backend server:**
   ```bash
   cd server
   npm run dev
   ```
   Server will run on http://localhost:5000

3. **Start the frontend (in a new terminal):**
   ```bash
   cd client
   npm start
   ```
   Frontend will run on http://localhost:3000

### 🎉 You're Ready!

1. Open http://localhost:3000 in your browser
2. Enter your name when prompted
3. Create a new room or join an existing one
4. Share the room code with friends
5. Start watching together!

## 🎮 How to Use

### Creating a Room
1. Click "Create New Room"
2. Enter your name when prompted
3. Share the generated room code with friends
4. The room code is displayed in the top banner

### Joining a Room
1. Get a room code from a friend
2. Enter the code and click "Join Room"
3. Enter your name when prompted
4. You'll be connected instantly!

**Or use a direct link:**
- Share the room URL: `http://localhost:3000?room=ROOMCODE`
- Users will be prompted for their name before joining

### Video Controls

**Uploading Videos:**
- Click "Upload Video" to upload MP4 files (max 1GB)
- Videos are stored on the server and shared with all room participants
- Anyone in the room can upload videos

**Loading Videos from URL:**
- Paste a video URL (MP4 or YouTube) in the "Load URL" section
- Click "Load URL" to load the video
- YouTube videos are automatically detected and embedded

**Video Library:**
- All uploaded videos are stored in the video library
- Click on a video in the library to switch to it
- The currently playing video is highlighted

**Playback Controls:**
- Play/Pause: Click the play/pause button (anyone can control)
- Seek: Click anywhere on the progress bar
- Speed: Adjust playback speed (0.5x to 2.0x) - synced across all users
- Volume: Adjust using the volume slider

### Voice Chat
1. Click "Join Voice" to enable microphone
2. Allow microphone permissions when prompted
3. Use "Mute/Unmute" to control your microphone
4. Adjust individual participant volumes using the sliders
5. Click "Leave Voice" to disconnect

**Note:** Voice chat requires HTTPS in production environments.

### Room Timer
1. Click one of the timer buttons (1 min, 5 min, 10 min)
2. The timer starts and is synced across all participants
3. A visual countdown is displayed
4. Click "Stop Timer" to cancel
5. Warning appears when timer is below 10 seconds

### Reactions
- Click the reaction button (😊) in the video player
- Select an emoji to send
- Reactions appear as floating animations on screen

### Theme Toggle
- Click the theme toggle button in the top right
- Switch between dark and light themes
- Your preference is saved in localStorage

## 🛠️ Technical Details

### Backend Stack
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **MongoDB** - Database for persistence
- **Mongoose** - MongoDB object modeling
- **Multer** - File upload handling
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### Frontend Stack
- **React** - UI framework
- **Socket.IO Client** - Real-time communication
- **simple-peer** - WebRTC wrapper for voice chat
- **YouTube IFrame API** - YouTube video embedding
- **React Context API** - Theme management
- **Webpack** (via react-app-rewired) - Build configuration with polyfills

### Architecture

**Real-time Communication:**
- **Socket.IO** for video synchronization, room management, and events
- **WebRTC** (via simple-peer) for peer-to-peer voice communication
- **MongoDB** for data persistence (rooms, users, video metadata)

**Video Handling:**
- **HTML5 Video Player** for MP4 videos
- **YouTube IFrame API** for YouTube videos
- **Server-side storage** for uploaded videos
- **Video library system** for managing multiple videos per room

**State Management:**
- React hooks (useState, useEffect, useRef)
- LocalStorage for user preferences and room persistence
- Socket.IO events for real-time updates

### Project Structure

```
watch-party-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── VideoPlayer.jsx    # Main video player with YouTube support
│   │   │   ├── VoiceChat.jsx      # WebRTC voice chat
│   │   │   ├── TextChat.jsx       # Text chat (available but not used in App.js)
│   │   │   ├── RoomControls.jsx  # Room creation/joining UI
│   │   │   └── Reactions.jsx      # Emoji reactions
│   │   ├── contexts/
│   │   │   └── ThemeContext.js    # Theme management
│   │   ├── App.js         # Main application component
│   │   ├── index.js       # Entry point
│   │   └── polyfills.js   # Node.js API polyfills for browser
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
│
├── server/                # Node.js backend
│   ├── models/           # MongoDB models
│   │   ├── Room.js       # Room schema
│   │   └── User.js       # User schema
│   ├── uploads/          # Uploaded video storage
│   │   └── videos/       # Video files
│   ├── server.js         # Express server and Socket.IO
│   └── package.json      # Backend dependencies
│
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables

**Server (server/.env):**
```env
MONGODB_URI=mongodb://localhost:27017/watchparty
JWT_SECRET=your_secret_key_here
PORT=5000
BASE_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

**Client (client/.env):**
```env
REACT_APP_SERVER_URL=http://localhost:5000
```

### Supported Video Formats
- **MP4** (recommended for direct uploads)
- **YouTube URLs** (any YouTube video URL format)
- Direct video URLs (must be CORS-enabled)

## 🌐 Deployment

### Production Considerations
1. **Database**: Use MongoDB Atlas for cloud database
2. **HTTPS**: Required for WebRTC in production
3. **TURN Servers**: Needed for users behind restrictive firewalls
4. **Environment Variables**: Set secure JWT secrets and production URLs
5. **CORS**: Configure for your production domain
6. **File Storage**: Consider cloud storage (S3, etc.) for video files
7. **Nginx**: Configure reverse proxy for serving static files and API

### Recommended Deployment Platforms
- **Backend**: Railway, Heroku, DigitalOcean, AWS EC2
- **Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Database**: MongoDB Atlas
- **File Storage**: AWS S3, Google Cloud Storage

See `DEPLOYMENT.md` and `DEPLOYMENT_TWO_DOMAINS.md` for detailed deployment guides.

## 🐛 Troubleshooting

### Common Issues

**Voice chat not working:**
- Check microphone permissions in browser settings
- Ensure HTTPS in production (required for WebRTC)
- Check browser console for errors
- Try refreshing the page
- Verify TURN/STUN servers are accessible

**Video sync issues:**
- Use direct MP4 URLs or YouTube URLs
- Check video source CORS policy
- Ensure stable internet connection
- Try the "Force Sync" button if available

**YouTube videos not loading:**
- Check if YouTube IFrame API is loaded
- Verify the YouTube URL is valid
- Check browser console for errors
- Ensure YouTube is accessible in your region

**Connection problems:**
- Verify MongoDB is running
- Check server console for errors
- Ensure ports 3000 and 5000 are available
- Verify environment variables are set correctly
- Check firewall settings

**File upload issues:**
- Verify uploads directory exists and has write permissions
- Check file size (max 1GB)
- Ensure multer is configured correctly
- Check server logs for errors

## 📝 Current Features Status

### ✅ Implemented
- Synchronized video playback (MP4 and YouTube)
- Voice chat with per-participant volume control
- Room timer with countdown
- Video library system
- Video upload and URL loading
- Playback speed control (synced)
- Dark/Light theme toggle
- Emoji reactions
- User management
- Room persistence
- Username system

### 🚫 Removed/Not Used
- Text Chat component (exists but not used in App.js)
- Room Info panel (removed from UI)
- Combined Chat component (removed)
- Status badges in VideoPlayer (removed)

## 🔄 Recent Changes

- Removed Room Info panel from left sidebar
- Removed status badges (Video Ready, Host, Anyone Can Play/Pause) from VideoPlayer
- Removed TextChat from main UI (component still exists)
- Improved YouTube video synchronization with reduced latency
- Added periodic sync for YouTube videos to prevent drift
- Enhanced UI with modern design and glassmorphism effects

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 🎬 Enjoy Your Watch Parties!

Have fun watching videos with friends! If you encounter any issues or have suggestions, please don't hesitate to reach out.
