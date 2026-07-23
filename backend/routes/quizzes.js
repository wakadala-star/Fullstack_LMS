const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, createNotification } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for quiz file uploads
const quizUploadsDir = path.join(__dirname, '../../uploads/quizzes');
if (!fs.existsSync(quizUploadsDir)) {
  fs.mkdirSync(quizUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const quizId = req.params.id || 'pending';
    const dir = path.join(quizUploadsDir, quizId.toString());
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Get all quizzes (or filtered by course)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Dynamically update quiz status based on current time vs start/end times
    // 1. Quizzes past their end_time -> completed
    await pool.query(
      `UPDATE quizzes SET status = 'completed'
       WHERE status IN ('upcoming', 'active')
       AND end_time IS NOT NULL
       AND end_time < NOW()`
    );
    // 2. Quizzes within their time window (start_time <= now <= end_time) -> active
    await pool.query(
      `UPDATE quizzes SET status = 'active'
       WHERE status IN ('upcoming', 'completed')
       AND start_time IS NOT NULL AND start_time <= NOW()
       AND (end_time IS NULL OR end_time >= NOW())`
    );
    // 3. Quizzes before their start_time -> upcoming
    await pool.query(
      `UPDATE quizzes SET status = 'upcoming'
       WHERE status IN ('active', 'completed')
       AND start_time IS NOT NULL
       AND start_time > NOW()`
    );

    const { course_id } = req.query;
    let query = 'SELECT q.*, c.name as course_name, c.code as course_code FROM quizzes q LEFT JOIN courses c ON q.course_id = c.id';
    const params = [];

    if (course_id) {
      query += ' WHERE q.course_id = $1';
      params.push(course_id);
    }
    query += ' ORDER BY q.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ quizzes: result.rows });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my submissions (student) - MUST be before /:id
router.get('/my-submissions', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qs.*, q.title as quiz_title, q.quiz_type, c.name as course_name,
              q.questions as quiz_questions
       FROM quiz_submissions qs
       LEFT JOIN quizzes q ON qs.quiz_id = q.id
       LEFT JOIN courses c ON q.course_id = c.id
       WHERE qs.student_id = $1
       ORDER BY qs.submitted_at DESC`,
      [req.user.id]
    );
    res.json({ submissions: result.rows });
  } catch (error) {
    console.error('Get my submissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single quiz
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Dynamically update status based on current time
    await pool.query(
      `UPDATE quizzes SET status = 'completed'
       WHERE id = $1 AND status IN ('upcoming', 'active')
       AND end_time IS NOT NULL AND end_time < NOW()`,
      [id]
    );
    await pool.query(
      `UPDATE quizzes SET status = 'active'
       WHERE id = $1 AND status IN ('upcoming', 'completed')
       AND start_time IS NOT NULL AND start_time <= NOW()
       AND (end_time IS NULL OR end_time >= NOW())`,
      [id]
    );
    await pool.query(
      `UPDATE quizzes SET status = 'upcoming'
       WHERE id = $1 AND status IN ('active', 'completed')
       AND start_time IS NOT NULL AND start_time > NOW()`,
      [id]
    );
    const result = await pool.query(
      'SELECT q.*, c.name as course_name, c.code as course_code FROM quizzes q LEFT JOIN courses c ON q.course_id = c.id WHERE q.id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json({ quiz: result.rows[0] });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create quiz (teacher/admin only)
router.post('/', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { title, description, course_id, quiz_type, duration, total_points, start_time, end_time, questions } = req.body;

    if (!title || !course_id || !quiz_type) {
      return res.status(400).json({ error: 'Title, course, and quiz type are required' });
    }

    const result = await pool.query(
      `INSERT INTO quizzes (title, description, course_id, instructor_id, quiz_type, duration, total_points, start_time, end_time, questions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        title, description || '', course_id, req.user.id, quiz_type,
        duration || (quiz_type === 'take_home' ? 20160 : 50),
        total_points || 0, start_time || null, end_time || null,
        JSON.stringify(questions || []),
        // Determine initial status based on current time vs start_time
        !start_time ? 'active' :
        new Date(start_time) <= new Date() ? 'active' : 'upcoming'
      ]
    );

    res.status(201).json({ quiz: result.rows[0] });

    // Notify enrolled students about the new quiz
    try {
      const enrolled = await pool.query(
        `SELECT e.student_id, u.name as student_name
         FROM enrollments e
         LEFT JOIN users u ON e.student_id = u.id
         WHERE e.course_id = $1 AND e.status = 'approved'`,
        [course_id]
      );
      const quizTitle = title;
      const courseResult = await pool.query('SELECT name FROM courses WHERE id = $1', [course_id]);
      const courseName = courseResult.rows[0]?.name || 'a course';
      for (const student of enrolled.rows) {
        await createNotification(
          student.student_id,
          'New Quiz Available',
          `A new ${quiz_type === 'online' ? 'online' : 'take-home'} quiz "${quizTitle}" has been posted in ${courseName}`,
          'info'
        );
      }
    } catch (err) {
      console.error('Failed to notify students about new quiz:', err);
    }
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update quiz
router.put('/:id', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, duration, total_points, start_time, end_time, questions, status } = req.body;

    const existing = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (existing.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `UPDATE quizzes SET title = COALESCE($1, title), description = COALESCE($2, description),
       duration = COALESCE($3, duration), total_points = COALESCE($4, total_points),
       start_time = COALESCE($5, start_time), end_time = COALESCE($6, end_time),
       questions = COALESCE($7, questions), status = COALESCE($8, status)
       WHERE id = $9 RETURNING *`,
      [title, description, duration, total_points, start_time, end_time,
       questions ? JSON.stringify(questions) : null, status, id]
    );

    // If start_time or end_time changed, clear existing submissions so students can retake
    if (start_time !== undefined || end_time !== undefined) {
      await pool.query('DELETE FROM quiz_submissions WHERE quiz_id = $1', [id]);
    }

    res.json({ quiz: result.rows[0] });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete quiz
router.delete('/:id', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    if (existing.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await pool.query('DELETE FROM quizzes WHERE id = $1', [id]);
    res.json({ message: 'Quiz deleted' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload quiz materials (take-home quizzes)
router.post('/:id/materials', authenticateToken, authorizeRoles('teacher', 'admin'), upload.array('files', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    let materials = existing.rows[0].materials || [];
    if (typeof materials === 'string') {
      materials = JSON.parse(materials);
    }

    const newMaterials = (req.files || []).map(file => ({
      name: file.originalname,
      type: file.mimetype,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      url: `/uploads/quizzes/${id}/${file.filename}`,
      filename: file.filename,
      uploadedAt: new Date().toISOString()
    }));

    materials = [...materials, ...newMaterials];
    await pool.query('UPDATE quizzes SET materials = $1 WHERE id = $2', [JSON.stringify(materials), id]);

    res.json({ materials });
  } catch (error) {
    console.error('Upload quiz materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete quiz material
router.delete('/:id/materials/:filename', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id, filename } = req.params;
    const existing = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    let materials = existing.rows[0].materials || [];
    if (typeof materials === 'string') {
      materials = JSON.parse(materials);
    }

    const materialIndex = materials.findIndex(m => m.filename === filename);
    if (materialIndex === -1) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const filePath = path.join(__dirname, '../../uploads/quizzes', id.toString(), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    materials.splice(materialIndex, 1);
    await pool.query('UPDATE quizzes SET materials = $1 WHERE id = $2', [JSON.stringify(materials), id]);

    res.json({ message: 'Material deleted' });
  } catch (error) {
    console.error('Delete quiz material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit quiz (student)
router.post('/:id/submit', authenticateToken, authorizeRoles('student'), upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const time_taken = req.body.time_taken || req.body.timeTaken || 0;

    const quiz = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
    if (quiz.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if already submitted
    const existing = await pool.query(
      'SELECT * FROM quiz_submissions WHERE quiz_id = $1 AND student_id = $2',
      [id, req.user.id]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'graded') {
      return res.status(400).json({ error: 'Already graded' });
    }

    let score = 0;
    let totalPoints = 0;
    const parsedAnswers = answers ? (typeof answers === 'string' ? JSON.parse(answers) : answers) : [];

    // Auto-grade online quizzes
    if (quiz.rows[0].quiz_type === 'online') {
      const questions = quiz.rows[0].questions || [];
      totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
      parsedAnswers.forEach((answer, index) => {
        if (questions[index] && answer === questions[index].correctAnswer) {
          score += questions[index].points || 1;
        }
      });
    }

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const fileUrl = req.file ? `/uploads/quizzes/${id}/${req.file.filename}` : null;
    const fileName = req.file ? req.file.originalname : null;

    if (existing.rows.length > 0) {
      // Update existing submission
      const result = await pool.query(
        `UPDATE quiz_submissions SET answers = $1, file_url = $2, file_name = $3, score = $4, total_points = $5,
         percentage = $6, time_taken = $7, status = $8, submitted_at = CURRENT_TIMESTAMP
         WHERE quiz_id = $9 AND student_id = $10 RETURNING *`,
        [JSON.stringify(parsedAnswers), fileUrl, fileName, score, totalPoints, percentage,
         time_taken || 0, quiz.rows[0].quiz_type === 'online' ? 'submitted' : 'pending', id, req.user.id]
      );
      // Notify teacher
      try {
        const student = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
        const studentName = student.rows[0]?.name || 'A student';
        await createNotification(
          quiz.rows[0].instructor_id,
          'Quiz Submission',
          `${studentName} submitted "${quiz.rows[0].title}"`,
          'info'
        );
      } catch {}
      return res.json({ submission: result.rows[0] });
    }

    // Create new submission
    const result = await pool.query(
      `INSERT INTO quiz_submissions (quiz_id, student_id, answers, file_url, file_name, score, total_points, percentage, time_taken, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, req.user.id, JSON.stringify(parsedAnswers), fileUrl, fileName, score, totalPoints, percentage,
       time_taken || 0, quiz.rows[0].quiz_type === 'online' ? 'submitted' : 'pending']
    );

    // Notify teacher
    try {
      const student = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
      const studentName = student.rows[0]?.name || 'A student';
      await createNotification(
        quiz.rows[0].instructor_id,
        'Quiz Submission',
        `${studentName} submitted "${quiz.rows[0].title}"`,
        'info'
      );
    } catch {}

    res.status(201).json({ submission: result.rows[0] });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get submissions for a quiz (teacher/admin)
router.get('/:id/submissions', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT qs.*, u.name as student_name, u.email as student_email,
              q.total_points as quiz_total_points, q.title as quiz_title, q.quiz_type,
              q.questions as quiz_questions
       FROM quiz_submissions qs
       LEFT JOIN users u ON qs.student_id = u.id
       LEFT JOIN quizzes q ON qs.quiz_id = q.id
       WHERE qs.quiz_id = $1
       ORDER BY qs.submitted_at DESC`,
      [id]
    );
    res.json({ submissions: result.rows });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grade a submission (teacher/admin)
router.patch('/:quizId/submissions/:submissionId/grade', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { quizId, submissionId } = req.params;
    const { score, total_points, feedback } = req.body;

    const quiz = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    if (quiz.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const totalPoints = total_points || quiz.rows[0].total_points || 0;
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

    const result = await pool.query(
      `UPDATE quiz_submissions SET score = $1, total_points = $2, percentage = $3, feedback = $4,
       status = 'graded', graded_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND quiz_id = $6 RETURNING *`,
      [score, totalPoints, percentage, feedback || '', submissionId, quizId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({ submission: result.rows[0] });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
