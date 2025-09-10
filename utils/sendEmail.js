const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  try {
    // Create a transporter using Gmail
    const transporter = nodemailer.createTransport({   // ✅ correct function
      service: 'gmail',
      auth: {
        user: 'webdeveloper9354@gmail.com',
        pass: 'mnmx vuqp jybz zovx' // Your Gmail App Password
      }
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
