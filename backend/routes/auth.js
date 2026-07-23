const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  findUserByEmail,
  findUserByName,
  findUserByToken,
  createUser,
  createUserWithToken,
  findUserById,
  getAllUsers,
  updateUserStatus,
  createNotification,
  getNotificationsByUserId,
  markNotificationRead,
  getUnreadNotificationCount,
  getAdminUserIds,
  createFeedback,
  getPublicFeedback,
} = require('../config/db');
const { logAuthEvent } = require('../middleware/logger');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/security');
const { cache, invalidateCache } = require('../middleware/memory');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const generateLoginToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  token += '-';
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Student self-registration
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

    const newUser = await createUser(sanitizedName, sanitizedEmail, hashedPassword, 'student');

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
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email/password login (students and admin)
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

    // Teachers and parents cannot use email/password login
    if (user.role === 'teacher' || user.role === 'parent') {
      logAuthEvent('LOGIN', sanitizedEmail, false);
      return res.status(401).json({ error: 'Teachers and parents must use token login' });
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      logAuthEvent('LOGIN', sanitizedEmail, false);
      return res.status(403).json({ error: 'Account has been suspended. Contact administrator.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logAuthEvent('LOGIN', sanitizedEmail, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    cache.set(`user_id_${user.id}`, { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at }, 600);

    logAuthEvent('LOGIN', sanitizedEmail, true);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Token login (teachers and parents)
router.post('/token-login', authLimiter, async (req, res) => {
  try {
    const { name, token } = req.body;

    if (!name || !token) {
      return res.status(400).json({ error: 'Name and token are required' });
    }

    if (typeof name !== 'string' || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    const sanitizedName = name.trim();
    const sanitizedToken = token.trim().toUpperCase();

    const user = await findUserByName(sanitizedName);

    if (!user) {
      logAuthEvent('TOKEN_LOGIN', sanitizedName, false);
      return res.status(401).json({ error: 'Invalid name or token' });
    }

    if (user.token !== sanitizedToken) {
      logAuthEvent('TOKEN_LOGIN', sanitizedName, false);
      return res.status(401).json({ error: 'Invalid name or token' });
    }

    if (user.role !== 'teacher' && user.role !== 'parent') {
      return res.status(401).json({ error: 'Token login only available for teachers and parents' });
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      logAuthEvent('TOKEN_LOGIN', sanitizedName, false);
      return res.status(403).json({ error: 'Account has been suspended. Contact administrator.' });
    }

    const jwtToken = generateToken(user);

    cache.set(`user_id_${user.id}`, { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at }, 600);

    logAuthEvent('TOKEN_LOGIN', sanitizedName, true);

    res.json({
      message: 'Login successful',
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Token login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: create teacher or parent
router.post('/create-user', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['teacher', 'parent'].includes(role)) {
      return res.status(400).json({ error: 'Role must be teacher or parent' });
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedName = name.trim();

    const existingUser = await findUserByEmail(sanitizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const loginToken = generateLoginToken();

    const newUser = await createUserWithToken(sanitizedName, sanitizedEmail, hashedPassword, role, loginToken);

    invalidateCache('user');

    logAuthEvent('CREATE_USER', sanitizedEmail, true, `Role: ${role}, Created by: ${req.user.email}`);

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        token: newUser.token,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: list all users
router.get('/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: update user status (suspend/activate)
router.patch('/users/:id/status', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or suspended' });
    }

    const user = await updateUserStatus(id, status);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logAuthEvent('UPDATE_STATUS', user.email, true, `Status: ${status}, By: ${req.user.email}`);

    res.json({ message: `User ${status === 'suspended' ? 'suspended' : 'activated'} successfully`, user });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all staff (admin + teacher) for messaging
router.get('/staff', authenticateToken, async (req, res) => {
  try {
    const result = await require('../config/db').pool.query(
      "SELECT id, name, email, role, avatar FROM users WHERE role IN ('admin', 'teacher') ORDER BY name"
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
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
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile (name, phone, avatar)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const userId = req.user.id;

    // Fetch current user data for comparison
    const currentUser = await findUserById(userId);

    if (name && (name.trim().length < 2 || name.trim().length > 100)) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    }

    if (phone && phone.length > 20) {
      return res.status(400).json({ error: 'Phone number is too long' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone || null);
    }
    if (avatar !== undefined) {
      updates.push(`avatar = $${paramIndex++}`);
      values.push(avatar || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, role, phone, avatar, created_at`;
    const result = await require('../config/db').pool.query(query, values);

    const updatedUser = result.rows[0];
    invalidateCache('user');

    // Notify admins about profile changes (only actual changes)
    const changedFields = [];
    if (name && name.trim() !== currentUser.name) changedFields.push('name');
    if (phone !== undefined && phone !== (currentUser.phone || '')) changedFields.push('phone number');
    if (avatar !== undefined && avatar !== currentUser.avatar && avatar !== null) changedFields.push('profile picture');

    if (changedFields.length > 0) {
      try {
        const adminIds = await getAdminUserIds();
        const updaterName = currentUser.name || currentUser.email;
        const notifTitle = 'Profile Updated';
        const notifMessage = `${updaterName} updated their ${changedFields.join(' and ')}`;
        for (const adminId of adminIds) {
          if (adminId !== userId) {
            await createNotification(adminId, notifTitle, notifMessage, 'info');
          }
        }
      } catch (notifErr) {
        console.error('Failed to create profile update notification:', notifErr);
      }
    }

    logAuthEvent('UPDATE_PROFILE', req.user.email, true);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({ error: 'New password is too long' });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await require('../config/db').pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    logAuthEvent('CHANGE_PASSWORD', req.user.email, true);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notifications for current user
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await getNotificationsByUserId(req.user.id);
    const unreadCount = await getUnreadNotificationCount(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notifId = parseInt(req.params.id);
    const result = await markNotificationRead(notifId, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit feedback (requires auth for real user name)
router.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const user = await findUserById(req.user.id);
    const name = user ? user.name : 'Anonymous';
    const role = user ? user.role : 'student';

    const feedback = await createFeedback(req.user.id, name, role, rating, comment);
    res.status(201).json({ message: 'Thank you for your feedback!', feedback });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public feedback (for landing page)
router.get('/feedback/public', async (req, res) => {
  try {
    const feedback = await getPublicFeedback(10);
    res.json({ feedback });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
