const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  max: 50,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('New client connected to pool');
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    const stats = getPoolStats();
    console.log('Pool stats:', stats);
    client.release();
    return true;
  } catch (error) {
    console.error('PostgreSQL connection error:', error.message);
    return false;
  }
};

const initDatabase = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'admin', 'teacher', 'parent')),
      token VARCHAR(20) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log('Users table ready');

    // Add columns if they don't exist (for existing databases)
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS token VARCHAR(20)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");

    // Clear corrupted avatar data (sanitizeInput was replacing '/' in base64)
    await pool.query("UPDATE users SET avatar = NULL WHERE avatar IS NOT NULL AND avatar LIKE '%&#x2F;%'");

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Notifications table ready');

    // Feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Feedback table ready');

    // Courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        description TEXT,
        instructor VARCHAR(100) NOT NULL,
        instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        category VARCHAR(100),
        credits INTEGER DEFAULT 3,
        enrolled INTEGER DEFAULT 0,
        max_enrolled INTEGER DEFAULT 30,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
        schedule VARCHAR(100),
        materials JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Courses table ready');

    // Enrollments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_id)
      )
    `);
    console.log('Enrollments table ready');

    // Quizzes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        quiz_type VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (quiz_type IN ('take_home', 'online')),
        duration INTEGER DEFAULT 50,
        total_points INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        questions JSONB DEFAULT '[]',
        materials JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Quizzes table ready');

    // Quiz submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_submissions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        answers JSONB DEFAULT '[]',
        file_url TEXT,
        file_name TEXT,
        score INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        percentage DECIMAL(5,2) DEFAULT 0,
        time_taken INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded')),
        feedback TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        graded_at TIMESTAMP,
        UNIQUE(quiz_id, student_id)
      )
    `);
    console.log('Quiz submissions table ready');

    // Grades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('quiz', 'exam', 'assignment', 'project')),
        assessment_name VARCHAR(255) NOT NULL,
        score DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_score DECIMAL(10,2) NOT NULL DEFAULT 100,
        percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
        letter_grade VARCHAR(5),
        term VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Grades table ready');

    // Fees table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        paid DECIMAL(12,2) NOT NULL DEFAULT 0,
        balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        due_date DATE,
        status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid', 'overdue')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Fees table ready');

    // Fee payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fee_payments (
        id SERIAL PRIMARY KEY,
        fee_id INTEGER REFERENCES fees(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(50),
        reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Fee payments table ready');

    // Parent-student linking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parent_student (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(parent_id, student_id)
      )
    `);
    console.log('Parent-student table ready');

    // Categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50) DEFAULT 'folder',
        color VARCHAR(20) DEFAULT '#6366f1',
        sort_order INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Categories table ready');

    // Seed default categories
    const defaultCategories = [
      { name: 'AI & Machine Learning', slug: 'ai-machine-learning', icon: 'brain', color: '#8b5cf6', sort_order: 1 },
      { name: 'Cybersecurity', slug: 'cybersecurity', icon: 'shield', color: '#ef4444', sort_order: 2 },
      { name: 'Web Development', slug: 'web-development', icon: 'globe', color: '#6366f1', sort_order: 3 },
      { name: 'Mobile Development', slug: 'mobile-development', icon: 'smartphone', color: '#f97316', sort_order: 4 },
      { name: 'Data Science', slug: 'data-science', icon: 'chart-bar', color: '#06b6d4', sort_order: 5 },
      { name: 'Cloud & DevOps', slug: 'cloud-devops', icon: 'cloud', color: '#0ea5e9', sort_order: 6 },
    ];
    for (const cat of defaultCategories) {
      await pool.query(
        `INSERT INTO categories (name, slug, icon, color, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`,
        [cat.name, cat.slug, cat.icon, cat.color, cat.sort_order]
      );
    }
    console.log('Default categories seeded');

    // Clock entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clock_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        clock_in_ms BIGINT NOT NULL,
        clock_out_ms BIGINT,
        total_hours DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'clocked_in' CHECK (status IN ('clocked_in', 'clocked_out')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Clock entries table ready');

    // Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tasks table ready');

    // Classrooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        class_type VARCHAR(10) NOT NULL CHECK (class_type IN ('audio', 'video')),
        join_code VARCHAR(8) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'live', 'ended')),
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        attendance_confirmed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Classrooms table ready');

    // Classroom participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classroom_participants (
        id SERIAL PRIMARY KEY,
        classroom_id INTEGER REFERENCES classrooms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(10) DEFAULT 'student' CHECK (role IN ('teacher', 'student')),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        is_muted BOOLEAN DEFAULT FALSE,
        is_suspended BOOLEAN DEFAULT FALSE,
        can_share_screen BOOLEAN DEFAULT FALSE,
        UNIQUE(classroom_id, user_id)
      )
    `);
    console.log('Classroom participants table ready');

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Messages table ready');

    // Online users tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS online_users (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Online users table ready');

    // Clear existing courses and related data
    await pool.query('DELETE FROM quiz_submissions WHERE quiz_id IN (SELECT id FROM quizzes)');
    await pool.query('DELETE FROM quizzes');
    await pool.query('DELETE FROM grades');
    await pool.query('DELETE FROM enrollments');
    await pool.query('DELETE FROM courses');
    console.log('Existing courses cleared');

    // Add unique constraint on token if not exists
    const constraintCheck = await pool.query("SELECT 1 FROM pg_constraint WHERE conname = 'users_token_unique'");
    if (constraintCheck.rows.length === 0) {
      await pool.query("ALTER TABLE users ADD CONSTRAINT users_token_unique UNIQUE (token)");
    }

    // Seed default admin if not exists
    const adminExists = await findUserByEmail('admin@learnhub.com');
    if (!adminExists) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'admin')",
        ['Super Admin', 'admin@learnhub.com', hashedPassword]
      );
      console.log('Default admin seeded: admin@learnhub.com / admin123');
    }
  } catch (error) {
    console.error('Error creating users table:', error.message);
  }
};

