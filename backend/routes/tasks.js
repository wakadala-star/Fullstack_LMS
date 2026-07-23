const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Get all tasks (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        u.name as teacher_name,
        u.email as teacher_email,
        a.name as admin_name
      FROM tasks t
      JOIN users u ON t.teacher_id = u.id
      LEFT JOIN users a ON t.admin_id = a.id
      ORDER BY t.due_date DESC, t.created_at DESC
    `);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks for a specific teacher (admin view)
router.get('/teacher/:teacherId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { teacherId } = req.params;
    const result = await pool.query(`
      SELECT 
        t.*,
        u.name as teacher_name,
        u.email as teacher_email,
        a.name as admin_name
      FROM tasks t
      JOIN users u ON t.teacher_id = u.id
      LEFT JOIN users a ON t.admin_id = a.id
      WHERE t.teacher_id = $1
      ORDER BY t.due_date DESC, t.created_at DESC
    `, [teacherId]);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get teacher tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my tasks (teacher only)
router.get('/my-tasks', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT 
        t.*,
        a.name as admin_name
      FROM tasks t
      LEFT JOIN users a ON t.admin_id = a.id
      WHERE t.teacher_id = $1
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        t.due_date ASC,
        t.created_at DESC
    `, [userId]);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's tasks (teacher only)
router.get('/today', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT 
        t.*,
        a.name as admin_name
      FROM tasks t
      LEFT JOIN users a ON t.admin_id = a.id
      WHERE t.teacher_id = $1 AND t.due_date = $2
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        t.created_at DESC
    `, [userId, today]);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get today tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task stats for a teacher (teacher view)
router.get('/stats', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM tasks WHERE teacher_id = $1', [userId]
    );
    const pendingResult = await pool.query(
      "SELECT COUNT(*) FROM tasks WHERE teacher_id = $1 AND status IN ('pending', 'in_progress')", [userId]
    );
    const completedResult = await pool.query(
      "SELECT COUNT(*) FROM tasks WHERE teacher_id = $1 AND status = 'completed'", [userId]
    );
    const todayResult = await pool.query(
      "SELECT COUNT(*) FROM tasks WHERE teacher_id = $1 AND due_date = $2 AND status != 'completed'", [userId, today]
    );
    const overdueResult = await pool.query(
      "SELECT COUNT(*) FROM tasks WHERE teacher_id = $1 AND due_date < $2 AND status != 'completed'", [userId, today]
    );

    res.json({
      total: parseInt(totalResult.rows[0].count),
      pending: parseInt(pendingResult.rows[0].count),
      completed: parseInt(completedResult.rows[0].count),
      todayDue: parseInt(todayResult.rows[0].count),
      overdue: parseInt(overdueResult.rows[0].count),
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign a task (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { teacherId, title, description, dueDate, priority } = req.body;
    const adminId = req.user.id;

    if (!teacherId || !title || !dueDate) {
      return res.status(400).json({ error: 'Teacher, title, and due date are required' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (admin_id, teacher_id, title, description, due_date, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [adminId, teacherId, title, description || '', dueDate, priority || 'medium']
    );

    res.status(201).json({ message: 'Task assigned successfully', task: result.rows[0] });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a task (admin only)
router.put('/:taskId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, dueDate, priority, status } = req.body;

    const result = await pool.query(
      `UPDATE tasks SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        due_date = COALESCE($3, due_date),
        priority = COALESCE($4, priority),
        status = COALESCE($5, status)
       WHERE id = $6 RETURNING *`,
      [title, description, dueDate, priority, status, taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task updated successfully', task: result.rows[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task (admin only)
router.delete('/:taskId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark task as completed (teacher only)
router.patch('/:taskId/complete', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const existing = await pool.query(
      'SELECT id, teacher_id, status FROM tasks WHERE id = $1',
      [taskId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (existing.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: 'Not your task' });
    }

    const result = await pool.query(
      "UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *",
      [taskId]
    );

    res.json({ message: 'Task marked as completed', task: result.rows[0] });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reopen a completed task (teacher only)
router.patch('/:taskId/reopen', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const existing = await pool.query(
      'SELECT id, teacher_id, status FROM tasks WHERE id = $1',
      [taskId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (existing.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: 'Not your task' });
    }

    const result = await pool.query(
      "UPDATE tasks SET status = 'pending', completed_at = NULL WHERE id = $1 RETURNING *",
      [taskId]
    );

    res.json({ message: 'Task reopened', task: result.rows[0] });
  } catch (error) {
    console.error('Reopen task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all teachers (for admin task assignment)
router.get('/staff', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY name"
    );
    res.json({ teachers: result.rows });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
