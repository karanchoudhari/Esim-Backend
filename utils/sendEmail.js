const nodemailer = require('nodemailer');

// Email service configurations with optimized timeouts
const emailConfigs = [
  // Primary: Gmail with optimized settings
  {
    name: 'Gmail-Optimized',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    },
    connectionTimeout: 15000, // 15 seconds connection timeout
    greetingTimeout: 15000,   // 15 seconds greeting timeout
    socketTimeout: 30000,     // 30 seconds socket timeout
    tls: {
      rejectUnauthorized: false
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 5
  },
  // Fallback: Gmail with SSL
  {
    name: 'Gmail-SSL',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false
    }
  },
  // Emergency: Gmail with service shortcut
  {
    name: 'Gmail-Service',
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'webdeveloper9354@gmail.com',
      pass: process.env.EMAIL_PASS || 'mnmx vuqp jybz zovx'
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  }
];

const sendEmail = async (options) => {
  let lastError = null;
  let attempt = 0;
  
  // Try each email configuration
  for (const config of emailConfigs) {
    attempt++;
    let transporter = null;
    
    try {
      console.log(`📧 Email attempt ${attempt}/${emailConfigs.length}`);
      console.log(`🔧 Trying ${config.name} configuration...`);
      console.log('📧 Sending to:', options.to);
      console.log('📝 Subject:', options.subject);
      
      // Create transporter with timeout settings
      transporter = nodemailer.createTransport({
        ...config,
        debug: process.env.NODE_ENV !== 'production', // Debug in development only
        logger: process.env.NODE_ENV !== 'production'
      });

      // Verify transporter with shorter timeout
      console.log(`🔍 Verifying ${config.name} transporter...`);
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Transporter verification timeout after 10 seconds')), 10000);
        })
      ]);
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
      
      // Send email with aggressive timeout
      const sendPromise = transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout after 20 seconds')), 20000);
      });
      
      const info = await Promise.race([sendPromise, timeoutPromise]);
      
      console.log(`✅ Email sent successfully via ${config.name}`);
      console.log('📨 Message ID:', info.messageId);
      
      // Close transporter
      if (transporter) {
        transporter.close();
      }
      
      return info;
      
    } catch (error) {
      lastError = error;
      console.error(`❌ ${config.name} failed:`, error.message);
      
      // Close transporter if it exists
      if (transporter) {
        try {
          transporter.close();
        } catch (closeError) {
          console.error('Error closing transporter:', closeError.message);
        }
      }
      
      // If this is the last attempt, throw the error
      if (attempt === emailConfigs.length) {
        break;
      }
      
      // Wait briefly before trying next configuration
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // If all configurations failed
  const errorMessage = `All email services failed after ${attempt} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
  console.error('💥', errorMessage);
  throw new Error(errorMessage);
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
