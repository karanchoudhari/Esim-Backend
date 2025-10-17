const ESIM = require('../models/ESIM');
const User = require('../models/User');
const QRCode = require('qrcode');
const KYC = require('../models/KYC');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

exports.sendEmailOTP = async (req, res) => {
  try {
    console.log('📞 Send OTP request received:', { userId: req.user.id, phone: req.body.phone });
    
    const userId = req.user.id;
    const { phone } = req.body;

    // Check KYC status
    const kyc = await KYC.findOne({ userId });
    console.log('📋 KYC status:', kyc?.status);
    
    if (!kyc || kyc.status !== 'approved') {
      return res.status(400).json({ 
        success: false,
        message: 'KYC not approved. Please complete KYC verification first.' 
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('👤 User found:', user.email);

    // Check if user already has an active eSIM
    const activeEsim = await ESIM.findOne({ 
      userId, 
      status: 'activated' 
    });

    let message = 'OTP sent to your registered email';
    let warning = false;

    if (activeEsim) {
      message = 'You already have an active eSIM. Requesting a new one will deactivate your current eSIM. OTP sent to your email.';
      warning = true;
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(userId, { otp, expiresAt, phone });

    console.log('🔐 OTP generated for user:', user.email, 'OTP:', otp);

    // Send OTP email with enhanced error handling
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2c5aa0; text-align: center; margin-bottom: 20px;">eSIM Verification OTP</h2>
            <p style="color: #555; font-size: 16px;">Dear ${user.name},</p>
            <p style="color: #555;">Your OTP for eSIM verification is:</p>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 25px 0; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              ${otp}
            </div>
            <p style="color: #777; text-align: center; font-size: 14px;">This OTP is valid for 10 minutes.</p>
            <p style="color: #777; text-align: center; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Your eSIM Verification OTP - Action Required',
        html: emailHtml,
        text: `Your eSIM verification OTP is: ${otp}. This OTP is valid for 10 minutes.`
      });

      console.log('✅ Email sent successfully to:', user.email);

    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      
      // Don't delete OTP immediately, allow frontend to retry
      return res.status(500).json({ 
        success: false,
        message: 'Failed to send OTP email. Please try again in a moment.',
        error: emailError.message,
        code: 'EMAIL_SERVICE_ERROR',
        retryable: true
      });
    }

    res.json({ 
      success: true, 
      message,
      warning,
      emailSent: true
    });

  } catch (error) {
    console.error('💥 Error in sendEmailOTP:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending OTP', 
      error: error.message,
      code: 'SERVER_ERROR'
    });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp, phone } = req.body;

    console.log('🔍 Verify OTP request:', { userId, otpLength: otp?.length });

    // Get stored OTP data
    const storedData = otpStore.get(userId);
    
    if (!storedData) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.' 
      });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(userId);
      return res.status(410).json({ 
        success: false,
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid OTP. Please try again.' 
      });
    }

    if (storedData.phone !== phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number mismatch. Please start the process again.' 
      });
    }

    // Check if user has active eSIM and deactivate it
    const activeEsim = await ESIM.findOne({ 
      userId, 
      status: 'activated' 
    });

    let deactivatedExisting = false;

    if (activeEsim) {
      activeEsim.status = 'deactivated';
      activeEsim.deactivatedAt = new Date();
      await activeEsim.save();
      deactivatedExisting = true;
    }

    // Clear OTP after successful verification
    otpStore.delete(userId);

    console.log('✅ OTP verified successfully for user:', userId);

    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      deactivatedExisting
    });

  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error verifying OTP', 
      error: error.message 
    });
  }
};

