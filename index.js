const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const userRoute = require('./routes/user');
const kycRoute = require('./routes/kyc.js');
const esimRoute = require('./routes/esim.js');
const adminRoute = require('./routes/admin.js');
const messageRoute = require("./routes/message.js")
const dbConnect = require('./config/database');

require('dotenv').config();
const PORT = process.env.PORT || 4000;

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

// Middlewares
app.use(cors({
  // origin: ["http://localhost:5173", "http://localhost:5174", "https://esim1.netlify.app"],
  origin: [ "https://esim1.netlify.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB Connect
dbConnect();

// Routes
app.use('/api/v1/user', userRoute);
app.use('/api/v1/kyc', upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), kycRoute);
app.use('/api/v1/esim', esimRoute);
app.use('/api/v1/admin', adminRoute);
app.use("/api/v1/message", messageRoute);

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    // origin: ["http://localhost:5173", "http://localhost:5174", "https://esim1.netlify.app"],
    origin: ["https://esim1.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const User = require('./models/User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.userId = user._id;
    socket.isAdmin = user.role === 'admin';
    socket.userName = user.name;
   socket.userRole = user.role;    
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.userId} ${socket.userName} (${socket.id}) - Admin: ${socket.isAdmin}`);
  
  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // If admin, join admin room
  if (socket.isAdmin) {
    socket.join('admin_room');
    console.log(`👨‍💼 Admin joined: ${socket.userId}`);
    
    // Notify other admins about new admin connection
    socket.to('admin_room').emit("adminConnected", {
      adminId: socket.userId,
      message: "New admin joined the chat"
    });
  }

  // User sends message
  socket.on("sendMessage", async (data) => {
    try {
      console.log("Message received from user:", data);
      
      const MESSAGE = require('./models/MESSAGE');
      
      // Only save to database if explicitly requested (for admin persistence)
      if (data.saveToDatabase) {
        // Save message to database (for admin to see)
        const message = new MESSAGE({
          userId: socket.userId,
          text: data.text,
          isAdmin: false,
          isRead: false,
          ...(data.isPredefinedIssue && { isPredefinedIssue: true })
        });
        
        await message.save();
        
        // Populate user info
        await message.populate('userId', 'name email');
        
        // Send to all admins
        io.to('admin_room').emit("receiveMessage", message);
      }
      
      // Send confirmation to user
      socket.emit("messageSent", { 
        success: true, 
        message: "Message sent successfully" 
      });
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("messageError", { error: "Failed to send message" });
    }
  });

  // Admin sends reply - FIXED VERSION
  socket.on("sendReply", async (data) => {
    try {
      if (!socket.isAdmin) {
        return socket.emit("replyError", { error: "Admin access required" });
      }
      
      console.log("Admin reply received:", data);
      
      const MESSAGE = require('./models/MESSAGE');
      
      // Save reply to database (always persist admin messages)
      const reply = new MESSAGE({
        userId: data.userId,
        text: data.text,
        isAdmin: true,
        isRead: true, // Admin messages are read by default
        timestamp: data.timestamp || new Date(),
        ...(data.attachment && { attachment: data.attachment })
      });
      
      await reply.save();
      
      // Populate admin info
      await reply.populate('userId', 'name email');
      
      // Send reply to the specific user
      io.to(`user_${data.userId}`).emit("receiveReply", {
        ...reply.toObject(),
        isSessionOnly: false
      });
      
      // Also send to all admins (including the sender) with a different event name
      socket.to('admin_room').emit("adminReply", reply);
      
      // Send confirmation to the admin who sent the message
      socket.emit("replySent", { 
        success: true, 
        message: "Reply sent successfully",
        reply: reply
      });
      
      console.log(`✅ Admin reply sent to user ${data.userId}`);
      
    } catch (error) {
      console.error("❌ Error sending reply:", error);
      socket.emit("replyError", { error: "Failed to send reply: " + error.message });
    }
  });

  // User is typing
  socket.on("typing", (data) => {
    if (socket.isAdmin) {
      // Admin is typing - notify the user they're replying to
      socket.to(`user_${data.userId}`).emit("adminTyping", { 
        isTyping: data.isTyping,
        adminId: socket.userId 
      });
    } else {
      // User is typing - notify all admins
      socket.to('admin_room').emit("userTyping", { 
        userId: socket.userId, 
        userName: socket.userName,
        isTyping: data.isTyping 
      });
    }
  });

  // Message read receipt
  socket.on("markAsRead", async (data) => {
    try {
      const MESSAGE = require('./models/MESSAGE');
      
      if (socket.isAdmin) {
        // Admin marking user messages as read
        await MESSAGE.updateMany(
          { userId: data.userId, isAdmin: false, isRead: false },
          { isRead: true }
        );
        
        // Notify user that admin read their messages
        socket.to(`user_${data.userId}`).emit("messagesRead", {
          readBy: socket.userId,
          timestamp: new Date()
        });
      } else {
        // User marking admin messages as read
        await MESSAGE.updateMany(
          { userId: socket.userId, isAdmin: true, isRead: false },
          { isRead: true }
        );
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  // Message reaction
  socket.on("messageReaction", async (data) => {
    try {
      const MESSAGE = require('./models/MESSAGE');
      
      // Add reaction to message
      await MESSAGE.findByIdAndUpdate(
        data.messageId,
        { $addToSet: { reactions: { emoji: data.emoji, userId: data.userId } } }
      );
      
      // Notify all users in the conversation
      io.to(`user_${data.userId}`).emit("messageReaction", {
        messageId: data.messageId,
        reactions: data.emoji
      });
      
      // Notify admins
      io.to('admin_room').emit("messageReaction", {
        messageId: data.messageId,
        reactions: data.emoji
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error(`Socket error for user ${socket.userId}:`, error);
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔴 User disconnected: ${socket.userId} (${socket.id}) - Reason: ${reason}`);
    
    if (socket.isAdmin) {
      // Notify other admins about admin disconnection
      socket.to('admin_room').emit("adminDisconnected", {
        adminId: socket.userId,
        message: "Admin left the chat"
      });
    }
  });
});

