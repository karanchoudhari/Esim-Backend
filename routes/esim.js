const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requestESIM, getESIMStatus, getESIMsByUser, sendEmailOTP, verifyEmailOTP, resendEmailOTP } = require('../controllers/esim');

router.post('/request', auth, requestESIM);
router.post('/send-email-otp', auth, sendEmailOTP);
router.post('/verify-email-otp', auth, verifyEmailOTP);
router.post('/resend-email-otp', auth, resendEmailOTP);
router.get('/status/:id', auth, getESIMStatus);
router.get('/user', auth, getESIMsByUser);

module.exports = router;