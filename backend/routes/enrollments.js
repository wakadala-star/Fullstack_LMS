const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { createNotification } = require('../config/db');

const router = express.Router();

// Request enrollment (student)
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // Check course exists
    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courseResult.rows[0];

    // Check if already enrolled
    const existing = await pool.query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [studentId, courseId]
    );
    if (existing.rows.length > 0) {
      const status = existing.rows[0].status;
      return res.status(400).json({ error: `You already have a ${status} enrollment for this course` });
    }

    // Check if course is full
    if (course.enrolled >= course.max_enrolled) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // Create enrollment request
    const result = await pool.query(
      'INSERT INTO enrollments (student_id, course_id, status) VALUES ($1, $2, $3) RETURNING *',
      [studentId, courseId, 'pending']
    );

    // Notify teacher
    const student = await pool.query('SELECT name FROM users WHERE id = $1', [studentId]);
    const studentName = student.rows[0]?.name || 'A student';
    if (course.instructor_id) {
      await createNotification(
        course.instructor_id,
        'Enrollment Request',
        `${studentName} wants to enroll in ${course.name}`,
        'info'
      );
    }

    res.status(201).json({ message: 'Enrollment request sent', enrollment: result.rows[0] });
  } catch (error) {
    console.error('Enrollment request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my enrollments (student)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.name as course_name, c.code as course_code, c.instructor, c.description, c.category, c.credits,
              c.schedule, c.materials, c.max_enrolled
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = $1
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments: result.rows });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending enrollments for teacher's courses
router.get('/pending', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.name as course_name, c.code as course_code, c.instructor_id,
              u.name as student_name, u.email as student_email
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON e.student_id = u.id
       WHERE c.instructor_id = $1 AND e.status = 'pending'
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments: result.rows });
  } catch (error) {
    console.error('Get pending enrollments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all enrollments for teacher's courses (any status)
router.get('/teacher', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.name as course_name, c.code as course_code, c.instructor_id,
              u.name as student_name, u.email as student_email
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON e.student_id = u.id
       WHERE c.instructor_id = $1
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments: result.rows });
  } catch (error) {
    console.error('Get teacher enrollments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve enrollment (teacher)
router.patch('/:id/approve', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get enrollment with course info
    const enrollment = await pool.query(
      `SELECT e.*, c.instructor_id, c.name as course_name, c.max_enrolled, c.enrolled
       FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.id = $1`,
      [id]
    );

    if (enrollment.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enroll = enrollment.rows[0];

    // Check teacher owns the course
    if (enroll.instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (enroll.status !== 'pending') {
      return res.status(400).json({ error: 'Enrollment is not pending' });
    }

    // Check if course is full
    if (enroll.enrolled >= enroll.max_enrolled) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // Approve
    await pool.query('UPDATE enrollments SET status = $1 WHERE id = $2', ['approved', id]);
    await pool.query('UPDATE courses SET enrolled = enrolled + 1 WHERE id = $1', [enroll.course_id]);

    // Notify student
    await createNotification(
      enroll.student_id,
      'Enrollment Approved',
      `Your enrollment in ${enroll.course_name} has been approved!`,
      'success'
    );

    res.json({ message: 'Enrollment approved' });
  } catch (error) {
    console.error('Approve enrollment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject enrollment (teacher)
router.patch('/:id/reject', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await pool.query(
      `SELECT e.*, c.instructor_id, c.name as course_name
       FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.id = $1`,
      [id]
    );

    if (enrollment.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enroll = enrollment.rows[0];

    if (enroll.instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (enroll.status !== 'pending') {
      return res.status(400).json({ error: 'Enrollment is not pending' });
    }

    await pool.query('UPDATE enrollments SET status = $1 WHERE id = $2', ['rejected', id]);

    // Notify student
    await createNotification(
      enroll.student_id,
      'Enrollment Rejected',
      `Your enrollment in ${enroll.course_name} has been rejected.`,
      'warning'
    );

    res.json({ message: 'Enrollment rejected' });
  } catch (error) {
    console.error('Reject enrollment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