// Use server.listen instead of app.listen for Socket.IO
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const { Server } = require('socket.io');
// const app = express();
// const path = require('path');
// const multer = require('multer');
// const mongoose = require('mongoose');
// const userRoute = require('./routes/user');
// const kycRoute = require('./routes/kyc.js');
// const esimRoute = require('./routes/esim.js');
// const adminRoute = require('./routes/admin.js');
// const messageRoute = require("./routes/message.js")
// const dbConnect = require('./config/database');

// require('dotenv').config();
// const PORT = process.env.PORT || 4000;

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ storage: storage });

// // Middlewares
// app.use(cors({
//   origin: ["http://localhost:5173", "http://localhost:5174", "https://esim1.netlify.app"],
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   credentials: true
// }));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // DB Connect
// dbConnect();

// // Routes
// app.use('/api/v1/user', userRoute);
// app.use('/api/v1/kyc', upload.fields([
//   { name: 'idFront', maxCount: 1 },
//   { name: 'idBack', maxCount: 1 },
//   { name: 'addressProof', maxCount: 1 },
//   { name: 'selfie', maxCount: 1 }
// ]), kycRoute);
// app.use('/api/v1/esim', esimRoute);
// app.use('/api/v1/admin', adminRoute);
// app.use("/api/v1/message", messageRoute);

// // Create HTTP server for Socket.IO
// const server = http.createServer(app);

// // Socket.IO setup
// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:5173", "http://localhost:5174", "https://esim1.netlify.app"],
//     methods: ["GET", "POST"],
//     credentials: true
//   },
// });

// // Socket.IO authentication middleware
// io.use(async (socket, next) => {
//   try {
//     const token = socket.handshake.auth.token;
    
//     if (!token) {
//       return next(new Error("Authentication error: No token provided"));
//     }

//     const jwt = require('jsonwebtoken');
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     const User = require('./models/User');
//     const user = await User.findById(decoded.id).select('-password');
    
//     if (!user) {
//       return next(new Error("Authentication error: User not found"));
//     }

//     socket.userId = user._id;
//     socket.isAdmin = user.role === 'admin';
//     socket.userName = user.name;
    
//     next();
//   } catch (error) {
//     next(new Error("Authentication error: Invalid token"));
//   }
// });

// // Socket.IO connection handling
// io.on("connection", (socket) => {
//   console.log(`🟢 User connected: ${socket.userId} (${socket.id})`);
  
//   // Join user to their personal room
//   socket.join(`user_${socket.userId}`);
  
//   // If admin, join admin room
//   if (socket.isAdmin) {
//     socket.join('admin_room');
//     console.log(`👨‍💼 Admin joined: ${socket.userId}`);
//   }

//   // User sends message
//   socket.on("sendMessage", async (data) => {
//     try {
//         console.log("Message received from user:", data);
        
//         const MESSAGE = require('./models/MESSAGE');
        
//         // Save message to database
//         const message = new MESSAGE({
//             userId: socket.userId,
//             text: data.text,
//             isAdmin: false,
//             isRead: false
//         });
        
//         await message.save();
        
//         // Populate user info
//         await message.populate('userId', 'name email');
        
//         // Send to all admins
//         io.to('admin_room').emit("receiveMessage", message);
        
