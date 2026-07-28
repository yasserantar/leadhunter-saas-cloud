const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ success: false, error: 'No token provided.' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'secretkey');
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    console.error('[verifyToken] JWT Verification Failure:', err.message);
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Require Admin Role!' });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin };
