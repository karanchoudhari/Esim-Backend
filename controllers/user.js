const User = require('../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail'); // Import the email utility

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '300d' }
  );
};

// Generate reset token
const generateResetToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

module.exports.createuser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newuser = await User.create({
      name, email, password
    });

    res.status(200).json({
      message: "User created successfully",
      data: {
        _id: newuser._id,
        name: newuser.name,
        email: newuser.email,
        role: newuser.role,
        token: generateToken(newuser)
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Signup failed',
      error: error.message
    });
  }
};
module.exports.Loginuser = async (req, res) => {
  try {
    // console.log('=== LOGIN ATTEMPT STARTED ===');
    // console.log('Request body:', req.body);
    
    // Debug environment variables
    // console.log('Environment check:');
    // console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    // console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
    // console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    // console.log('PORT:', process.env.PORT);
    
    // Check if JWT secret is configured
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      console.error('ERROR: JWT_SECRET is not configured or is empty');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
        error: 'JWT secret not configured',
        debug: {
          hasJwtSecret: !!process.env.JWT_SECRET,
          jwtSecretLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
          allEnvVars: Object.keys(process.env)
        }
      });
    }
    
    const { email, password } = req.body;
    // console.log("login ",req.body);
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Check database connection state
    const dbState = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    // console.log('Database state:', dbState, '(', dbStates[dbState] || 'unknown', ')');
    
    if (dbState !== 1) {
      console.error('ERROR: Database not connected. State:', dbState);
      return res.status(500).json({
        success: false,
        message: 'Database connection issue',
        dbState: dbState,
        dbStatus: dbStates[dbState] || 'unknown'
      });
    }

    // console.log('Looking for user with email:', email);
    const user = await User.findOne({ email });
    // console.log('User found:', user ? `Yes (${user.email})` : 'No');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if user has password method
    if (typeof user.comparePassword !== 'function') {
      console.error('ERROR: User model missing comparePassword method');
      // console.log('User object methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(user)));
      return res.status(500).json({
        success: false,
        message: 'Server error: User model configuration issue'
      });
    }

    // Check password
    // console.log('Checking password...');
    const isPasswordValid = await user.comparePassword(password);
    // console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    let token;
    try {
      // console.log('Generating JWT token...');
      token = generateToken(user);
      // console.log('Token generated successfully');
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({
        success: false,
        message: 'Login failed - token error',
        error: tokenError.message
      });
    }
    
    // Successful login response
    // console.log('=== LOGIN SUCCESSFUL ===');
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: token
      }
    });
  } catch (error) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // More specific error messages
    let errorMessage = 'Login failed';
    if (error.name === 'MongoNetworkError') {
      errorMessage = 'Database connection error';
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Data validation error';
    } else if (error.name === 'CastError') {
      errorMessage = 'Data format error';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      // Only include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};
// module.exports.Loginuser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(401).json({
//         message: "Invalid email or password"
//       });
//     }

//     // Check password
//     const isPasswordValid = await user.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         message: 'Invalid email or password',
//       });
//     }

//     res.status(200).json({
//       message: 'Login successful',
//       data: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         token: generateToken(user)
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: 'Login failed',
//       error: error.message
//     });
//   }
// };

exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Token verification failed', error: error.message });
  }
};

// Forgot password controller - UPDATED VERSION
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    // Check if user exists with this email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'No account found with this email address' 
      });
    }
    
    // Generate reset token
    const resetToken = generateResetToken();
    
    // Save reset token and expiry to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Create reset URL (frontend URL)
  
    const resetUrl = `https://esim1.netlify.app/reset-password/${resetToken}`;
    
    // Email message
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${user.name},</p>
        <p>You requested a password reset for your account. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
        `;
        
        // <p>Or copy and paste this link in your browser:</p>
        // <p style="word-break: break-all;">${resetUrl}</p>
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - Your App Name',
        html: message
      });
      
      res.status(200).json({ 
        success: true,
        message: 'Password reset instructions have been sent to your email' 
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      
      res.status(500).json({ 
        success: false,
        message: 'Email could not be sent. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error. Please try again later.' 
    });
  }
};

// Reset password controller
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    
    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    
    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};