exports.resendEmailOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone } = req.body;

    console.log('🔄 Resend OTP request:', { userId });

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(userId, { otp, expiresAt, phone });

    console.log('🔐 New OTP generated for resend:', user.email, 'OTP:', otp);

    // Send OTP email with enhanced error handling
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2c5aa0; text-align: center; margin-bottom: 20px;">New eSIM Verification OTP</h2>
            <p style="color: #555; font-size: 16px;">Dear ${user.name},</p>
            <p style="color: #555;">Your new OTP for eSIM verification is:</p>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 25px 0; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              ${otp}
            </div>
            <p style="color: #777; text-align: center; font-size: 14px;">This OTP is valid for 10 minutes.</p>
            <p style="color: #777; text-align: center; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Your New eSIM Verification OTP',
        html: emailHtml,
        text: `Your new eSIM verification OTP is: ${otp}. This OTP is valid for 10 minutes.`
      });

      console.log('✅ Resend email sent successfully to:', user.email);

    } catch (emailError) {
      console.error('❌ Resend email sending failed:', emailError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to resend OTP email. Please try again.',
        error: emailError.message,
        code: 'EMAIL_SERVICE_ERROR',
        retryable: true
      });
    }

    res.json({ 
      success: true, 
      message: 'OTP resent successfully'
    });

  } catch (error) {
    console.error('❌ Error resending OTP:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error resending OTP', 
      error: error.message,
      code: 'SERVER_ERROR'
    });
  }
};

exports.requestESIM = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check KYC status from KYC collection
    const kyc = await KYC.findOne({ userId });

    if (!kyc) {
      return res.status(400).json({ 
        success: false,
        message: 'KYC not submitted. Please complete KYC verification first.' 
      });
    }

    if (kyc.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `KYC status is ${kyc.status}. Please complete KYC verification first.`
      });
    }

    const activationCode = generateActivationCode();
    const iccid = generateICCID();
    const smdpPlusAddress = 'ESIM.telecom.com';

    // Get user details for personalized message
    const user = await User.findById(userId);
    
    // Create personalized message that will show when QR is scanned
    const personalizedMessage = `Thank you ${user.name}! Your eSIM has been activated. Enjoy seamless connectivity with our services.`;
    
    // Create QR code data with BOTH technical info AND personalized message
    const qrCodeData = `LPA:1$${smdpPlusAddress}$${activationCode}\n\n${personalizedMessage}`;
    
    // Generate QR code image
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 1,
      type: 'image/png'
    });

    // Create eSIM with pending status (admin must approve)
    const esim = await ESIM.create({
      userId,
      qrCodeData: qrCodeData,
      qrCodeImage: qrCodeImage,
      iccid,
      activationCode,
      smdpPlusAddress,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'eSIM request submitted successfully. Waiting for admin approval.',
      esim: {
        id: esim._id,
        status: esim.status
      }
    });
  } catch (error) {
    console.error('❌ Error in requestESIM:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error requesting eSIM', 
      error: error.message 
    });
  }
};

exports.getESIMStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const esim = await ESIM.findById(id);

    if (!esim) {
      return res.status(404).json({ 
        success: false,
        message: 'eSIM not found' 
      });
    }

    // Check if user owns this eSIM
    if (esim.userId.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    res.status(200).json({
      success: true,
      data: esim
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching eSIM status', 
      error: error.message 
    });
  }
};

exports.getESIMsByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const esims = await ESIM.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'eSIMs retrieved successfully',
      data: esims
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching eSIMs', 
      error: error.message 
    });
  }
};

// Helper functions
function generateActivationCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateICCID() {
  return '89' + Math.random().toString().substring(2, 21);
}

// const ESIM = require('../models/ESIM');
// const User = require('../models/User');
// const QRCode = require('qrcode');
// const KYC = require('../models/KYC');
// const sendEmail = require('../utils/sendEmail');
// const crypto = require('crypto');

// // Store OTPs temporarily (in production, use Redis)
// const otpStore = new Map();

// exports.sendEmailOTP = async (req, res) => {
//   try {
//     console.log('Send OTP request received:', { userId: req.user.id, phone: req.body.phone });
    
//     const userId = req.user.id;
//     const { phone } = req.body;

//     // Check KYC status
//     const kyc = await KYC.findOne({ userId });
//     console.log('KYC status:', kyc?.status);
    
//     if (!kyc || kyc.status !== 'approved') {
//       return res.status(400).json({ message: 'KYC not approved. Please complete KYC verification first.' });
//     }

//     // Get user details
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     console.log('User found:', user.email);

//     // Check if user already has an active eSIM
//     const activeEsim = await ESIM.findOne({ 
//       userId, 
//       status: 'activated' 
//     });

//     let message = 'OTP sent to your registered email';
//     let warning = false;

//     if (activeEsim) {
//       message = 'You already have an active eSIM. Requesting a new one will deactivate your current eSIM. OTP sent to your email.';
//       warning = true;
//     }

