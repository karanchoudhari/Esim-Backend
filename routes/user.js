const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  createuser, 
  Loginuser, 
  verifyToken, 
  forgotPassword, 
  resetPassword 
} = require('../controllers/user');

router.post('/createuser', createuser);
router.post('/loginuser', Loginuser);
router.get('/verify', auth, verifyToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Add this test route to check database connection
router.get('/test-db', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    // Try to query the database
    const userCount = await User.countDocuments();
    
    res.json({
      success: true,
      database: {
        state: dbState,
        status: dbStates[dbState] || 'unknown',
        connected: dbState === 1
      },
      userCount: userCount,
      message: 'Database test completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message
    });
  }
});
module.exports = router;