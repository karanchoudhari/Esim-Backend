const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;
  
  try {
    console.log('🔧 Creating email transporter...');
    console.log('📧 Sending to:', options.to);
    console.log('📝 Subject:', options.subject);
    
    // Use environment variables for production
    const emailUser = process.env.EMAIL_USER || 'webdeveloper9354@gmail.com';
    const emailPass = process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx';
    
    console.log('🔐 Using email:', emailUser);
    
    // Create a transporter using Gmail with enhanced options
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      },
      // Enhanced settings for production
      pool: true,
      maxConnections: 1,
      maxMessages: 5,
      rateDelta: 1000,
      rateLimit: 5,
      // Additional security settings
      secure: true,
      tls: {
        rejectUnauthorized: false
      },
      debug: true // Enable debug for troubleshooting
    });

    // Verify transporter configuration
    console.log('🔍 Verifying email transporter...');
    await transporter.verify();
    console.log('✅ Email transporter verified successfully');

    // Define email options with better formatting
    const mailOptions = {
      from: `"eSIM Service" <${emailUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      // Add text version as fallback
      text: options.text || options.subject.replace(/<[^>]*>/g, ''),
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
      setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
    });
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    
    console.log('✅ Email sent successfully: ', info.messageId);
    console.log('📨 Response:', info.response);
    
    return info;
    
  } catch (error) {
    console.error('❌ Detailed email error:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error command:', error.command);
    
    // More specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check your email credentials in environment variables.');
    } else if (error.code === 'ECONNECTION') {
      throw new Error('Unable to connect to email service. Please check your internet connection.');
    } else if (error.code === 'EENVELOPE') {
      throw new Error('Invalid email address or envelope configuration.');
    } else if (error.message.includes('timeout')) {
      throw new Error('Email service timeout. Please try again.');
    } else if (error.code === 'EMESSAGE') {
      throw new Error('Message configuration error. Please check the email content.');
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
