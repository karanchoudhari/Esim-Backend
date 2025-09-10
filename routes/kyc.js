const express = require('express');
const router = express.Router();
// const auth = require('../middleware/auth');
const auth = require('../middleware/auth')
const { uploadKYC, getKYCStatus } = require('../controllers/kyc');

router.post('/upload', auth, uploadKYC);
router.get('/status', auth, getKYCStatus);

module.exports = router;