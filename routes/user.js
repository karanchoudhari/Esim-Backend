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

module.exports = router;