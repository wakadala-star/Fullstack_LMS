const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

function generateJoinCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Create a classroom (teacher only)
router.post('/', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { title, classType } = req.body;
    const teacherId = req.user.id;

    if (!title || !classType) {
      return res.status(400).json({ error: 'Title and class type are required' });
    }
    if (!['audio', 'video'].includes(classType)) {
      return res.status(400).json({ error: 'Class type must be audio or video' });
    }

    let joinCode;
    let isUnique = false;
    while (!isUnique) {
      joinCode = generateJoinCode();
      const existing = await pool.query('SELECT id FROM classrooms WHERE join_code = $1', [joinCode]);
      isUnique = existing.rows.length === 0;
    }

    const result = await pool.query(
      `INSERT INTO classrooms (teacher_id, title, class_type, join_code, status)
       VALUES ($1, $2, $3, $4, 'waiting') RETURNING *`,
      [teacherId, title, classType, joinCode]
    );

    // Add teacher as participant
    await pool.query(
      `INSERT INTO classroom_participants (classroom_id, user_id, role)
       VALUES ($1, $2, 'teacher')`,
      [result.rows[0].id, teacherId]
    );

    res.status(201).json({ message: 'Classroom created', classroom: result.rows[0] });
  } catch (error) {
    console.error('Create classroom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a classroom (teacher only)
router.patch('/:id/start', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE classrooms SET status = 'live', started_at = NOW() WHERE id = $1 AND teacher_id = $2 AND status = 'waiting' RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found or already started' });
    }
    res.json({ message: 'Classroom started', classroom: result.rows[0] });
  } catch (error) {
    console.error('Start classroom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End a classroom (teacher only)
router.patch('/:id/end', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE classrooms SET status = 'ended', ended_at = NOW() WHERE id = $1 AND teacher_id = $2 AND status = 'live' RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found or not live' });
    }
    // Set all participants left_at
    await pool.query(
      'UPDATE classroom_participants SET left_at = NOW() WHERE classroom_id = $1 AND left_at IS NULL',
      [id]
    );
    res.json({ message: 'Classroom ended', classroom: result.rows[0] });
  } catch (error) {
    console.error('End classroom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify join code (student)
router.post('/verify', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) {
      return res.status(400).json({ error: 'Join code is required' });
    }

    const result = await pool.query(
      `SELECT c.*, u.name as teacher_name FROM classrooms c
       JOIN users u ON c.teacher_id = u.id
       WHERE c.join_code = $1 AND c.status IN ('waiting', 'live')`,
      [joinCode.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired join code' });
    }

    res.json({ classroom: result.rows[0] });
  } catch (error) {
    console.error('Verify join code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join a classroom (student)
router.post('/:id/join', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const classroom = await pool.query(
      "SELECT * FROM classrooms WHERE id = $1 AND status IN ('waiting', 'live')",
      [id]
    );
    if (classroom.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found or not accepting participants' });
    }

    // Check if already suspended
    const suspended = await pool.query(
      'SELECT id FROM classroom_participants WHERE classroom_id = $1 AND user_id = $2 AND is_suspended = TRUE',
      [id, userId]
    );
    if (suspended.rows.length > 0) {
      return res.status(403).json({ error: 'You have been suspended from this classroom' });
    }

    // Upsert participant
    await pool.query(
      `INSERT INTO classroom_participants (classroom_id, user_id, role, joined_at)
       VALUES ($1, $2, 'student', NOW())
       ON CONFLICT (classroom_id, user_id) DO UPDATE SET left_at = NULL, is_suspended = FALSE`,
      [id, userId]
    );

    res.json({ message: 'Joined classroom', classroom: classroom.rows[0] });
  } catch (error) {
    console.error('Join classroom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave a classroom
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await pool.query(
      'UPDATE classroom_participants SET left_at = NOW() WHERE classroom_id = $1 AND user_id = $2 AND left_at IS NULL',
      [id, userId]
    );
    res.json({ message: 'Left classroom' });
  } catch (error) {
    console.error('Leave classroom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get classroom participants (teacher)
router.get('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT cp.*, u.name, u.email FROM classroom_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.classroom_id = $1
       ORDER BY cp.role DESC, cp.joined_at ASC`,
      [id]
    );
    res.json({ participants: result.rows });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mute/unmute participant (teacher)
router.patch('/:classroomId/participants/:participantId/mute', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { classroomId, participantId } = req.params;
    const { isMuted } = req.body;

    // Verify teacher owns the classroom
    const classroom = await pool.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroomId, req.user.id]
    );
    if (classroom.rows.length === 0) {
      return res.status(403).json({ error: 'Not your classroom' });
    }

    const result = await pool.query(
      'UPDATE classroom_participants SET is_muted = $1 WHERE id = $2 AND classroom_id = $3 RETURNING *',
      [isMuted, participantId, classroomId]
    );
    res.json({ participant: result.rows[0] });
  } catch (error) {
    console.error('Mute participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suspend/unsuspend participant (teacher)
router.patch('/:classroomId/participants/:participantId/suspend', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { classroomId, participantId } = req.params;
    const { isSuspended } = req.body;

    const classroom = await pool.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroomId, req.user.id]
    );
    if (classroom.rows.length === 0) {
      return res.status(403).json({ error: 'Not your classroom' });
    }

    const result = await pool.query(
      'UPDATE classroom_participants SET is_suspended = $1 WHERE id = $2 AND classroom_id = $3 RETURNING *',
      [isSuspended, participantId, classroomId]
    );
    res.json({ participant: result.rows[0] });
  } catch (error) {
    console.error('Suspend participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grant/deny screen share (teacher)
router.patch('/:classroomId/participants/:participantId/screen-share', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { classroomId, participantId } = req.params;
    const { canShareScreen } = req.body;

    const classroom = await pool.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroomId, req.user.id]
    );
    if (classroom.rows.length === 0) {
      return res.status(403).json({ error: 'Not your classroom' });
    }

    const result = await pool.query(
      'UPDATE classroom_participants SET can_share_screen = $1 WHERE id = $2 AND classroom_id = $3 RETURNING *',
      [canShareScreen, participantId, classroomId]
    );
    res.json({ participant: result.rows[0] });
  } catch (error) {
    console.error('Screen share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm attendance (teacher only)
router.patch('/:id/confirm-attendance', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE classrooms SET attendance_confirmed = TRUE WHERE id = $1 AND teacher_id = $2 RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    res.json({ message: 'Attendance confirmed', classroom: result.rows[0] });
  } catch (error) {
    console.error('Confirm attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's classrooms
router.get('/my-classrooms', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM classroom_participants WHERE classroom_id = c.id AND role = 'student' AND left_at IS NULL) as participant_count
       FROM classrooms c WHERE c.teacher_id = $1 ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ classrooms: result.rows });
  } catch (error) {
    console.error('Get my classrooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active classroom for student
router.get('/active', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as teacher_name FROM classrooms c
       JOIN users u ON c.teacher_id = u.id
       WHERE c.status IN ('waiting', 'live')
       ORDER BY c.created_at DESC`
    );
    res.json({ classrooms: result.rows });
  } catch (error) {
    console.error('Get active classrooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
