// config/database.js
const mongoose = require('mongoose');

const dbConnect = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in environment variables');
    return;
  }

  console.log('🔗 Attempting to connect to MongoDB...');
  console.log('Connection string:', connectionString.replace(/:[^:]*@/, ':********@')); // Hide password in logs

  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // 30 seconds timeout instead of 10
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  };

  mongoose.connect(connectionString, options)
    .then(() => {
      console.log('✅ MongoDB connected successfully');
      console.log('📊 Database name:', mongoose.connection.name);
    })
    .catch((error) => {
      console.error('❌ MongoDB connection error:', error.message);
      console.error('💡 Make sure:');
      console.error('1. Your MongoDB Atlas cluster is running');
      console.error('2. Your IP is whitelisted in MongoDB Atlas');
      console.error('3. Your username and password are correct');
      console.error('4. Your connection string is properly formatted');
    });

  // Listen to connection events
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
};

module.exports = dbConnect;