//     // Generate OTP
//     const otp = crypto.randomInt(100000, 999999).toString();
//     const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

//     // Store OTP
//     otpStore.set(userId, { otp, expiresAt, phone });

//     console.log('OTP generated for user:', user.email);

//     // Send OTP email with enhanced error handling
//     try {
//       const emailHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #333;">eSIM Verification OTP</h2>
//           <p>Dear ${user.name},</p>
//           <p>Your OTP for eSIM verification is:</p>
//           <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
//             ${otp}
//           </div>
//           <p>This OTP is valid for 10 minutes.</p>
//           <p>If you didn't request this, please ignore this email.</p>
//           <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
//           <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
//         </div>
//       `;

//       await sendEmail({
//         to: user.email,
//         subject: 'Your eSIM Verification OTP',
//         html: emailHtml
//       });

//       console.log('Email sent successfully to:', user.email);

//     } catch (emailError) {
//       console.error('Email sending failed:', emailError);
//       // Don't delete OTP from store, allow retry
//       return res.status(500).json({ 
//         message: 'Failed to send email. Please try again later.',
//         error: 'EMAIL_SERVICE_ERROR',
//         code: 'EMAIL_SERVICE_ERROR'
//       });
//     }

//     res.json({ 
//       success: true, 
//       message,
//       warning
//     });

//   } catch (error) {
//     console.error('Error sending email OTP:', error);
//     res.status(500).json({ 
//       message: 'Error sending OTP', 
//       error: error.message,
//       code: 'SERVER_ERROR'
//     });
//   }
// };

// exports.verifyEmailOTP = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { otp, phone } = req.body;

//     console.log('Verify OTP request:', { userId, otpLength: otp?.length });

//     // Get stored OTP data
//     const storedData = otpStore.get(userId);
    
//     if (!storedData) {
//       return res.status(400).json({ message: 'OTP not found or expired. Please request a new OTP.' });
//     }

//     if (storedData.expiresAt < Date.now()) {
//       otpStore.delete(userId);
//       return res.status(410).json({ message: 'OTP has expired. Please request a new one.' });
//     }

//     if (storedData.otp !== otp) {
//       return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
//     }

//     if (storedData.phone !== phone) {
//       return res.status(400).json({ message: 'Phone number mismatch. Please start the process again.' });
//     }

//     // Check if user has active eSIM and deactivate it
//     const activeEsim = await ESIM.findOne({ 
//       userId, 
//       status: 'activated' 
//     });

//     let deactivatedExisting = false;

//     if (activeEsim) {
//       activeEsim.status = 'deactivated';
//       activeEsim.deactivatedAt = new Date();
//       await activeEsim.save();
//       deactivatedExisting = true;
//     }

//     // Clear OTP after successful verification
//     otpStore.delete(userId);

//     console.log('OTP verified successfully for user:', userId);

//     res.json({ 
//       success: true, 
//       message: 'OTP verified successfully',
//       deactivatedExisting
//     });

//   } catch (error) {
//     console.error('Error verifying OTP:', error);
//     res.status(500).json({ message: 'Error verifying OTP', error: error.message });
//   }
// };

// exports.resendEmailOTP = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { phone } = req.body;

//     console.log('Resend OTP request:', { userId });

//     // Get user details
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Generate new OTP
//     const otp = crypto.randomInt(100000, 999999).toString();
//     const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

//     // Store OTP
//     otpStore.set(userId, { otp, expiresAt, phone });

//     console.log('New OTP generated for resend:', user.email);

//     // Send OTP email with enhanced error handling
//     try {
//       const emailHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #333;">eSIM Verification OTP</h2>
//           <p>Dear ${user.name},</p>
//           <p>Your new OTP for eSIM verification is:</p>
//           <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
//             ${otp}
//           </div>
//           <p>This OTP is valid for 10 minutes.</p>
//           <p>If you didn't request this, please ignore this email.</p>
//           <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
//           <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
//         </div>
//       `;

//       await sendEmail({
//         to: user.email,
//         subject: 'Your New eSIM Verification OTP',
//         html: emailHtml
//       });

//       console.log('Resend email sent successfully to:', user.email);

