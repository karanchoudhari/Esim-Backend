const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { 
  getUsers, 
  approveKYC, 
  getESIMRequests, 
  updateESIMStatus,
  getKYCSubmissions, // ADD THIS
  createAdmin
} = require('../controllers/admin');

router.get('/users', adminAuth, getUsers);
router.get('/kyc-submissions', adminAuth, getKYCSubmissions); // ADD THIS ROUTE
router.put('/kyc/:kycId', adminAuth, approveKYC);
router.get('/esim-requests', adminAuth, getESIMRequests);
router.put('/esim/:esimId', adminAuth, updateESIMStatus);
router.post('/createadmin', createAdmin);

module.exports = router;