-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Monitors / Admins who log in
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,        -- bcrypt hash
  role       VARCHAR(50) DEFAULT 'monitor', -- 'admin' | 'monitor'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendants (students, employees, etc.)
CREATE TABLE attendants (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE,
  student_id VARCHAR(100) UNIQUE NOT NULL,
  qr_code    VARCHAR(100) UNIQUE NOT NULL, -- embedded in QR image (same as student_id)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance sessions (a class, event, meeting, etc.)
CREATE TABLE sessions (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by INT REFERENCES users(id),
  is_open    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance records (one row per scan)
CREATE TABLE attendance (
  id           SERIAL PRIMARY KEY,
  attendant_id INT REFERENCES attendants(id) ON DELETE CASCADE,
  session_id   INT REFERENCES sessions(id) ON DELETE CASCADE,
  scanned_at   TIMESTAMPTZ DEFAULT NOW(),
  status       VARCHAR(50) DEFAULT 'present',
  UNIQUE (attendant_id, session_id)  -- prevents duplicate scans
);

-- Insert a default admin user (password: admin123)
-- Hash generated with bcrypt, 10 rounds
INSERT INTO users (email, password, role) VALUES 
('admin@example.com', '$2a$10$0smX4koIHA3F0I1NkdXrjOKR0LQCu6OrAPSPdQSiiJ72pS.YFAmnu', 'admin');
