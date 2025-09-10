const mongoose = require('mongoose');
require('dotenv').config();

const dbconnect = () => {
    mongoose.connect(process.env.DATABASE_URL)
    .then(()=>{console.log('connect ho gya')})
    .catch((error) =>{console.log(error)})
}

module.exports = dbconnect;