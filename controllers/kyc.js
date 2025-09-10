const KYC = require('../models/KYC');
const User = require('../models/User');

exports.uploadKYC = async (req, res) => {
  try {
    const { idType, idNumber } = req.body;
    const userId = req.user.id;
    
    // Check if user already has a KYC submission
    const existingKYC = await KYC.findOne({ userId });
    
    const kycData = {
      userId,
      idType,
      idNumber,
      idFront: req.files.idFront[0].filename,
      idBack: req.files.idBack[0].filename,
      addressProof: req.files.addressProof[0].filename,
      selfie: req.files.selfie[0].filename,
      status: 'pending'
    };
    if (!req.files.idFront || !req.files.idBack || !req.files.addressProof || !req.files.selfie) {
  return res.status(400).json({ message: 'All document files are required' });
}
    if (existingKYC) {
      // Update existing KYC
      await KYC.findByIdAndUpdate(existingKYC._id, kycData);
    } else {
      // Create new KYC
      await KYC.create(kycData);
    }
    
    // Update user KYC status
    await User.findByIdAndUpdate(userId, { kycStatus: 'pending' });

    res.status(200).json({ 
      message: 'KYC documents uploaded successfully', 
      kycStatus: 'pending' 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading KYC documents', error: error.message });
  }
};
exports.getKYCStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const kyc = await KYC.findOne({ userId });
    
    if (!kyc) {
      return res.status(200).json({ 
        kycStatus: 'pending', 
        kycDetails: null 
      });
    }
    
    res.status(200).json({
      kycStatus: kyc.status, // Use the status from KYC document
      kycDetails: kyc
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching KYC status', error: error.message });
  }
};