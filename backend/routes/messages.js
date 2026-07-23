const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Heartbeat - update online status
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query(
      `INSERT INTO online_users (user_id, last_seen) VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW()`,
      [userId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all staff with online status and last message
router.get('/users', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let query;
    let params;

    if (role === 'admin') {
      // Admin sees all teachers + other admins
      query = `
        SELECT 
          u.id, u.name, u.email, u.role, u.avatar,
          CASE 
            WHEN ou.last_seen IS NOT NULL AND ou.last_seen > NOW() - INTERVAL '5 minutes' THEN true
            ELSE false
          END as is_online,
          (
            SELECT message FROM messages 
            WHERE (sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1)
            ORDER BY created_at DESC LIMIT 1
          ) as last_message,
          (
            SELECT created_at FROM messages 
            WHERE (sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1)
            ORDER BY created_at DESC LIMIT 1
          ) as last_message_at,
          (
            SELECT COUNT(*) FROM messages 
            WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false
          ) as unread_count
        FROM users u
        LEFT JOIN online_users ou ON u.id = ou.user_id
        WHERE u.id != $1 AND u.role IN ('admin', 'teacher')
        ORDER BY 
          CASE WHEN ou.last_seen IS NOT NULL AND ou.last_seen > NOW() - INTERVAL '5 minutes' THEN 0 ELSE 1 END,
          u.name ASC
      `;
      params = [userId];
    } else {
      // Teacher sees admin + other teachers
      query = `
        SELECT 
          u.id, u.name, u.email, u.role, u.avatar,
          CASE 
            WHEN ou.last_seen IS NOT NULL AND ou.last_seen > NOW() - INTERVAL '5 minutes' THEN true
            ELSE false
          END as is_online,
          (
            SELECT message FROM messages 
            WHERE (sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1)
            ORDER BY created_at DESC LIMIT 1
          ) as last_message,
          (
            SELECT created_at FROM messages 
            WHERE (sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1)
            ORDER BY created_at DESC LIMIT 1
          ) as last_message_at,
          (
            SELECT COUNT(*) FROM messages 
            WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false
          ) as unread_count
        FROM users u
        LEFT JOIN online_users ou ON u.id = ou.user_id
        WHERE u.id != $1 AND u.role IN ('admin', 'teacher')
        ORDER BY 
          CASE WHEN ou.last_seen IS NOT NULL AND ou.last_seen > NOW() - INTERVAL '5 minutes' THEN 0 ELSE 1 END,
          u.name ASC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get online users count and avatars
router.get('/online', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.avatar
      FROM online_users ou
      JOIN users u ON ou.user_id = u.id
      WHERE ou.last_seen > NOW() - INTERVAL '5 minutes'
        AND u.role IN ('admin', 'teacher')
      ORDER BY u.name
    `);
    res.json({ online: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation with a specific user
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId);

    const result = await pool.query(`
      SELECT m.*, 
        sender.name as sender_name,
        receiver.name as receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [myId, otherId]);

    // Mark messages from the other user as read
    await pool.query(
      'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
      [otherId, myId]
    );

    // Get other user info
    const userResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar,
        CASE WHEN ou.last_seen IS NOT NULL AND ou.last_seen > NOW() - INTERVAL '5 minutes' THEN true ELSE false END as is_online
       FROM users u
       LEFT JOIN online_users ou ON u.id = ou.user_id
       WHERE u.id = $1`,
      [otherId]
    );

    res.json({
      messages: result.rows,
      user: userResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !message || !message.trim()) {
      return res.status(400).json({ error: 'Receiver and message are required' });
    }

    const result = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING *',
      [senderId, receiverId, message.trim()]
    );

    // Create notification for receiver
    const senderResult = await pool.query('SELECT name FROM users WHERE id = $1', [senderId]);
    const senderName = senderResult.rows[0]?.name || 'Someone';

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'info', 'New Message', $2)`,
      [receiverId, `${senderName} sent you a message: "${message.trim().substring(0, 50)}${message.trim().length > 50 ? '...' : ''}"`]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversations list (grouped by other user)
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT DISTINCT ON (other_id)
        other_id,
        u.name AS other_name,
        u.email AS other_email,
        u.avatar AS other_avatar,
        u.role AS other_role,
        sub.message AS last_message,
        sub.created_at AS last_message_at,
        sub.unread_count
      FROM (
        SELECT
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_id,
          message,
          created_at,
          (
            SELECT COUNT(*) FROM messages m2
            WHERE m2.sender_id = messages.sender_id
              AND m2.receiver_id = $1
              AND m2.is_read = false
          ) AS unread_count
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
        ORDER BY created_at DESC
      ) sub
      JOIN users u ON u.id = sub.other_id
      ORDER BY other_id, sub.created_at DESC
    `, [userId]);
    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread message count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = false',
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
