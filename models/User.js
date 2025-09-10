const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
   role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'  // ✅ Default value
  },
    resetPasswordToken: String,
  resetPasswordExpires: Date,
    kycStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
// userSchema.methods.comparePassword = async function (candidatePassword) {
//   return await bcrypt.compare(candidatePassword, this.password);
// };

userSchema.methods.comparePassword = async function (candidatePassword) {
  return candidatePassword === this.password;
};

module.exports = mongoose.model('User', userSchema);