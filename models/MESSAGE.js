const mongoose = require("mongoose")

const ReactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const AttachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  url: { type: String, required: true }
});

const MessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' }, // Changed from required to default empty
    isAdmin: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    repliedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    attachment: AttachmentSchema, // Changed from String to Object schema
    reactions: [ReactionSchema],
    isPinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MESSAGE", MessageSchema);

// const mongoose = require("mongoose")

// const MessageSchema = new mongoose.Schema({
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     text: { type: String, required: true },
//     isAdmin: { type: Boolean, default: false },
//     isRead: { type: Boolean, default: false },
//     repliedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
//     createdAt: { type: Date, default: Date.now }
//   });

//   module.exports = mongoose.model("MESSAGE",MessageSchema)