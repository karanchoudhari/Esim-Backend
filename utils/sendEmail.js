// // utils/sendEmail.js - UPDATED WORKING VERSION
// const nodemailer = require('nodemailer');

// // Multiple email service configurations with Render.com optimizations
// const emailConfigs = [
//   // Primary: Gmail with Render.com optimized settings
//   {
//     name: 'Gmail-Render',
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false,
//     auth: {
//       user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
//       pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
//     },
//     connectionTimeout: 15000, // 15 seconds max
//     greetingTimeout: 10000,
//     socketTimeout: 15000,
//     tls: {
//       rejectUnauthorized: false
//     }
//   },
//   // Fallback: Gmail SSL
//   {
//     name: 'Gmail-SSL',
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true,
//     auth: {
//       user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
//       pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
//     },
//     connectionTimeout: 15000,
//     socketTimeout: 15000,
//     tls: {
//       rejectUnauthorized: false
//     }
//   }
// ];

// const sendEmail = async (options) => {
//   let lastError = null;

//   for (const config of emailConfigs) {
//     let transporter = null;

//     try {
//       console.log(`🔧 Attempting ${config.name}...`);

//       // Create transporter
//       transporter = nodemailer.createTransport(config);

//       // Verify connection quickly
//       console.log(`🔍 Verifying ${config.name} connection...`);
//       await Promise.race([
//         transporter.verify(),
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error('Connection timeout')), 10000)
//         )
//       ]);

//       console.log(`✅ ${config.name} connected, sending email...`);

//       const mailOptions = {
//         from: `"eSIM Service" <${config.auth.user}>`,
//         to: options.to,
//         subject: options.subject,
//         html: options.html,
//         text: options.text || options.html?.replace(/<[^>]*>/g, '') || options.subject,
//         headers: {
//           'X-Priority': '1',
//           'Importance': 'high'
//         }
//       };

//       // Send email with timeout
//       const info = await Promise.race([
//         transporter.sendMail(mailOptions),
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error('Send timeout')), 15000)
//         )
//       ]);

//       console.log(`✅ Email sent successfully via ${config.name}`);
//       console.log(`📨 Message ID: ${info.messageId}`);

//       // Close connection
//       if (transporter) {
//         transporter.close();
//       }

//       return info;

//     } catch (error) {
//       lastError = error;
//       console.error(`❌ ${config.name} failed: ${error.message}`);

//       // Close connection on error
//       if (transporter) {
//         try {
//           transporter.close();
//         } catch (e) {
//           // Ignore close errors
//         }
//       }

//       // Continue to next configuration
//       continue;
//     }
//   }

//   // ALL configurations failed - use development fallback
//   console.error('💥 All email services failed');

//   // In production, we can't simulate success, but we'll provide better error handling
//   if (process.env.NODE_ENV === 'production') {
//     throw new Error(`Email service unavailable: ${lastError?.message || 'All configurations failed'}`);
//   } else {
//     // Development fallback - simulate success for testing
//     console.log('🔄 DEVELOPMENT: Simulating email success for testing');
//     console.log(`📧 To: ${options.to}`);
//     console.log(`📝 Subject: ${options.subject}`);

//     // Extract OTP from HTML for logging
//     const otpMatch = options.html?.match(/\d{6}/);
//     if (otpMatch) {
//       console.log(`🔐 Simulated OTP: ${otpMatch[0]}`);
//     }

//     return {
//       messageId: 'simulated-' + Date.now(),
//       response: 'Email simulated in development mode'
//     };
//   }
// };

// module.exports = sendEmail;

const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  try {
    // Create a transporter using Gmail
    const transporter = nodemailer.createTransport({   // ✅ correct function
      // service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    }
      // auth: {
      //   user: 'webdeveloper9354@gmail.com',
      //   pass: 'mnmx vuqp jybz zovx' // Your Gmail App Password
      // }
    });

    // Define email options
    const mailOptions = {
      from: 'webdeveloper9354@gmail.com',
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    // console.log('✅ Email sent: ', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email: ', error);
    throw new Error('Email could not be sent');
  }
};

module.exports = sendEmail;