//         // Send confirmation to user
//         socket.emit("messageSent", { 
//             success: true, 
//             message: "Message sent successfully" 
//         });
//     } catch (error) {
//         console.error("Error saving message:", error);
//         socket.emit("messageError", { error: "Failed to send message" });
//     }
//   });

//   // Admin sends reply - REMOVED DUPLICATE HANDLER
//   socket.on("sendReply", async (data) => {
//     try {
//         if (!socket.isAdmin) {
//             return socket.emit("replyError", { error: "Admin access required" });
//         }
        
//         console.log("Admin reply received:", data);
        
//         const MESSAGE = require('./models/MESSAGE');
        
//         // Save reply to database
//         const reply = new MESSAGE({
//             userId: data.userId,
//             text: data.text,
//             isAdmin: true,
//             isRead: false
//         });
        
//         await reply.save();
        
//         // Populate admin info
//         await reply.populate('userId', 'name email');
        
//         // Send reply to the specific user
//         io.to(`user_${data.userId}`).emit("receiveReply", reply);
        
//         // Also send to all admins
//         io.to('admin_room').emit("receiveMessage", reply);
        
//         socket.emit("replySent", { 
//             success: true, 
//             message: "Reply sent successfully" 
//         });
//     } catch (error) {
//         console.error("Error sending reply:", error);
//         socket.emit("replyError", { error: "Failed to send reply" });
//     }
//   });

//   // User is typing
//   socket.on("typing", (data) => {
//     if (socket.isAdmin) {
//       // Admin is typing - notify the user they're replying to
//       socket.to(`user_${data.userId}`).emit("adminTyping", { isTyping: data.isTyping });
//     } else {
//       // User is typing - notify all admins
//       socket.to('admin_room').emit("userTyping", { 
//         userId: socket.userId, 
//         userName: socket.userName,
//         isTyping: data.isTyping 
//       });
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`🔴 User disconnected: ${socket.userId} (${socket.id})`);
//   });
// });

// // Use server.listen instead of app.listen for Socket.IO
// server.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });

// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const { Server } = require('socket.io');
// const app = express();
// const path = require('path');
// const multer = require('multer');
// const mongoose = require('mongoose');
// const userRoute = require('./routes/user');
// const kycRoute = require('./routes/kyc.js');
// const esimRoute = require('./routes/esim.js');
// const adminRoute = require('./routes/admin.js');
// const messageRoute = require("./routes/message.js")
// const dbConnect = require('./config/database');

// require('dotenv').config();
// const PORT = process.env.PORT || 4000;

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ storage: storage });

// // Middlewares
// app.use(cors({
//   origin: ["http://localhost:5173", "http://localhost:5174", "https://esim1.netlify.app"],
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   credentials: true
// }));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // DB Connect
// dbConnect();

// // Routes
// app.use('/api/v1/user', userRoute);
// app.use('/api/v1/kyc', upload.fields([
//   { name: 'idFront', maxCount: 1 },
//   { name: 'idBack', maxCount: 1 },
//   { name: 'addressProof', maxCount: 1 },
//   { name: 'selfie', maxCount: 1 }
// ]), kycRoute);
// app.use('/api/v1/esim', esimRoute);
// app.use('/api/v1/admin', adminRoute);
// app.use("/api/v1/message", messageRoute);

// // Create HTTP server for Socket.IO
// const server = http.createServer(app);

// // Socket.IO setup
// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:5173", "http://localhost:5174", "https://esim1.netlify.app"],
//     methods: ["GET", "POST"],
//     credentials: true
//   },
// });

// // Socket.IO authentication middleware
// io.use(async (socket, next) => {
//   try {
//     const token = socket.handshake.auth.token;
    
//     if (!token) {
//       return next(new Error("Authentication error: No token provided"));
//     }

//     const jwt = require('jsonwebtoken');
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     const User = require('./models/User');
//     const user = await User.findById(decoded.id).select('-password');
    
//     if (!user) {
//       return next(new Error("Authentication error: User not found"));
//     }

//     socket.userId = user._id;
//     socket.isAdmin = user.role === 'admin';
//     socket.userName = user.name;
    
//     next();
//   } catch (error) {
//     next(new Error("Authentication error: Invalid token"));
//   }
// });

// // Socket.IO connection handling
// io.on("connection", (socket) => {
//   console.log(`🟢 User connected: ${socket.userId} (${socket.id})`);
  
//   // Join user to their personal room
//   socket.join(`user_${socket.userId}`);
  
//   // If admin, join admin room
//   if (socket.isAdmin) {
//     socket.join('admin_room');
//     console.log(`👨‍💼 Admin joined: ${socket.userId}`);
//   }

//   // User sends message
// // In your server.js Socket.IO connection handling
// // User sends message
// socket.on("sendMessage", async (data) => {
//   try {
//       console.log("Message received from user:", data);
      
