require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');


const DatabaseLoader = require('./loaders/database.loader');
const RoutesLoader = require('./loaders/routes.loader');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'output')));
app.use(express.static(path.join(__dirname, 'temp')));

// Initialize database and routes
DatabaseLoader.init();
RoutesLoader.initRoutes(app);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
});

// 404 handler
app.all('*', (req, res) => {
    res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => { 
  console.log(`
    🚀 Server ready at http://localhost:${PORT}
    ✨ Environment: ${process.env.NODE_ENV || 'development'}
    `);
  const touch_path = 'tmp/restart.txt';
  // Function to update the timestamp of the restart.txt file
  const touchRestartFile = () => {
    fs.utimesSync(touch_path, new Date(), new Date());
    //console.log('Restart signal sent');
  };
  touchRestartFile();
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});
