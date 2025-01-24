const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Get the token from the Authorization header
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  // Verify token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token.' });
    }
    req.userId = decoded.id; // Attach the decoded user ID to the request object
    next();
  });
};

module.exports = verifyToken;
