const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simple login
router.post('/login', (req, res) => {
  const { appKey } = req.body;

  if (appKey !== 'MY_PRIVATE_APP_KEY') {
    return res.status(401).json({ message: 'Invalid key' });
  }

  const token = jwt.sign(
    { app: 'mobile-desktop' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

module.exports = router;
