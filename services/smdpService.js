const ESIM = require('../models/ESIM');

async function simulateSMDP(esimId) {
  try {
    // Simulate processing delay (30 seconds to 2 minutes)
    const delay = Math.floor(Math.random() * 90000) + 30000;
    
    setTimeout(async () => {
      try {
        const esim = await ESIM.findById(esimId);
        if (!esim) return;
        
        // Randomly determine success (80%) or failure (20%)
        const success = Math.random() < 0.8;
        
        if (success) {
          esim.status = 'activated';
          esim.activationDate = new Date();
          await esim.save();
          // console.log(`eSIM ${esimId} activated successfully`);
        } else {
          esim.status = 'failed';
          await esim.save();
          // console.log(`eSIM ${esimId} activation failed`);
        }
      } catch (error) {
        console.error('Error in SM-DP+ simulation:', error);
      }
    }, delay);
  } catch (error) {
    console.error('Error setting up SM-DP+ simulation:', error);
  }
}

module.exports = { simulateSMDP };