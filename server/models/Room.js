const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    default: 'Untitled Room'
  },
  host: {
    type: String,
    required: true
  },
  currentVideo: {
    url: String,
    title: String,
    filename: String,
    size: Number,
    duration: Number,
    format: String,
    uploadedAt: Date,
    currentTime: {
      type: Number,
      default: 0
    },
    isPlaying: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  videoLibrary: [{
    url: String,
    title: String,
    filename: String,
    size: Number,
    duration: Number,
    format: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: String
  }],
  subtitles: {
    url: String,
    language: String,
    offset: {
      type: Number,
      default: 0
    }
  },
  users: [{
    userId: String,
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isHost: Boolean,
    hasVideo: Boolean,
    hasAudio: Boolean
  }],
  messages: [{
    sender: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    userId: String,
    emoji: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPrivate: {
    type: Boolean,
    default: false,
    index: true
  },
  password: {
    type: String,
    default: null,
    select: false // Don't return password by default
  }
});

// Add indexes for performance
roomSchema.index({ host: 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ updatedAt: -1 });
roomSchema.index({ 'currentVideo.lastUpdated': -1 });
roomSchema.index({ 'users.userId': 1 });

// Limit array sizes to prevent unbounded growth
roomSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Limit messages array to last 1000 messages
  if (this.messages && this.messages.length > 1000) {
    this.messages = this.messages.slice(-1000);
  }
  
  // Limit reactions array to last 500 reactions
  if (this.reactions && this.reactions.length > 500) {
    this.reactions = this.reactions.slice(-500);
  }
  
  // Limit video library to 100 videos
  if (this.videoLibrary && this.videoLibrary.length > 100) {
    this.videoLibrary = this.videoLibrary.slice(-100);
  }
  
  next();
});

module.exports = mongoose.model('Room', roomSchema);
