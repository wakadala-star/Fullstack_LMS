const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUserByEmail, createUser, findUserById } = require('../config/db');
const { logAuthEvent } = require('../middleware/logger');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/security');
const { cache, invalidateCache } = require('../middleware/memory');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (password.length > 128) {
      return res.status(400).json({ error: 'Password is too long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedName = name.trim();

    const existingUser = await findUserByEmail(sanitizedEmail);
    if (existingUser) {
      logAuthEvent('REGISTER', sanitizedEmail, false);
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await createUser(sanitizedName, sanitizedEmail, hashedPassword);

    invalidateCache('user');

    const token = generateToken(newUser);

    logAuthEvent('REGISTER', sanitizedEmail, true);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    if (email.length > 255 || password.length > 128) {
      return res.status(400).json({ error: 'Input too long' });
    }

    const sanitizedEmail = email.toLowerCase().trim();

    const user = await findUserByEmail(sanitizedEmail);

    if (!user) {
      logAuthEvent('LOGIN', sanitizedEmail, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logAuthEvent('LOGIN', sanitizedEmail, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    cache.set(`user_id_${user.id}`, { id: user.id, name: user.name, email: user.email, created_at: user.created_at }, 600);

    logAuthEvent('LOGIN', sanitizedEmail, true);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    let user = cache.get(`user_id_${req.user.id}`);
    if (!user) {
      user = await findUserById(req.user.id);
      if (user) {
        cache.set(`user_id_${req.user.id}`, user, 600);
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
