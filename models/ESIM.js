const mongoose = require('mongoose');

const esimSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  qrCodeData: {
    type: String,
    required: true
  },
  qrCodeImage: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'activated', 'deactivated', 'failed'],
    default: 'pending'
  },
  activationDate: Date,
  deactivatedAt: Date,
  iccid: String,
  activationCode: String,
  smdpPlusAddress: String
}, { timestamps: true });

module.exports = mongoose.model('ESIM', esimSchema);