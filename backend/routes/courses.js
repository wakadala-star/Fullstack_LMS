const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const courseId = req.params.id || 'general';
    const dir = path.join(__dirname, '../../uploads/courses', courseId.toString());
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|webm|ogg|mp3|wav|m4a|ppt|pptx|xls|xlsx|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('File type not allowed'));
  }
});

// Get all courses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY created_at DESC');
    res.json({ courses: result.rows });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single course by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ course: result.rows[0] });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create course (teacher/admin only)
router.post('/', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { name, code, description, category, credits, maxEnrolled, schedule } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    // Validate category exists
    const catResult = await pool.query('SELECT id FROM categories WHERE name = $1 AND active = TRUE', [category]);
    if (catResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const existing = await pool.query('SELECT id FROM courses WHERE code = $1', [code]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    const result = await pool.query(
      `INSERT INTO courses (name, code, description, instructor, instructor_id, category, credits, max_enrolled, schedule, materials)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, code, description || '', req.user.name, req.user.id, category, credits || 3, maxEnrolled || 30, schedule || '', '[]']
    );

    res.status(201).json({ message: 'Course created successfully', course: result.rows[0] });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload materials to course (teacher/admin only)
router.post('/:id/materials', authenticateToken, authorizeRoles('teacher', 'admin'), upload.array('files', 10), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify course ownership
    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];
    if (course.instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get existing materials
    let materials = course.materials || [];
    if (typeof materials === 'string') {
      materials = JSON.parse(materials);
    }

    // Add new files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = `/uploads/courses/${id}/${file.filename}`;
        materials.push({
          name: file.originalname,
          type: file.mimetype,
          size: formatFileSize(file.size),
          url: fileUrl,
          filename: file.filename,
          uploadedAt: new Date().toISOString()
        });
      }
    }

    // Update course materials
    await pool.query('UPDATE courses SET materials = $1 WHERE id = $2', [JSON.stringify(materials), id]);

    res.json({ message: 'Materials uploaded successfully', materials });
  } catch (error) {
    console.error('Upload materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a material from course (teacher/admin only)
router.delete('/:id/materials/:filename', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id, filename } = req.params;

    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];
    if (course.instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let materials = course.materials || [];
    if (typeof materials === 'string') {
      materials = JSON.parse(materials);
    }

    // Find and remove the material
    const materialIndex = materials.findIndex(m => m.filename === filename);
    if (materialIndex === -1) {
      return res.status(404).json({ error: 'Material not found' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../../uploads/courses', id.toString(), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    materials.splice(materialIndex, 1);
    await pool.query('UPDATE courses SET materials = $1 WHERE id = $2', [JSON.stringify(materials), id]);

    res.json({ message: 'Material deleted' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course materials (for backward compatibility with base64)
router.put('/:id/materials', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { materials } = req.body;

    const result = await pool.query(
      'UPDATE courses SET materials = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(materials || []), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Materials updated', course: result.rows[0] });
  } catch (error) {
    console.error('Update materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enroll in course
router.post('/:id/enroll', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE courses SET enrolled = enrolled + 1 WHERE id = $1 AND enrolled < max_enrolled RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Course not found or full' });
    }
    res.json({ message: 'Enrolled successfully', course: result.rows[0] });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
