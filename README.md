# Introduction to Backend Web Development

A comprehensive backend authentication system built with Node.js, Express.js, and PostgreSQL. This project demonstrates industry-standard practices for secure user authentication, security hardening, and memory management.

---

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Authentication | Complete | JWT-based auth with register/login |
| Phase 2: PostgreSQL | Complete | Persistent database storage |
| Phase 3: Security | Complete | Rate limiting, helmet, sanitization |
| Phase 4: Memory Management | Complete | Caching, connection pooling, monitoring |
| Phase 5: API Expansion | Planned | User profiles, roles, CRUD operations |

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | Latest | JavaScript runtime |
| Express.js | Latest | Web framework |
| PostgreSQL | 18 | Database |
| bcryptjs | Latest | Password hashing |
| jsonwebtoken | Latest | JWT authentication |
| helmet | Latest | Security headers |
| express-rate-limit | Latest | Rate limiting |
| node-cache | Latest | In-memory caching |

---

## Project Structure

```
intro to backend web development/
├── .env                          # Environment variables
├── .gitignore                    # Git ignored files
├── server.js                     # Application entry point
├── package.json                  # Dependencies and scripts
├── README.md                     # Project documentation
│
├── backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL connection & queries
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT token verification
│   │   ├── logger.js             # Session & request logging
│   │   ├── memory.js             # Caching & memory monitoring
│   │   └── security.js           # Helmet, rate limiting, sanitization
│   │
│   ├── routes/
│   │   └── auth.js               # Authentication endpoints
│   │
│   └── logs/                     # Daily log files (auto-created)
│
└── frontend/
    ├── index.html                # Login/Register page
    ├── dashboard.html            # User dashboard
    ├── style.css                 # Stylesheet
    ├── app.js                    # Auth form logic
    └── dashboard.js              # Dashboard logic
```

---

## Features

### Authentication
- User registration with validation
- Secure login with bcrypt password hashing
- JWT token generation and verification
- Protected route middleware
- Session logging with timestamps

### Security
- **Helmet**: 12+ security headers (XSS, CSP, HSTS, X-Frame-Options)
- **Rate Limiting**: 20 requests/15min on auth routes, 100/15min globally
- **Input Sanitization**: XSS attack prevention
- **CORS**: Configurable origin restrictions
- **HPP**: HTTP Parameter Pollution protection
- **Request Size Limit**: 10kb maximum body size

### Memory Management
- **Connection Pooling**: Max 20 PostgreSQL connections
- **NodeCache**: In-memory caching with 5-minute TTL
- **Memory Monitoring**: Real-time heap usage tracking
- **Cache Stats**: Hit/miss ratio monitoring
- **Graceful Cleanup**: Cache cleared on server shutdown

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/auth/register` | No | Create new user account |
| POST | `/api/auth/login` | No | Login and receive JWT |
| GET | `/api/auth/me` | Yes | Get current user profile |

### System
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/stats` | No | Memory, cache, and DB stats |
| GET | `/api/protected` | No | Test protected route |

---

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_super_secret_key_change_in_production_12345
JWT_EXPIRES_IN=24h

# PostgreSQL
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_system
```

---

## Getting Started

### Prerequisites
- Node.js installed
- PostgreSQL installed and running

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/intro-to-backend-web-development.git

# Navigate to project folder
cd "intro to backend web development"

# Install dependencies
npm install

# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE auth_system;"

# Start the server
node server.js
```

### Access Points
- **Frontend**: http://localhost:5000
- **API Stats**: http://localhost:5000/api/stats
- **pgAdmin**: Open pgAdmin to view database

---

## Database Schema

### Users Table
| Column | Type | Constraint |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password | VARCHAR(255) | NOT NULL (hashed) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## Security Features

| Protection | Implementation |
|------------|----------------|
| XSS Attacks | Input sanitization escapes HTML entities |
| Brute Force | Rate limiting blocks after 20 attempts/15min |
| Clickjacking | X-Frame-Options: DENY header |
| MIME Sniffing | X-Content-Type-Options: nosniff header |
| SQL Injection | Parameterized queries with pg library |
| HTTP Pollution | HPP middleware cleans parameters |

---

## Logging

All authentication events are logged to `backend/logs/YYYY-MM-DD.log`:
- Successful/failed logins
- Successful/failed registrations
- All HTTP requests with timestamps

---

## Future Development

- [ ] Phase 5: API Expansion (user profiles, CRUD, roles)
- [ ] Phase 6: Frontend framework integration (React/Vue)
- [ ] Phase 7: Email verification and password reset
- [ ] Phase 8: OAuth2 (Google, GitHub login)
- [ ] Phase 9: Two-factor authentication
- [ ] Phase 10: Docker containerization

---

## License

ISC

---

## Author

Backend Web Development Project - 2026
