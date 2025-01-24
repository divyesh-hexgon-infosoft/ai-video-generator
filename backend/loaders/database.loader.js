require('dotenv').config();
const mongoose = require('mongoose'); // Import Mongoose

class DatabaseLoader {
    static init (){

        // Add Mongoose connection
        const uri = process.env.MONGODB_URI;
        mongoose.connect(uri)
            .then(() => {
                console.log('Connected to MongoDB with Mongoose');
            })
            .catch(error => console.error('Mongoose connection error:', error));
    }
}

module.exports = DatabaseLoader;