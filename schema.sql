-- ==========================================================
-- PW SENSEI - CockroachDB Cloud Database Schema
-- Compatible with CockroachDB Cloud / Render / Vercel / Node.js
-- ==========================================================

-- 1. Users & Profiles
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  xp INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Batches
CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  thumbnail_url TEXT,
  banner_url TEXT,
  language VARCHAR(50) DEFAULT 'Hinglish',
  target_audience TEXT,
  start_date VARCHAR(100),
  end_date VARCHAR(100),
  is_free INTEGER DEFAULT 1,
  price INTEGER DEFAULT 0,
  is_new INTEGER DEFAULT 1,
  is_published INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50) DEFAULT '📚',
  default_teacher_name VARCHAR(255) DEFAULT '',
  chapter_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0
);

-- 4. Chapters
CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  chapter_number INTEGER DEFAULT 1,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Videos (Lectures & DPP Video Solutions)
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  lecture_id INTEGER,
  title VARCHAR(255) NOT NULL,
  external_link TEXT NOT NULL,
  thumbnail_url TEXT,
  duration VARCHAR(50) DEFAULT '45 mins',
  teacher_name VARCHAR(255),
  type VARCHAR(50) DEFAULT 'lecture',
  lecture_date VARCHAR(100) DEFAULT '',
  display_order INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. PDFs (Class Notes & DPP Problem Sheets)
CREATE TABLE IF NOT EXISTS pdfs (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  lecture_id INTEGER,
  title VARCHAR(255) NOT NULL,
  external_link TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'note',
  file_size VARCHAR(50) DEFAULT '2.4 MB',
  lecture_date VARCHAR(100) DEFAULT '',
  display_order INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Quizzes (Interactive Practice & DPP Quizzes)
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  lecture_id INTEGER,
  title VARCHAR(255) NOT NULL,
  external_link TEXT,
  total_questions INTEGER DEFAULT 10,
  duration_mins INTEGER DEFAULT 15,
  questions_json TEXT,
  display_order INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. User Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, batch_id)
);

-- 9. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Site Settings
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

-- 11. Promotional Banners
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  redirect_url TEXT,
  badge_text VARCHAR(100) DEFAULT 'SPECIAL OFFER',
  badge_color VARCHAR(50) DEFAULT '#EF4444',
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Teachers & Faculty
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) DEFAULT '',
  subjects_taught VARCHAR(255) DEFAULT '',
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  photo_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  experience VARCHAR(255) DEFAULT '',
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Dynamic Navigation Links
CREATE TABLE IF NOT EXISTS nav_links (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  icon VARCHAR(50) DEFAULT '🔗',
  url TEXT NOT NULL,
  is_external INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. Lecture Extra Resources
CREATE TABLE IF NOT EXISTS lecture_resources (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) DEFAULT 'Link',
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  display_label VARCHAR(100) DEFAULT '',
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_batch_id ON subjects(batch_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject_id ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_videos_chapter_id ON videos(chapter_id);
CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(type);
CREATE INDEX IF NOT EXISTS idx_pdfs_chapter_id ON pdfs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pdfs_type ON pdfs(type);
CREATE INDEX IF NOT EXISTS idx_quizzes_chapter_id ON quizzes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_teachers_batch_id ON teachers(batch_id);
CREATE INDEX IF NOT EXISTS idx_lecture_resources_video_id ON lecture_resources(video_id);