//       const MESSAGE = require('./models/MESSAGE');
      
//       // Save message to database
//       const message = new MESSAGE({
//           userId: socket.userId,
//           text: data.text,
//           isAdmin: false,
//           isRead: false
//       });
      
//       await message.save();
      
//       // Populate user info
//       await message.populate('userId', 'name email');
      
//       // Send to all admins
//       io.to('admin_room').emit("receiveMessage", message);
      
//       // Send confirmation to user
//       socket.emit("messageSent", { 
//           success: true, 
//           message: "Message sent successfully" 
//       });
//   } catch (error) {
//       console.error("Error saving message:", error);
//       socket.emit("messageError", { error: "Failed to send message" });
//   }
// });

// // Admin sends reply
// socket.on("sendReply", async (data) => {
//   try {
//       if (!socket.isAdmin) {
//           return socket.emit("replyError", { error: "Admin access required" });
//       }
      
//       console.log("Admin reply received:", data);
      
//       const MESSAGE = require('./models/MESSAGE');
      
//       // Save reply to database
//       const reply = new MESSAGE({
//           userId: data.userId,
//           text: data.text,
//           isAdmin: true,
//           isRead: false
//       });
      
//       await reply.save();
      
//       // Populate admin info
//       await reply.populate('userId', 'name email');
      
//       // Send reply to the specific user
//       io.to(`user_${data.userId}`).emit("receiveReply", reply);
      
//       // Also send to all admins
//       io.to('admin_room').emit("receiveMessage", reply);
      
//       socket.emit("replySent", { 
//           success: true, 
//           message: "Reply sent successfully" 
//       });
//   } catch (error) {
//       console.error("Error sending reply:", error);
//       socket.emit("replyError", { error: "Failed to send reply" });
//   }
// });

//   // Admin sends reply
//   socket.on("sendReply", async (data) => {
//     try {
//         if (!socket.isAdmin) {
//             return socket.emit("replyError", { error: "Admin access required" });
//         }
        
//         console.log("Admin reply received:", data);
        
//         const MESSAGE = require('./models/MESSAGE');
        
//         // Save reply to database
//         const reply = new MESSAGE({
//             userId: data.userId,
//             text: data.text,
//             isAdmin: true,
//             isRead: false
//         });
        
//         await reply.save();
        
//         // Populate admin info
//         await reply.populate('userId', 'name email');
        
//         // Send reply to the specific user
//         io.to(`user_${data.userId}`).emit("receiveReply", reply);
        
//         // Also send to all admins
//         io.to('admin_room').emit("receiveMessage", reply);
        
//         socket.emit("replySent", { 
//             success: true, 
//             message: "Reply sent successfully" 
//         });
//     } catch (error) {
//         console.error("Error sending reply:", error);
//         socket.emit("replyError", { error: "Failed to send reply" });
//     }
// });

//   // User is typing
//   socket.on("typing", (data) => {
//     if (socket.isAdmin) {
//       // Admin is typing - notify the user they're replying to
//       socket.to(`user_${data.userId}`).emit("adminTyping", { isTyping: data.isTyping });
//     } else {
//       // User is typing - notify all admins
//       socket.to('admin_room').emit("userTyping", { 
//         userId: socket.userId, 
//         userName: socket.userName,
//         isTyping: data.isTyping 
//       });
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`🔴 User disconnected: ${socket.userId} (${socket.id})`);
//   });
// });

// // Use server.listen instead of app.listen for Socket.IO
// server.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });

// const express = require('express');
// const cors = require('cors');
// const app = express();
// const path = require('path');
// const multer = require('multer');
// const mongoose = require('mongoose');
// const userRoute = require('./routes/user');
// const kycRoute = require('./routes/kyc.js');
// const esimRoute = require('./routes/esim.js');
// const adminRoute = require('./routes/admin.js');
// const messageRoute = require("./routes/message.js")
// const dbConnect = require('./config/database');

// require('dotenv').config();
// const PORT = process.env.PORT || 4000;

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ storage: storage });

// // Middlewares
// app.use(cors({
//   origin: ["http://localhost:5173"],
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   credentials: true
// }));


// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // DB Connect
// dbConnect();

// // Routes
// app.use('/api/v1/user', userRoute);
// app.use('/api/v1/kyc', upload.fields([
//   { name: 'idFront', maxCount: 1 },
//   { name: 'idBack', maxCount: 1 },
//   { name: 'addressProof', maxCount: 1 },
//   { name: 'selfie', maxCount: 1 }
// ]), kycRoute);
// app.use('/api/v1/esim', esimRoute);
// app.use('/api/v1/admin', adminRoute);
// app.use("/api/v1/message", messageRoute);

// app.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });