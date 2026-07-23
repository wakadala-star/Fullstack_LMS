const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Get children for a parent
router.get('/children', authenticateToken, authorizeRoles('parent'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar
       FROM users u
       INNER JOIN parent_student ps ON u.id = ps.student_id
       WHERE ps.parent_id = $1
       ORDER BY u.name`,
      [req.user.id]
    );
    res.json({ children: result.rows });
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link parent to student (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { parent_id, student_id } = req.body;

    if (!parent_id || !student_id) {
      return res.status(400).json({ error: 'parent_id and student_id are required' });
    }

    // Verify both users exist and have correct roles
    const parent = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [parent_id, 'parent']);
    if (parent.rows.length === 0) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const student = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [student_id, 'student']);
    if (student.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = await pool.query(
      `INSERT INTO parent_student (parent_id, student_id) VALUES ($1, $2)
       ON CONFLICT (parent_id, student_id) DO NOTHING RETURNING *`,
      [parent_id, student_id]
    );

    res.status(201).json({ link: result.rows[0] || { parent_id, student_id } });
  } catch (error) {
    console.error('Link parent-student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlink parent from student (admin only)
router.delete('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { parent_id, student_id } = req.body;

    if (!parent_id || !student_id) {
      return res.status(400).json({ error: 'parent_id and student_id are required' });
    }

    await pool.query(
      'DELETE FROM parent_student WHERE parent_id = $1 AND student_id = $2',
      [parent_id, student_id]
    );

    res.json({ message: 'Unlinked successfully' });
  } catch (error) {
    console.error('Unlink parent-student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all parent-student links (admin)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*, p.name as parent_name, p.email as parent_email,
              s.name as student_name, s.email as student_email
       FROM parent_student ps
       LEFT JOIN users p ON ps.parent_id = p.id
       LEFT JOIN users s ON ps.student_id = s.id
       ORDER BY p.name`
    );
    res.json({ links: result.rows });
  } catch (error) {
    console.error('Get links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