const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

const findUserByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
};

const findUserByName = async (name) => {
  const result = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
  return result.rows[0];
};

const findUserByToken = async (token) => {
  const result = await pool.query('SELECT * FROM users WHERE token = $1', [token]);
  return result.rows[0];
};

const createUser = async (name, email, hashedPassword, role = 'student') => {
  const result = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
    [name, email, hashedPassword, role]
  );
  return result.rows[0];
};

const createUserWithToken = async (name, email, hashedPassword, role, token) => {
  const result = await pool.query(
    'INSERT INTO users (name, email, password, role, token) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, token, created_at',
    [name, email, hashedPassword, role, token]
  );
  return result.rows[0];
};

const getAllUsers = async () => {
  const result = await pool.query('SELECT id, name, email, role, token, status, phone, avatar, created_at FROM users ORDER BY created_at DESC');
  return result.rows;
};

const getUsersByRole = async (role) => {
  const result = await pool.query('SELECT id, name, email, role, token, status, phone, avatar, created_at FROM users WHERE role = $1 ORDER BY created_at DESC', [role]);
  return result.rows;
};

const updateUserStatus = async (id, status) => {
  const result = await pool.query('UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, role, status', [status, id]);
  return result.rows[0];
};

const getUserCount = async () => {
  const result = await pool.query('SELECT COUNT(*) as count FROM users');
  return parseInt(result.rows[0].count);
};

const createNotification = async (userId, title, message, type = 'info') => {
  const result = await pool.query(
    'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING id, user_id, title, message, type, read, created_at',
    [userId, title, message, type]
  );
  return result.rows[0];
};

const getNotificationsByUserId = async (userId) => {
  const result = await pool.query(
    'SELECT id, user_id, title, message, type, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return result.rows;
};

const markNotificationRead = async (id, userId) => {
  const result = await pool.query(
    'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  return result.rows[0];
};

const getUnreadNotificationCount = async (userId) => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = FALSE',
    [userId]
  );
  return parseInt(result.rows[0].count);
};

const getAdminUserIds = async () => {
  const result = await pool.query("SELECT id FROM users WHERE role = 'admin'");
  return result.rows.map(r => r.id);
};

const createFeedback = async (userId, name, role, rating, comment) => {
  const result = await pool.query(
    'INSERT INTO feedback (user_id, name, role, rating, comment) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, role, rating, comment, created_at',
    [userId, name, role, rating, comment || null]
  );
  return result.rows[0];
};

const getPublicFeedback = async (limit = 10) => {
  const result = await pool.query(
    'SELECT id, name, role, rating, comment, created_at FROM feedback ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
};

module.exports = {
  pool,
  testConnection,
  initDatabase,
  getPoolStats,
  findUserByEmail,
  findUserById,
  findUserByName,
  findUserByToken,
  createUser,
  createUserWithToken,
  getAllUsers,
  getUsersByRole,
  updateUserStatus,
  getUserCount,
  createNotification,
  getNotificationsByUserId,
  markNotificationRead,
  getUnreadNotificationCount,
  getAdminUserIds,
  createFeedback,
  getPublicFeedback,
};
