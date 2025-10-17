const nodemailer = require('nodemailer');

// Email service configurations
const emailConfigs = [
  // Gmail configuration
  {
    name: 'Gmail',
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    }
  },
  // Gmail with alternative settings
  {
    name: 'Gmail-Secure',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  // Gmail with SSL
  {
    name: 'Gmail-SSL',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    },
    tls: {
      rejectUnauthorized: false
    }
  }
];

const sendEmail = async (options) => {
  let lastError = null;
  
  // Try each email configuration
  for (const config of emailConfigs) {
    let transporter;
    
    try {
      console.log(`🔧 Trying ${config.name} configuration...`);
      console.log('📧 Sending to:', options.to);
      console.log('📝 Subject:', options.subject);
      
      // Create transporter
      transporter = nodemailer.createTransport({
        ...config,
        pool: true,
        maxConnections: 1,
        maxMessages: 5,
        debug: process.env.NODE_ENV === 'production' // Enable debug in production
      });

      // Verify transporter configuration
      console.log(`🔍 Verifying ${config.name} transporter...`);
      await transporter.verify();
      console.log(`✅ ${config.name} transporter verified successfully`);

      // Define email options
      const mailOptions = {
        from: `"eSIM Service" <${config.auth.user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject.replace(/<[^>]*>/g, ''),
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      };
      
      console.log(`📤 Sending email via ${config.name}...`);
      
      // Send email with timeout
      const sendPromise = transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
      });
      
      const info = await Promise.race([sendPromise, timeoutPromise]);
      
      console.log(`✅ Email sent successfully via ${config.name}:`, info.messageId);
      console.log('📨 Response:', info.response);
      
      return info;
      
    } catch (error) {
      lastError = error;
      console.error(`❌ ${config.name} failed:`, error.message);
      console.error(`❌ Error code:`, error.code);
      console.error(`❌ Error command:`, error.command);
      
      // Close transporter if it exists
      if (transporter) {
        transporter.close();
      }
      
      // Continue to next configuration
      continue;
    }
  }
  
  // If all configurations failed
  console.error('💥 All email configurations failed');
  throw new Error(`All email services failed. Last error: ${lastError.message}`);
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
