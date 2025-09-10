const User = require('../models/User');
const KYC = require('../models/KYC');
const ESIM = require('../models/ESIM');
const { simulateSMDP } = require('../services/smdpService');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// ADD THIS FUNCTION - Get all KYC submissions
exports.getKYCSubmissions = async (req, res) => {
  try {
    const kycSubmissions = await KYC.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json(kycSubmissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching KYC submissions', error: error.message });
  }
};

exports.approveKYC = async (req, res) => {
  try {
    const { kycId } = req.params; // Change from userId to kycId
    const { status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Update KYC status using KYC ID
    const kyc = await KYC.findByIdAndUpdate(
      kycId, // Use kycId instead of finding by userId
      { status },
      { new: true }
    );
    
    if (!kyc) {
      return res.status(404).json({ message: 'KYC record not found' });
    }
    
    // Update user KYC status
    await User.findByIdAndUpdate(
      kyc.userId, // Use the userId from the KYC document
      { kycStatus: status },
      { new: true }
    );
    
    res.status(200).json({ message: `KYC ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error updating KYC status', error: error.message });
  }
};

exports.getESIMRequests = async (req, res) => {
  try {
    const esims = await ESIM.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json(esims);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching eSIM requests', error: error.message });
  }
};

// In your admin controller - updateESIMStatus function
exports.updateESIMStatus = async (req, res) => {
  try {
    const { esimId } = req.params;
    const { status } = req.body;
    
    if (!['activated', 'failed', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const esim = await ESIM.findById(esimId).populate('userId', 'name email');
    
    if (!esim) {
      return res.status(404).json({ message: 'eSIM not found' });
    }
    
    // Update status
    esim.status = status;
    
    // If approved, set activation date, update QR code with personalized message, and simulate SMDP
    if (status === 'activated') {
      const QRCode = require('qrcode');
      
      // Create personalized message
      const personalizedMessage = `Thank you ${esim.userId.name}! Your eSIM has been activated. Enjoy seamless connectivity with our services.`;
      const updatedQrCodeData = `LPA:1$${esim.smdpPlusAddress}$${esim.activationCode}\n\n${personalizedMessage}`;
      
      // Regenerate QR code image with personalized message
      const updatedQrCodeImage = await QRCode.toDataURL(updatedQrCodeData, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1,
        type: 'image/png'
      });
      
      // Update eSIM with new QR code data
      esim.qrCodeData = updatedQrCodeData;
      esim.qrCodeImage = updatedQrCodeImage;
      esim.activationDate = new Date();
      
      await esim.save();
      
      // Simulate the SMDP process for activation
      simulateSMDP(esim._id);
    } else if (status === 'failed') {
      esim.activationDate = null;
      await esim.save();
    } else {
      await esim.save();
    }
    
    res.status(200).json({
      message: `eSIM status updated to ${status} successfully`,
      esim
    });
    
  } catch (error) {
    console.error('Error updating eSIM status:', error);
    res.status(500).json({ message: 'Error updating eSIM status', error: error.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const adminUser = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });

    res.status(200).json({
      message: "Admin user created successfully",
      data: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Admin creation failed',
      error: error.message
    });
  }
};