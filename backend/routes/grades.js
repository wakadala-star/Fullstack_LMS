const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Get grades (filtered by role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query, params = [];

    if (req.user.role === 'student') {
      query = `SELECT g.*, c.name as course_name, c.code as course_code, u.name as student_name
               FROM grades g
               LEFT JOIN courses c ON g.course_id = c.id
               LEFT JOIN users u ON g.student_id = u.id
               WHERE g.student_id = $1
               ORDER BY g.created_at DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'teacher') {
      query = `SELECT g.*, c.name as course_name, c.code as course_code, u.name as student_name
               FROM grades g
               LEFT JOIN courses c ON g.course_id = c.id
               LEFT JOIN users u ON g.student_id = u.id
               WHERE c.instructor_id = $1
               ORDER BY g.created_at DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'parent') {
      query = `SELECT g.*, c.name as course_name, c.code as course_code, u.name as student_name
               FROM grades g
               LEFT JOIN courses c ON g.course_id = c.id
               LEFT JOIN users u ON g.student_id = u.id
               WHERE g.student_id IN (SELECT student_id FROM parent_student WHERE parent_id = $1)
               ORDER BY g.created_at DESC`;
      params = [req.user.id];
    } else {
      query = `SELECT g.*, c.name as course_name, c.code as course_code, u.name as student_name
               FROM grades g
               LEFT JOIN courses c ON g.course_id = c.id
               LEFT JOIN users u ON g.student_id = u.id
               ORDER BY g.created_at DESC`;
    }

    const result = await pool.query(query, params);
    res.json({ grades: result.rows });
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create grade (teacher/admin)
router.post('/', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { student_id, course_id, assessment_type, assessment_name, score, max_score, term } = req.body;

    if (!student_id || !course_id || !assessment_type || !assessment_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const maxScore = max_score || 100;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    let letterGrade = 'F';
    if (percentage >= 90) letterGrade = 'A';
    else if (percentage >= 80) letterGrade = 'B';
    else if (percentage >= 70) letterGrade = 'C';
    else if (percentage >= 60) letterGrade = 'D';

    const result = await pool.query(
      `INSERT INTO grades (student_id, course_id, assessment_type, assessment_name, score, max_score, percentage, letter_grade, term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [student_id, course_id, assessment_type, assessment_name, score, maxScore, percentage, letterGrade, term || null]
    );

    res.status(201).json({ grade: result.rows[0] });
  } catch (error) {
    console.error('Create grade error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update grade (teacher/admin)
router.put('/:id', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { score, max_score, assessment_name, assessment_type, term } = req.body;

    const existing = await pool.query('SELECT * FROM grades WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    const maxScore = max_score || existing.rows[0].max_score;
    const newScore = score !== undefined ? score : existing.rows[0].score;
    const percentage = maxScore > 0 ? Math.round((newScore / maxScore) * 100) : 0;

    let letterGrade = 'F';
    if (percentage >= 90) letterGrade = 'A';
    else if (percentage >= 80) letterGrade = 'B';
    else if (percentage >= 70) letterGrade = 'C';
    else if (percentage >= 60) letterGrade = 'D';

    const result = await pool.query(
      `UPDATE grades SET score = $1, max_score = $2, percentage = $3, letter_grade = $4,
       assessment_name = COALESCE($5, assessment_name), assessment_type = COALESCE($6, assessment_type),
       term = COALESCE($7, term)
       WHERE id = $8 RETURNING *`,
      [newScore, maxScore, percentage, letterGrade, assessment_name, assessment_type, term, id]
    );

    res.json({ grade: result.rows[0] });
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete grade (teacher/admin)
router.delete('/:id', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    res.json({ message: 'Grade deleted' });
  } catch (error) {
    console.error('Delete grade error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