//     } catch (emailError) {
//       console.error('Resend email sending failed:', emailError);
//       return res.status(500).json({ 
//         message: 'Failed to resend email. Please try again later.',
//         error: 'EMAIL_SERVICE_ERROR',
//         code: 'EMAIL_SERVICE_ERROR'
//       });
//     }

//     res.json({ 
//       success: true, 
//       message: 'OTP resent successfully'
//     });

//   } catch (error) {
//     console.error('Error resending OTP:', error);
//     res.status(500).json({ 
//       message: 'Error resending OTP', 
//       error: error.message,
//       code: 'SERVER_ERROR'
//     });
//   }
// };

// // Add this temporary test endpoint for debugging
// exports.testEmailService = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);
    
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     const testEmailHtml = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: #333;">Test Email Service</h2>
//         <p>Dear ${user.name},</p>
//         <p>This is a test email to verify that the email service is working properly.</p>
//         <p>If you received this email, the email service is configured correctly.</p>
//         <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
//         <p style="color: #666; font-size: 12px;">Test email sent at: ${new Date().toString()}</p>
//       </div>
//     `;

//     await sendEmail({
//       to: user.email,
//       subject: 'Test Email - eSIM Service',
//       html: testEmailHtml
//     });

//     res.json({ 
//       success: true, 
//       message: 'Test email sent successfully',
//       email: user.email
//     });

//   } catch (error) {
//     console.error('Test email failed:', error);
//     res.status(500).json({ 
//       message: 'Test email failed', 
//       error: error.message 
//     });
//   }
// };

// exports.requestESIM = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // Check KYC status from KYC collection
//     const kyc = await KYC.findOne({ userId });

//     if (!kyc) {
//       return res.status(400).json({ message: 'KYC not submitted. Please complete KYC verification first.' });
//     }

//     if (kyc.status !== 'approved') {
//       return res.status(400).json({
//         message: `KYC status is ${kyc.status}. Please complete KYC verification first.`
//       });
//     }

//     const activationCode = generateActivationCode();
//     const iccid = generateICCID();
//     const smdpPlusAddress = 'ESIM.telecom.com';

//     // Get user details for personalized message
//     const user = await User.findById(userId);
    
//     // Create personalized message that will show when QR is scanned
//     const personalizedMessage = `Thank you ${user.name}! Your eSIM has been activated. Enjoy seamless connectivity with our services.`;
    
//     // Create QR code data with BOTH technical info AND personalized message
//     const qrCodeData = `LPA:1$${smdpPlusAddress}$${activationCode}\n\n${personalizedMessage}`;
    
//     // Generate QR code image
//     const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
//       errorCorrectionLevel: 'H',
//       width: 300,
//       margin: 1,
//       type: 'image/png'
//     });

//     // Create eSIM with pending status (admin must approve)
//     const esim = await ESIM.create({
//       userId,
//       qrCodeData: qrCodeData,
//       qrCodeImage: qrCodeImage,
//       iccid,
//       activationCode,
//       smdpPlusAddress,
//       status: 'pending'
//     });

//     res.status(201).json({
//       message: 'eSIM request submitted successfully. Waiting for admin approval.',
//       esim: {
//         id: esim._id,
//         status: esim.status
//       }
//     });
//   } catch (error) {
//     console.error('Error in requestESIM:', error);
//     res.status(500).json({ message: 'Error requesting eSIM', error: error.message });
//   }
// };

// exports.getESIMStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const esim = await ESIM.findById(id);

//     if (!esim) {
//       return res.status(404).json({ message: 'eSIM not found' });
//     }

//     // Check if user owns this eSIM
//     if (esim.userId.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Access denied' });
//     }

//     res.status(200).json(esim);
//   } catch (error) {
//     res.status(500).json({ message: 'Error fetching eSIM status', error: error.message });
//   }
// };

// exports.getESIMsByUser = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const esims = await ESIM.find({ userId }).sort({ createdAt: -1 });

//     res.status(200).json({
//       message: 'eSIMs retrieved successfully',
//       data: esims
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Error fetching eSIMs', error: error.message });
//   }
// };

// // Helper functions
// function generateActivationCode() {
//   return Math.random().toString(36).substring(2, 10).toUpperCase();
// }

// function generateICCID() {
//   return '89' + Math.random().toString().substring(2, 21);
// }

