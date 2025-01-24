const mongoose = require('mongoose'); // Import Mongoose

// Define the User schema
const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
        unique: true, // Ensure usernames are unique
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Ensure emails are unique
        match: /.+\@.+\..+/ // Basic email validation
    }
}, { timestamps: true }); // Automatically manage createdAt and updatedAt fields

// Create the User model
const User = mongoose.model('User', userSchema);


module.exports = User; // Export the User model

