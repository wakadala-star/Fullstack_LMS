const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Clock in (teacher only)
router.post('/clock-in', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if already clocked in
    const existing = await pool.query(
      "SELECT id FROM clock_entries WHERE user_id = $1 AND status = 'clocked_in'",
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already clocked in' });
    }

    const clockInMs = Date.now();
    const result = await pool.query(
      'INSERT INTO clock_entries (user_id, clock_in_ms, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, clockInMs, 'clocked_in']
    );

    res.status(201).json({ message: 'Clocked in successfully', entry: result.rows[0] });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clock out (teacher only)
router.post('/clock-out', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;

    const existing = await pool.query(
      "SELECT id, clock_in_ms FROM clock_entries WHERE user_id = $1 AND status = 'clocked_in' ORDER BY id DESC LIMIT 1",
      [userId]
    );
    if (existing.rows.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found' });
    }

    const entry = existing.rows[0];
    const clockOutMs = Date.now();
    const totalHours = Math.round(((clockOutMs - entry.clock_in_ms) / (1000 * 60 * 60)) * 100) / 100;

    const result = await pool.query(
      'UPDATE clock_entries SET clock_out_ms = $1, total_hours = $2, status = $3 WHERE id = $4 RETURNING *',
      [clockOutMs, totalHours, 'clocked_out', entry.id]
    );

    res.json({ message: 'Clocked out successfully', entry: result.rows[0] });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current clock status (teacher only)
router.get('/status', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      "SELECT * FROM clock_entries WHERE user_id = $1 AND status = 'clocked_in' ORDER BY id DESC LIMIT 1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ status: 'clocked_out', entry: null });
    }

    res.json({ status: 'clocked_in', entry: result.rows[0] });
  } catch (error) {
    console.error('Clock status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all timesheets (admin only)
router.get('/timesheets', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ce.id,
        ce.user_id,
        u.name as teacher_name,
        u.email as teacher_email,
        ce.clock_in_ms,
        ce.clock_out_ms,
        ce.total_hours,
        ce.status,
        ce.created_at
      FROM clock_entries ce
      JOIN users u ON ce.user_id = u.id
      ORDER BY ce.clock_in_ms DESC
    `);

    res.json({ timesheets: result.rows });
  } catch (error) {
    console.error('Get timesheets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's own timesheets
router.get('/my-timesheets', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM clock_entries WHERE user_id = $1 ORDER BY clock_in_ms DESC',
      [userId]
    );

    res.json({ timesheets: result.rows });
  } catch (error) {
    console.error('Get my timesheets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
