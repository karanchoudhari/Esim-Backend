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
    const userId = req.user.id;
    const { phone } = req.body;

    // Check KYC status
    const kyc = await KYC.findOne({ userId });
    if (!kyc || kyc.status !== 'approved') {
      return res.status(400).json({ message: 'KYC not approved. Please complete KYC verification first.' });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">eSIM Verification OTP</h2>
        <p>Dear ${user.name},</p>
        <p>Your OTP for eSIM verification is:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Your eSIM Verification OTP',
      html: emailHtml
    });

    res.json({ 
      success: true, 
      message,
      warning
    });

  } catch (error) {
    console.error('Error sending email OTP:', error);
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp, phone } = req.body;

    // Get stored OTP data
    const storedData = otpStore.get(userId);
    
    if (!storedData) {
      return res.status(400).json({ message: 'OTP not found or expired. Please request a new OTP.' });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(userId);
      return res.status(410).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    if (storedData.phone !== phone) {
      return res.status(400).json({ message: 'Phone number mismatch. Please start the process again.' });
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

    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      deactivatedExisting
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

exports.resendEmailOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone } = req.body;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(userId, { otp, expiresAt, phone });

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">eSIM Verification OTP</h2>
        <p>Dear ${user.name},</p>
        <p>Your new OTP for eSIM verification is:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Your New eSIM Verification OTP',
      html: emailHtml
    });

    res.json({ 
      success: true, 
      message: 'OTP resent successfully'
    });

  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ message: 'Error resending OTP', error: error.message });
  }
};

exports.requestESIM = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check KYC status from KYC collection
    const kyc = await KYC.findOne({ userId });

    if (!kyc) {
      return res.status(400).json({ message: 'KYC not submitted. Please complete KYC verification first.' });
    }

    if (kyc.status !== 'approved') {
      return res.status(400).json({
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
      message: 'eSIM request submitted successfully. Waiting for admin approval.',
      esim: {
        id: esim._id,
        status: esim.status
      }
    });
  } catch (error) {
    console.error('Error in requestESIM:', error);
    res.status(500).json({ message: 'Error requesting eSIM', error: error.message });
  }
};

exports.getESIMStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const esim = await ESIM.findById(id);

    if (!esim) {
      return res.status(404).json({ message: 'eSIM not found' });
    }

    // Check if user owns this eSIM
    if (esim.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json(esim);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching eSIM status', error: error.message });
  }
};

exports.getESIMsByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const esims = await ESIM.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      message: 'eSIMs retrieved successfully',
      data: esims
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching eSIMs', error: error.message });
  }
};

// Helper functions
function generateActivationCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateICCID() {
  return '89' + Math.random().toString().substring(2, 21);
}