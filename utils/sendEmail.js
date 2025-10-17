const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;
  
  try {
    console.log('🔧 Creating email transporter...');
    console.log('📧 Sending to:', options.to);
    console.log('📝 Subject:', options.subject);
    
    // Create a transporter using Gmail with enhanced options
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
        pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx' // Your Gmail App Password
      },
      // Enhanced settings for better reliability
      pool: true,
      maxConnections: 1,
      maxMessages: 5,
      rateDelta: 1000,
      rateLimit: 5
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log('✅ Email transporter verified successfully');

    // Define email options with better formatting
    const mailOptions = {
      from: `"eSIM Service" <${process.env.EMAIL_USER || 'webdeveloper9354@gmail.com'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      // Add text version as fallback
      text: options.text || options.subject,
      // Priority headers
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };
    
    console.log('📤 Sending email...');
    
    // Send email with timeout
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout')), 30000);
    });
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    
    console.log('✅ Email sent successfully: ', info.messageId);
    console.log('📨 Response:', info.response);
    
    return info;
    
  } catch (error) {
    console.error('❌ Detailed email error:', error);
    
    // More specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Check email credentials.');
    } else if (error.code === 'ECONNECTION') {
      throw new Error('Email connection failed. Check network connectivity.');
    } else if (error.message === 'Email sending timeout') {
      throw new Error('Email service timeout. Please try again.');
    } else {
      throw new Error(`Email service error: ${error.message}`);
    }
  } finally {
    // Close transporter if it exists
    if (transporter) {
      transporter.close();
    }
  }
};

module.exports = sendEmail;

// const nodemailer = require('nodemailer');

// const sendEmail = async (options) => {
//   try {
//     // Create a transporter using Gmail
//     const transporter = nodemailer.createTransport({   // ✅ correct function
//       service: 'gmail',
//       auth: {
//         user: 'webdeveloper9354@gmail.com',
//         pass: 'mnmx vuqp jybz zovx' // Your Gmail App Password
//       }
//     });
    
//     // Define email options
//     const mailOptions = {
//       from: 'webdeveloper9354@gmail.com',
//       to: options.to,
//       subject: options.subject,
//       html: options.html
//     };
    
//     // Send email
//     const info = await transporter.sendMail(mailOptions);
//     // console.log('✅ Email sent: ', info.messageId);
//     return info;
//   } catch (error) {
//     console.error('❌ Error sending email: ', error);
//     throw new Error('Email could not be sent');
//   }
// };

// module.exports = sendEmail;
