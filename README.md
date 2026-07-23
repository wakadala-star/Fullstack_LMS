# LearnHub - Fullstack Learning Management System

A comprehensive full-stack Learning Management System built with Node.js, Express.js, PostgreSQL, and Angular 22. Features role-based access for Admin, Teacher, Student, and Parent users with real-time live classrooms, messaging, quizzes, grading, fee management, and more.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Click_Here-brightgreen?style=for-the-badge&logo=vercel)](https://your-demo-url.vercel.app)

> **Note:** Replace the demo link above with your actual deployed URL after hosting.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
  - [Role-Based System](#role-based-system)
  - [Authentication](#authentication)
  - [Courses & Enrollment](#courses--enrollment)
  - [Quizzes & Grading](#quizzes--grading)
  - [Live Classrooms](#live-classrooms-agora-webrtc)
  - [Messaging](#messaging)
  - [Fee Management](#fee-management)
  - [Task Management](#task-management)
  - [Notifications](#notifications)
  - [Additional Features](#additional-features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema-18-tables)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
- [Security](#security)
- [Default Admin Account](#default-admin-account)
- [License](#license)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular (Standalone Components, Signals) | 22 |
| Styling | Tailwind CSS | 4 |
| Backend | Node.js + Express.js | 5 |
| Database | PostgreSQL (via `pg` pool) | - |
| Authentication | JWT + bcryptjs | - |
| Real-time | Agora WebRTC SDK | 4 |
| File Uploads | Multer (disk storage) | 2 |
| Security | Helmet, express-rate-limit, HPP | - |
| Caching | NodeCache (in-memory, 5min TTL) | - |
| Language | TypeScript (frontend), JavaScript (backend) | - |

---

## Features

### Role-Based System
- **Admin** - Full control: user management, courses, grades, fees, tasks, categories, timesheets
- **Teacher** - Course creation, quizzes, grading, live classrooms, task management, time tracking
- **Student** - Enrollment, quizzes, grades, fees, live class participation
- **Parent** - View linked children's grades, fees, and course progress

### Authentication
- Student self-registration with email/password
- Teacher/Parent token-based login (admin-generated 8-char tokens)
- JWT tokens with 24h expiry
- Account suspension/activation

### Courses & Enrollment
- Course CRUD with categories, credits, schedules, and max enrollment limits
- Material uploads (PDF, video, audio, documents - up to 100MB each)
- Enrollment request workflow: student requests -> teacher approves/rejects
- Inline course material viewers (PDF iframe, video/audio players)

### Quizzes & Grading
- Online quizzes with auto-grading (multiple-choice)
- Take-home quizzes with file upload submissions
- Manual grading with score, feedback, and letter grades
- Dynamic quiz status (upcoming/active/completed based on time)

### Live Classrooms (Agora WebRTC)
- Audio-only or video+audio class sessions
- Camera and microphone toggles
- Screen sharing (teacher-controlled)
- Join codes for students
- Participant management (mute, suspend, grant screen share)

### Messaging
- Real-time messaging between staff (admin/teacher)
- Online presence indicators (heartbeat-based)
- Unread message badges
- Auto-polling every 5 seconds

### Fee Management
- Student fee records with amount, balance, due dates
- Payment processing with method selection
- Payment history tracking
- Parent visibility into children's fees

### Task Management (Admin -> Teacher)
- Assign tasks with priority and due dates
- Task calendar widget with color-coded priorities
- Mark complete/reopen workflow
- Task statistics dashboard

### Notifications
- In-app notifications for enrollments, quizzes, payments, profile changes
- Unread count badges in sidebar

### Additional Features
- Profile management with image crop modal for avatars
- Teacher time tracking (clock in/out)
- Course categories (6 seeded defaults)
- Parent-student linking
- Landing page with dynamic testimonials
- Feedback system with star ratings
- Server health monitoring with auto-reconnect
- Responsive design with collapsible sidebar

---

## Project Structure

```
Fullstack_LMS/
├── server.js                     # Express server entry point
├── .env                          # Environment variables
├── package.json                  # Backend dependencies
│
├── backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL connection, schema, queries
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT verification, role authorization
│   │   ├── logger.js             # Request/session logging
│   │   ├── memory.js             # Caching, memory monitoring
│   │   └── security.js           # Helmet, rate limiting, sanitization
│   └── routes/
│       ├── auth.js               # Auth, profiles, notifications, feedback
│       ├── courses.js            # Course CRUD, materials, enrollment
│       ├── enrollments.js        # Enrollment requests, approval workflow
│       ├── quizzes.js            # Quiz CRUD, submissions, grading
│       ├── grades.js             # Grade management
│       ├── fees.js               # Fee records, payments
│       ├── categories.js         # Course categories
│       ├── clock.js              # Teacher time tracking
│       ├── tasks.js              # Admin-to-teacher task assignment
│       ├── classrooms.js         # Live classroom sessions
│       ├── agora.js              # Agora token generation
│       ├── messages.js           # Staff messaging, online presence
│       └── parent-student.js     # Parent-child linking
│
├── frontend/                     # Angular 22 application
│   ├── src/app/
│   │   ├── core/                 # Auth service, guards, interceptors, models
│   │   ├── layout/               # Dashboard layout, header, sidebar
│   │   ├── pages/
│   │   │   ├── profile/          # Profile with image crop
│   │   │   ├── admin/            # Dashboard, users, courses, quizzes, results, fees, tasks, timesheets
│   │   │   ├── staff/            # Dashboard, courses, tasks, attendance, classroom, approvals, results, quizzes, submissions
│   │   │   ├── student/          # Dashboard, courses, attendance, classroom, results, fees, quizzes
│   │   │   ├── parent/           # Dashboard, children, results, fees
│   │   │   └── shared/           # Messages
│   │   ├── components/           # Landing, login, register, confirm-dialog, feedback-modal
│   │   └── shared/               # Live chat, maintenance-modal, task-calendar
│   └── src/environments/         # API URL config
│
└── uploads/                      # Uploaded course & quiz materials
    ├── courses/
    └── quizzes/
```

---

## Database Schema (18 Tables)

| Table | Purpose |
|-------|---------|
| users | User accounts with roles, avatar, status |
| notifications | In-app notifications with read tracking |
| feedback | Star ratings and comments |
| courses | Course details with materials (JSONB) |
| enrollments | Student enrollment requests (pending/approved/rejected) |
| quizzes | Quizzes with questions (JSONB), timing |
| quiz_submissions | Student quiz answers and file uploads |
| grades | Assessment grades with auto-calculated percentage/letter |
| fees | Student fee records |
| fee_payments | Payment transactions |
| parent_student | Parent-child relationships |
| categories | Course categories (6 seeded defaults) |
| clock_entries | Teacher time tracking |
| tasks | Admin-assigned tasks with priority/status |
| classrooms | Live class sessions |
| classroom_participants | Participant tracking per session |
| messages | Direct staff messaging |
| online_users | Heartbeat-based online presence |

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Student registration |
| POST | `/api/auth/login` | - | Email/password login |
| POST | `/api/auth/token-login` | - | Token login (teachers/parents) |
| POST | `/api/auth/create-user` | Admin | Create teacher/parent account |
| GET | `/api/auth/users` | Admin | List all users |
| PATCH | `/api/auth/users/:id/status` | Admin | Suspend/activate user |
| PUT | `/api/auth/profile` | Any | Update profile (name, phone, avatar) |
| PUT | `/api/auth/password` | Any | Change password |
| GET | `/api/auth/notifications` | Any | Get notifications |
| POST | `/api/auth/feedback` | Any | Submit feedback |

### Courses
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/courses` | - | List all courses |
| POST | `/api/courses` | Teacher/Admin | Create course |
| POST | `/api/courses/:id/materials` | Teacher/Admin | Upload materials |
| DELETE | `/api/courses/:id/materials/:filename` | Teacher/Admin | Delete material |

### Enrollments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/enrollments/request` | Any | Request enrollment |
| GET | `/api/enrollments/my` | Any | My enrollments |
| GET | `/api/enrollments/pending` | Teacher/Admin | Pending requests |
| PATCH | `/api/enrollments/:id/approve` | Teacher/Admin | Approve |
| PATCH | `/api/enrollments/:id/reject` | Teacher/Admin | Reject |

### Quizzes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/quizzes` | Any | List quizzes |
| POST | `/api/quizzes` | Teacher/Admin | Create quiz |
| POST | `/api/quizzes/:id/submit` | Student | Submit quiz |
| PATCH | `/api/quizzes/:quizId/submissions/:submissionId/grade` | Teacher/Admin | Grade submission |

### Grades
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/grades` | Any | Get grades (role-filtered) |
| POST | `/api/grades` | Teacher/Admin | Create grade |

### Fees
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/fees` | Any | Get fees (role-filtered) |
| POST | `/api/fees` | Admin | Create fee record |
| POST | `/api/fees/:id/pay` | Any | Process payment |

### Classrooms
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/classrooms` | Teacher | Create classroom |
| POST | `/api/classrooms/:id/join` | Student | Join classroom |
| PATCH | `/api/classrooms/:id/start` | Teacher | Start session |
| PATCH | `/api/classrooms/:id/end` | Teacher | End session |

### Messaging
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/messages/send` | Any | Send message |
| GET | `/api/messages/conversation/:userId` | Any | Get conversation |
| POST | `/api/messages/heartbeat` | Any | Update online presence |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | - | List categories |
| POST | `/api/clock/clock-in` | Teacher | Clock in |
| POST | `/api/clock/clock-out` | Teacher | Clock out |
| POST | `/api/tasks` | Admin | Assign task |
| PATCH | `/api/tasks/:taskId/complete` | Teacher | Complete task |
| POST | `/api/agora/token` | Any | Generate Agora token |

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- Angular CLI (`npm install -g @angular/cli`)

### Installation

```bash
# Clone the repository
git clone https://github.com/wakadala-star/Fullstack_LMS.git
cd Fullstack_LMS

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Environment Setup

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lms_database
```

### Database Setup

```sql
CREATE DATABASE lms_database;
```

The application auto-creates all tables on first run.

### Running

```bash
# Start backend (from root)
node server.js

# Start frontend (from frontend/)
cd frontend
npm start
```

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:5000/api

### Default Admin Account
- **Email**: admin@learnhub.com
- **Password**: admin123

---

## Security

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT tokens (24h expiry) |
| Passwords | bcrypt (12 salt rounds) |
| Rate Limiting | 500 req/15min global, 50 req/15min auth |
| XSS Protection | Input sanitization (HTML entity encoding) |
| Headers | Helmet (CSP, HSTS, X-Frame-Options) |
| SQL Injection | Parameterized queries |
| HTTP Pollution | HPP middleware |
| Account Security | Suspension/activation system |

---

## License

ISC

---

## Author

**Wakadala Mark**

LearnHub LMS - 2026
