# 🎬 Watch Party Pro

A full-featured watch party application that allows you to watch movies together with friends in real-time. Built with React, Node.js, Socket.IO, and WebRTC.

## ✨ Features

- **🎬 Synchronized Video Playback** - Watch videos together in perfect sync
- **🎤 Voice Chat** - Crystal-clear WebRTC audio communication
- **💬 Real-time Text Chat** - Send messages with chat history
- **🎭 Emoji Reactions** - Send floating emoji reactions during playback
- **👥 User Management** - See who's in your room
- **📱 Responsive Design** - Works on desktop and mobile
- **🔄 Room Persistence** - Rooms are saved in MongoDB
- **🎯 Easy Room Sharing** - Simple 6-character room codes

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
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
   ```

3. **Set up the frontend:**
   ```bash
   cd ../client
   npm install
   ```

### Running the Application

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
2. Create a new room or join an existing one
3. Share the room code with friends
4. Start watching together!

## 🎮 How to Use

### Creating a Room
1. Click "Create New Room"
2. Optionally enter a room name
3. Share the generated room code with friends

### Joining a Room
1. Get a room code from a friend
2. Enter the code and click "Join Room"
3. You'll be connected instantly!

### Voice Chat
1. Click "Join Voice" to enable microphone
2. Allow microphone permissions when prompted
3. Use "Mute/Unmute" to control your microphone
4. Adjust volume slider for incoming audio

### Video Controls
- Load custom videos by pasting MP4 URLs
- Use sample videos for quick testing
- All video controls (play, pause, seek) are synchronized

### Chat & Reactions
- Send text messages in the chat panel
- Click the reaction button (😊) to send emoji reactions
- Reactions appear as floating animations on screen

## 🛠️ Technical Details

### Backend Stack
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **MongoDB** - Database for persistence
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### Frontend Stack
- **React** - UI framework
- **Socket.IO Client** - Real-time communication
- **Video.js** - Video player
- **simple-peer** - WebRTC wrapper
- **Axios** - HTTP client

### Architecture
- **WebRTC** for peer-to-peer voice communication
- **Socket.IO** for real-time synchronization
- **MongoDB** for data persistence
- **RESTful API** for authentication

## 🔧 Configuration

### Environment Variables (server/.env)
```env
MONGODB_URI=mongodb://localhost:27017/watchparty
JWT_SECRET=your_secret_key_here
PORT=5000
```

### Supported Video Formats
- MP4 (recommended)
- Direct video URLs work best
- CORS-enabled video sources

## 🌐 Deployment

### Production Considerations
1. **Database**: Use MongoDB Atlas for cloud database
2. **HTTPS**: Required for WebRTC in production
3. **TURN Servers**: Needed for users behind restrictive firewalls
4. **Environment Variables**: Set secure JWT secrets
5. **CORS**: Configure for your production domain

### Recommended Deployment Platforms
- **Backend**: Railway, Heroku, or DigitalOcean
- **Frontend**: Vercel, Netlify, or AWS S3
- **Database**: MongoDB Atlas

## 🐛 Troubleshooting

### Common Issues

**Voice chat not working:**
- Check microphone permissions
- Ensure HTTPS in production
- Try refreshing the page

**Video sync issues:**
- Use direct MP4 URLs
- Check video source CORS policy
- Ensure stable internet connection

**Connection problems:**
- Verify MongoDB is running
- Check server console for errors
- Ensure ports 3000 and 5000 are available

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 🎬 Enjoy Your Watch Parties!

Have fun watching movies with friends! If you encounter any issues or have suggestions, please don't hesitate to reach out.
