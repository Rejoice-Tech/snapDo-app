const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database');

const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    db.get(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username],
      async (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (row) {
          return res.status(400).json({ error: 'User already exists' });
        }

        try {
          // Hash password
          const saltRounds = 10;
          const passwordHash = await bcrypt.hash(password, saltRounds);

          // Insert new user
          db.run(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to create user' });
              }

              // Generate JWT token
              const token = jwt.sign(
                { userId: this.lastID, username, email },
                JWT_SECRET,
                { expiresIn: '24h' }
              );

              res.status(201).json({
                message: 'User created successfully',
                token,
                user: {
                  id: this.lastID,
                  username,
                  email
                }
              });
            }
          );
        } catch (hashError) {
          res.status(500).json({ error: 'Failed to process password' });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        try {
          // Compare password
          const isValidPassword = await bcrypt.compare(password, user.password_hash);

          if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }

          // Generate JWT token
          const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.json({
            message: 'Login successful',
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email
            }
          });
        } catch (compareError) {
          res.status(500).json({ error: 'Failed to verify password' });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Protected route to get user profile
router.get('/profile', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    }
  );
});

module.exports = { router, authenticateToken };
