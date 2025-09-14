const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const userRoute = require('./routes/user');
const kycRoute = require('./routes/kyc.js');
const esimRoute = require('./routes/esim.js');
const adminRoute = require('./routes/admin.js');
const dbConnect = require('./config/database');

require('dotenv').config();
const PORT = process.env.PORT || 4000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middlewares
app.use(cors({
  origin: ["https://esim1.netlify.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB Connect
dbConnect();

// Routes
app.use('/api/v1/user', userRoute);
app.use('/api/v1/kyc', upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), kycRoute);
app.use('/api/v1/esim', esimRoute);
app.use('/api/v1/admin', adminRoute);


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});