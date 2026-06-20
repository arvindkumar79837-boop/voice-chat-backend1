const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatIndex: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: "My Voice Room"
  },
  description: {
    type: String,
    default: ""
  },
  coverImage: {
    type: String,
    default: ""
  },
  tags: [{
    type: String
  }],
  language: {
    type: String,
    default: "English"
  },
  roomType: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  password: {
    type: String,
    default: ""
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  seats: {
    type: [seatSchema],
    default: () => {
      // Default 10 seats (0 to 9)
      const defaultSeats = [];
      for (let i = 0; i < 10; i++) {
        defaultSeats.push({
          seatIndex: i,
          userId: null,
          isMuted: false,
          isLocked: false
        });
      }
      return defaultSeats;
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Room', roomSchema);
