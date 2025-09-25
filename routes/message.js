const express = require("express");
const { GetUserMessage, GetAdminMessage } = require("../controllers/message");
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const MESSAGE = require("../models/MESSAGE");
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.get('/user', auth, GetUserMessage);
router.get("/admin/users", adminAuth, GetAdminMessage);

// Get messages for a specific user
router.get('/admin/users/:userId', adminAuth, async (req, res) => {
    try {
        const messages = await MESSAGE.find({ userId: req.params.userId })
            .populate('userId', 'name email')
            .sort({ createdAt: 1 });

        // Mark messages as read
        await MESSAGE.updateMany(
            { userId: req.params.userId, isAdmin: false, isRead: false },
            { isRead: true }
        );

        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark messages as read
router.put('/mark-read', auth, async (req, res) => {
    try {
      await MESSAGE.updateMany(
        { userId: req.user._id, isAdmin: true, isRead: false },
        { isRead: true }
      );
      res.json({ success: true, message: "Messages marked as read" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

// Send message with attachment
router.post('/send-with-attachment', adminAuth, upload.single('attachment'), async (req, res) => {
  try {
    const { userId, text } = req.body;
    
    const message = new MESSAGE({
      userId,
      text,
      isAdmin: true,
      isRead: false,
      attachment: req.file ? {
        name: req.file.originalname,
        type: req.file.mimetype,
        url: `/uploads/${req.file.filename}`
      } : null
    });
    
    await message.save();
    await message.populate('userId', 'name email');
    
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pin message
router.post('/pin', adminAuth, async (req, res) => {
  try {
    const { messageId, userId } = req.body;
    
    // Pin the message
    await MESSAGE.findByIdAndUpdate(
      messageId,
      { isPinned: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unpin message
router.post('/unpin', adminAuth, async (req, res) => {
  try {
    const { messageId, userId } = req.body;
    
    // Unpin the message
    await MESSAGE.findByIdAndUpdate(
      messageId,
      { isPinned: false }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pinned messages for a user
router.get('/pinned/:userId', adminAuth, async (req, res) => {
  try {
    const pinnedMessages = await MESSAGE.find({ 
      userId: req.params.userId, 
      isPinned: true 
    }).sort({ createdAt: -1 });
    
    res.json({ pinnedMessages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Export chat history
router.get('/export/:userId', adminAuth, async (req, res) => {
  try {
    const messages = await MESSAGE.find({ userId: req.params.userId })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 });
    
    // In a real implementation, you would generate a PDF or CSV
    // For now, return JSON
    res.setHeader('Content-Disposition', `attachment; filename=chat-history-${req.params.userId}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(messages, null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// const express = require("express");
// const { GetUserMessage, GetAdminMessage } = require("../controllers/message");
// const auth = require("../middleware/auth");
// const adminAuth = require("../middleware/adminAuth");
// const MESSAGE = require("../models/MESSAGE");
// const router = express.Router();

// router.get('/user', auth, GetUserMessage);
// router.get("/admin/users", adminAuth, GetAdminMessage);

// // Add this route for getting user messages
// router.get('/admin/users/:userId', adminAuth, async (req, res) => {
//     try {
//         const messages = await MESSAGE.find({ userId: req.params.userId })
//             .populate('userId', 'name email')
//             .sort({ createdAt: 1 });

//         // Mark messages as read
//         await MESSAGE.updateMany(
//             { userId: req.params.userId, isAdmin: false, isRead: false },
//             { isRead: true }
//         );

//         res.json({ messages });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });


// // In your message routes (routes/message.js)
// router.put('/mark-read', auth, async (req, res) => {
//     try {
//       await MESSAGE.updateMany(
//         { userId: req.user._id, isAdmin: true, isRead: false },
//         { isRead: true }
//       );
//       res.json({ success: true, message: "Messages marked as read" });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   });
// module.exports = router;