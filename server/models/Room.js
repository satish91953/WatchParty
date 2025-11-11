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
    default: true
  }
});

// Auto-update updatedAt
roomSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Room', roomSchema);
