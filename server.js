import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb, db } from './server/db.js';

import batchesRoutes from './server/routes/batches.js';
import contentRoutes from './server/routes/content.js';
import adminRoutes from './server/routes/admin.js';
import authRoutes from './server/routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

function validateConfig() {
  const missing = [];
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    console.warn('DATABASE_URL is not set.');
  }
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_USERNAME.trim()) missing.push('ADMIN_USERNAME');
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_PASSWORD.trim()) missing.push('ADMIN_PASSWORD');
  if (!process.env.SESSION_SECRET || !process.env.SESSION_SECRET.trim()) missing.push('SESSION_SECRET');
  if (missing.length > 0) {
    console.warn('Missing env vars: ' + missing.join(', ') + '. Using fallbacks.');
  }
}

app.use(compression({ threshold: 1024 }));

app.use(async (req, res, next) => {
  if (!db.isHealthy()) {
    try { await initDb(); } catch (e) { console.error('Lazy DB init error:', e); }
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', 1);

const sessionSecret = (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim())
  ? process.env.SESSION_SECRET.trim()
  : 'pw-sensei-secure-default-session-secret-fallback-key';

app.use(session({
  name: 'pw_admin_sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: { httpOnly: true, secure: 'auto', sameSite: 'lax', path: '/', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use('/api/auth', authRoutes);
app.use('/api', batchesRoutes);
app.use('/api', contentRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'CockroachDB Cloud', database_connected: db.isHealthy(), timestamp: new Date().toISOString() });
});

const distDir = path.join(__dirname, 'dist');
const publicDir = fs.existsSync(distDir) ? distDir : path.join(__dirname, 'public');
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : '0',
  etag: true, lastModified: true
}));

// Redirect old admin URLs to /SK08
app.get('/admin', (req, res) => res.redirect('/SK08'));
app.get('/admin/login', (req, res) => res.redirect('/SK08'));
app.get('/admin/index.html', (req, res) => res.redirect('/SK08'));

// NEW: Admin panel at /SK08
app.get('/SK08', (req, res) => res.sendFile(path.join(publicDir, 'admin', 'index.html')));
app.get('/SK08/login', (req, res) => res.sendFile(path.join(publicDir, 'admin', 'login.html')));

app.get('/study', (req, res) => res.sendFile(path.join(publicDir, 'study.html')));
app.get('/mybatches', (req, res) => res.sendFile(path.join(publicDir, 'mybatches.html')));
app.get('/auth', (req, res) => res.redirect('/study'));
app.get('/batch', (req, res) => res.sendFile(path.join(publicDir, 'batch.html')));
app.get('/subject', (req, res) => res.sendFile(path.join(publicDir, 'subject.html')));
app.get('/chapter', (req, res) => res.sendFile(path.join(publicDir, 'chapter.html')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  try {
    validateConfig();
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`PW SENSEI Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (!process.env.VERCEL) start();

export default app;
