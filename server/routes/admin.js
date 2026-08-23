import express from 'express';
import crypto from 'crypto';
import { db, getTodayIST, normalizeDate } from '../db.js';

const router = express.Router();

// Constant-time string comparison to prevent timing attacks
function timingSafeCompare(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const bufInput = Buffer.from(input, 'utf-8');
  const bufExpected = Buffer.from(expected, 'utf-8');
  if (bufInput.length !== bufExpected.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufInput, bufExpected);
}

// Get session secret for token signing
function getSessionSecret() {
  return (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim())
    ? process.env.SESSION_SECRET.trim()
    : 'pw-sensei-secure-default-session-secret-fallback-key';
}

// Generate signed admin authentication token (works in iframes & third-party cookie restricted environments like AI Studio)
function generateAdminToken(adminData) {
  const payload = {
    username: adminData.username,
    role: adminData.role || 'super_admin',
    iat: Date.now(),
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

// Verify signed admin authentication token
function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
  if (!timingSafeCompare(signature, expectedSig)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    const envUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    if (payload.username !== envUsername && payload.username.toLowerCase() !== envUsername.toLowerCase()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// Extract authenticated admin from Session or Token header
function getAdminFromRequest(req) {
  // 1. Check active server session
  if (req.session && req.session.adminUser) {
    return req.session.adminUser;
  }

  // 2. Check Authorization header or x-admin-token (for iframes / Google AI Studio preview)
  const authHeader = req.headers.authorization || req.headers['x-admin-token'] || '';
  let token = '';
  if (typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (token) {
    const verified = verifyAdminToken(token);
    if (verified) {
      const adminSession = {
        username: verified.username,
        role: verified.role || 'super_admin',
        authenticated_at: new Date(verified.iat || Date.now()).toISOString()
      };
      if (req.session) {
        req.session.adminUser = adminSession;
      }
      return adminSession;
    }
  }

  return null;
}

// Admin auth middleware
function isAdmin(req, res, next) {
  const adminUser = getAdminFromRequest(req);
  if (adminUser) {
    req.adminUser = adminUser;
    return next();
  }
  const sidBrief = req.sessionID ? `${req.sessionID.slice(0, 8)}...` : 'none';
  console.warn(`🔒 [ADMIN AUTH] Unauthorized request rejected on ${req.method} ${req.originalUrl} - No active admin session or token found (SessionID: ${sidBrief})`);
  return res.status(401).json({ error: 'Admin authorization required' });
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const identifier = (req.body.username || req.body.email || req.body.identifier || '').trim();
  const password = (req.body.password || '').trim();

  const envUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  const envPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();

  if (!identifier || !password) {
    console.warn('🔒 [ADMIN AUTH] Login attempt failed: Missing identifier or password');
    return res.status(400).json({ error: 'Admin username and password are required' });
  }

  // Verify username (case-insensitive or exact) and password (timing-safe exact match)
  const usernameMatches = identifier === envUsername || identifier.toLowerCase() === envUsername.toLowerCase();
  const passwordMatches = timingSafeCompare(password, envPassword);

  if (usernameMatches && passwordMatches) {
    const adminSession = {
      username: envUsername,
      role: 'super_admin',
      authenticated_at: new Date().toISOString()
    };
    req.session.adminUser = adminSession;
    const token = generateAdminToken(adminSession);

    // Explicitly persist session to store before responding to prevent race conditions
    req.session.save((err) => {
      if (err) {
        console.error('🔒 [ADMIN AUTH] Session save failed:', err);
      }
      const sidBrief = req.sessionID ? `${req.sessionID.slice(0, 8)}...` : 'none';
      console.log(`🔒 [ADMIN AUTH] Login SUCCESS for admin user. Session & token created. (SessionID: ${sidBrief})`);
      return res.json({ success: true, admin: adminSession, token: token });
    });
    return;
  }

  const sidBrief = req.sessionID ? `${req.sessionID.slice(0, 8)}...` : 'none';
  console.warn(`🔒 [ADMIN AUTH] Login attempt FAILED: Invalid credentials provided. (SessionID: ${sidBrief})`);
  return res.status(401).json({ error: 'Invalid admin credentials' });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  const sidBrief = req.sessionID ? `${req.sessionID.slice(0, 8)}...` : 'none';
  if (req.session) {
    req.session.adminUser = null;
    req.session.save((err) => {
      console.log(`🔒 [ADMIN AUTH] Admin logged out. Session cleared. (SessionID: ${sidBrief})`);
      res.json({ success: true, message: 'Admin logged out' });
    });
  } else {
    res.json({ success: true, message: 'Admin logged out' });
  }
});

// GET /api/admin/me
router.get('/me', isAdmin, (req, res) => {
  const sidBrief = req.sessionID ? `${req.sessionID.slice(0, 8)}...` : 'none';
  console.log(`🔒 [ADMIN AUTH] Authenticated request to /api/admin/me (SessionID: ${sidBrief})`);
  res.json({ admin: req.adminUser || req.session?.adminUser });
});

// GET /api/admin/dashboard - stats & overview (optimized with parallel execution)
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const [
      batchCountObj,
      subjectCountObj,
      videoCountObj,
      pdfCountObj,
      announcementCountObj,
      bannerCountObj,
      activeBannerCountObj,
      recentBatches
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM batches'),
      db.get('SELECT COUNT(*) as count FROM subjects'),
      db.get('SELECT COUNT(*) as count FROM videos'),
      db.get('SELECT COUNT(*) as count FROM pdfs'),
      db.get('SELECT COUNT(*) as count FROM announcements'),
      db.get('SELECT COUNT(*) as count FROM banners'),
      db.get('SELECT COUNT(*) as count FROM banners WHERE is_active = 1'),
      db.all(`
        SELECT id, title, language, target_audience, is_free, price, is_published, created_at
        FROM batches
        ORDER BY id DESC
        LIMIT 10
      `)
    ]);

    res.json({
      stats: {
        totalBatches: parseInt(batchCountObj?.count || 0, 10),
        totalSubjects: parseInt(subjectCountObj?.count || 0, 10),
        totalVideos: parseInt(videoCountObj?.count || 0, 10),
        totalPdfs: parseInt(pdfCountObj?.count || 0, 10),
        totalAnnouncements: parseInt(announcementCountObj?.count || 0, 10),
        totalBanners: parseInt(bannerCountObj?.count || 0, 10),
        activeBanners: parseInt(activeBannerCountObj?.count || 0, 10)
      },
      recentBatches: recentBatches || []
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ==========================================
// BATCHES CRUD
// ==========================================

// GET /api/admin/batches - all batches
router.get('/batches', isAdmin, async (req, res) => {
  try {
    const batches = await db.all('SELECT * FROM batches ORDER BY id DESC');
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch batches', batches: [] });
  }
});

// POST /api/admin/batches - create batch
router.post('/batches', isAdmin, async (req, res) => {
  const {
    title,
    thumbnail_url,
    banner_url,
    language = 'Hinglish',
    target_audience = '',
    start_date = '',
    end_date = '',
    price = 0,
    is_free = 1,
    is_new = 1,
    is_published = 1
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Batch title is required' });
  }

  try {
    const result = await db.run(
      `INSERT INTO batches (title, thumbnail_url, banner_url, language, target_audience, start_date, end_date, is_free, price, is_new, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
        banner_url || '',
        language || 'Hinglish',
        target_audience || '',
        start_date || '',
        end_date || '',
        is_free ? 1 : 0,
        parseInt(price, 10) || 0,
        is_new ? 1 : 0,
        is_published ? 1 : 0
      ]
    );

    const created = await db.get('SELECT * FROM batches WHERE id = ?', [result.lastInsertRowid]);
    if (!created) {
      return res.status(500).json({ error: 'Failed to verify created batch in database' });
    }
    res.status(201).json({ success: true, batch: created });
  } catch (err) {
    console.error('Create batch error:', err);
    res.status(500).json({ error: 'Failed to create batch: ' + (err.message || 'Server error') });
  }
});

// PUT /api/admin/batches/:id - update batch
router.put('/batches/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }

  const {
    title,
    thumbnail_url,
    banner_url,
    language,
    target_audience,
    start_date,
    end_date,
    is_free,
    price,
    is_new,
    is_published
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const existing = await db.get('SELECT id FROM batches WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    await db.run(
      `UPDATE batches SET 
        title = ?, thumbnail_url = ?, banner_url = ?, language = ?, target_audience = ?,
        start_date = ?, end_date = ?, is_free = ?, price = ?,
        is_new = ?, is_published = ?
       WHERE id = ?`,
      [
        title.trim(),
        thumbnail_url,
        banner_url || '',
        language || 'Hinglish',
        target_audience || '',
        start_date || '',
        end_date || '',
        is_free ? 1 : 0,
        parseInt(price, 10) || 0,
        is_new ? 1 : 0,
        is_published ? 1 : 0,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM batches WHERE id = ?', [id]);
    if (!updated) {
      return res.status(500).json({ error: 'Failed to verify updated batch in database' });
    }
    res.json({ success: true, batch: updated });
  } catch (err) {
    console.error('Update batch error:', err);
    res.status(500).json({ error: 'Failed to update batch: ' + (err.message || 'Server error') });
  }
});

// DELETE /api/admin/batches/:id - delete batch
router.delete('/batches/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }

  try {
    const existing = await db.get('SELECT id, title FROM batches WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Batch not found or already deleted' });
    }

    // Safely delete all associated child records across related tables
    const subjects = await db.all('SELECT id FROM subjects WHERE batch_id = ?', [id]);
    const subjectIds = subjects.map(s => s.id);

    if (subjectIds.length > 0) {
      const placeholders = subjectIds.map(() => '?').join(',');
      
      const chapters = await db.all(
        `SELECT id FROM chapters WHERE subject_id IN (${placeholders})`,
        subjectIds
      );
      const chapterIds = chapters.map(c => c.id);

      const videos = await db.all(
        `SELECT id FROM videos WHERE subject_id IN (${placeholders})`,
        subjectIds
      );
      const videoIds = videos.map(v => v.id);

      // Clean up lecture resources attached to videos or chapters in this batch
      if (videoIds.length > 0) {
        const vPlaceholders = videoIds.map(() => '?').join(',');
        await db.run(`DELETE FROM lecture_resources WHERE video_id IN (${vPlaceholders})`, videoIds);
      }
      if (chapterIds.length > 0) {
        const cPlaceholders = chapterIds.map(() => '?').join(',');
        await db.run(`DELETE FROM lecture_resources WHERE chapter_id IN (${cPlaceholders})`, chapterIds);
      }

      // Delete quizzes, pdfs, and videos
      await db.run(`DELETE FROM quizzes WHERE subject_id IN (${placeholders})`, subjectIds);
      await db.run(`DELETE FROM pdfs WHERE subject_id IN (${placeholders})`, subjectIds);
      await db.run(`DELETE FROM videos WHERE subject_id IN (${placeholders})`, subjectIds);

      // Delete chapters
      await db.run(`DELETE FROM chapters WHERE subject_id IN (${placeholders})`, subjectIds);

      // Delete subjects
      await db.run('DELETE FROM subjects WHERE batch_id = ?', [id]);
    }

    // Delete batch announcements and enrollments
    await db.run('DELETE FROM announcements WHERE batch_id = ?', [id]);
    await db.run('DELETE FROM enrollments WHERE batch_id = ?', [id]);

    // Unlink teachers associated with this batch
    await db.run('UPDATE teachers SET batch_id = NULL WHERE batch_id = ?', [id]);

    // Delete the batch
    await db.run('DELETE FROM batches WHERE id = ?', [id]);

    // Verify record is genuinely deleted from database
    const verifyBatch = await db.get('SELECT id FROM batches WHERE id = ?', [id]);
    if (verifyBatch) {
      return res.status(500).json({ error: 'Failed to delete batch: record still exists in database' });
    }

    res.json({ success: true, message: `Batch "${existing.title}" and all related content deleted successfully` });
  } catch (err) {
    console.error('Delete batch error:', err);
    res.status(500).json({ error: 'Failed to delete batch: ' + (err.message || 'Server error') });
  }
});

// ==========================================
// SUBJECTS CRUD
// ==========================================

// GET /api/admin/batches/:id/subjects
router.get('/batches/:id/subjects', isAdmin, async (req, res) => {
  const batchId = parseInt(req.params.id, 10);
  try {
    const subjects = await db.all('SELECT * FROM subjects WHERE batch_id = ? ORDER BY display_order ASC, id ASC', [batchId]);
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects', subjects: [] });
  }
});

// POST /api/admin/batches/:id/subjects
router.post('/batches/:id/subjects', isAdmin, async (req, res) => {
  const batchId = parseInt(req.params.id, 10);
  const { name, icon = '📚', default_teacher_name = '', default_thumbnail_url = '', chapter_count = 0, display_order = 0 } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Subject name is required' });
  }

  try {
    const batch = await db.get('SELECT id FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found for this subject' });
    }

    const result = await db.run(
      'INSERT INTO subjects (batch_id, name, icon, default_teacher_name, default_thumbnail_url, chapter_count, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        batchId,
        name.trim(),
        (icon || '📚').trim(),
        default_teacher_name ? String(default_teacher_name).trim() : '',
        default_thumbnail_url ? String(default_thumbnail_url).trim() : '',
        parseInt(chapter_count, 10) || 0,
        parseInt(display_order, 10) || 0
      ]
    );

    const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [result.lastInsertRowid]);
    if (!subject) {
      return res.status(500).json({ error: 'Failed to verify created subject in database' });
    }
    res.status(201).json({ success: true, subject });
  } catch (err) {
    console.error('Add subject error:', err);
    res.status(500).json({ error: 'Failed to add subject: ' + (err.message || 'Server error') });
  }
});

// PUT /api/admin/subjects/:id
router.put('/subjects/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, icon, default_teacher_name, default_thumbnail_url, chapter_count, display_order } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Subject name is required' });
  }

  try {
    const existing = await db.get('SELECT id FROM subjects WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    await db.run(
      'UPDATE subjects SET name = ?, icon = ?, default_teacher_name = ?, default_thumbnail_url = ?, chapter_count = ?, display_order = ? WHERE id = ?',
      [
        name.trim(),
        (icon || '📚').trim(),
        default_teacher_name !== undefined ? String(default_teacher_name).trim() : '',
        default_thumbnail_url !== undefined ? String(default_thumbnail_url).trim() : '',
        parseInt(chapter_count, 10) || 0,
        parseInt(display_order, 10) || 0,
        id
      ]
    );

    const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [id]);
    if (!subject) {
      return res.status(500).json({ error: 'Failed to verify updated subject in database' });
    }
    res.json({ success: true, subject });
  } catch (err) {
    console.error('Edit subject error:', err);
    res.status(500).json({ error: 'Failed to update subject: ' + (err.message || 'Server error') });
  }
});

// DELETE /api/admin/subjects/:id
router.delete('/subjects/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const existing = await db.get('SELECT id, name FROM subjects WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found or already deleted' });
    }

    // Delete associated child records safely before removing subject
    await db.run(`
      DELETE FROM lecture_resources WHERE chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)
      OR video_id IN (SELECT id FROM videos WHERE subject_id = ?)
    `, [id, id]);

    await db.run('DELETE FROM quizzes WHERE subject_id = ?', [id]);
    await db.run('DELETE FROM pdfs WHERE subject_id = ?', [id]);
    await db.run('DELETE FROM videos WHERE subject_id = ?', [id]);
    await db.run('DELETE FROM chapters WHERE subject_id = ?', [id]);
    await db.run('DELETE FROM subjects WHERE id = ?', [id]);

    const check = await db.get('SELECT id FROM subjects WHERE id = ?', [id]);
    if (check) {
      return res.status(500).json({ error: 'Failed to delete subject: record still exists in database' });
    }

    res.json({ success: true, message: 'Subject deleted' });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ error: 'Failed to delete subject: ' + (err.message || 'Server error') });
  }
});

// ==========================================
// CHAPTERS CRUD
// ==========================================

// GET /api/admin/chapters (with optional query ?subject_id=)
router.get('/chapters', isAdmin, async (req, res) => {
  const subjectId = req.query.subject_id ? parseInt(req.query.subject_id, 10) : null;
  try {
    let sql = 'SELECT * FROM chapters';
    const params = [];
    if (subjectId) {
      sql += ' WHERE subject_id = ?';
      params.push(subjectId);
    }
    sql += ' ORDER BY display_order ASC, chapter_number ASC, id ASC';
    const chapters = await db.all(sql, params);

    let chaptersWithCounts = [];
    if (chapters.length > 0) {
      const chapterIds = chapters.map(c => c.id);
      const inPlaceholders = chapterIds.map(() => '?').join(',');

      const [videoCounts, pdfCounts, quizCounts] = await Promise.all([
        db.all(`SELECT chapter_id, type, COUNT(*) as count FROM videos WHERE chapter_id IN (${inPlaceholders}) GROUP BY chapter_id, type`, chapterIds),
        db.all(`SELECT chapter_id, type, COUNT(*) as count FROM pdfs WHERE chapter_id IN (${inPlaceholders}) GROUP BY chapter_id, type`, chapterIds),
        db.all(`SELECT chapter_id, COUNT(*) as count FROM quizzes WHERE chapter_id IN (${inPlaceholders}) GROUP BY chapter_id`, chapterIds)
      ]);

      const countMap = {};
      chapterIds.forEach(id => {
        countMap[id] = { lectures: 0, notes: 0, quizzes: 0, dpp_pdfs: 0, dpp_videos: 0 };
      });

      for (const row of videoCounts) {
        if (!countMap[row.chapter_id]) continue;
        const cnt = parseInt(row.count, 10) || 0;
        if (row.type === 'lecture') countMap[row.chapter_id].lectures += cnt;
        else if (row.type === 'dpp_video') countMap[row.chapter_id].dpp_videos += cnt;
      }

      for (const row of pdfCounts) {
        if (!countMap[row.chapter_id]) continue;
        const cnt = parseInt(row.count, 10) || 0;
        if (row.type === 'note') countMap[row.chapter_id].notes += cnt;
        else if (row.type === 'dpp_pdf') countMap[row.chapter_id].dpp_pdfs += cnt;
      }

      for (const row of quizCounts) {
        if (!countMap[row.chapter_id]) continue;
        countMap[row.chapter_id].quizzes += (parseInt(row.count, 10) || 0);
      }

      chaptersWithCounts = chapters.map(ch => {
        const c = countMap[ch.id] || { lectures: 0, notes: 0, quizzes: 0, dpp_pdfs: 0, dpp_videos: 0 };
        return {
          ...ch,
          lectures_count: c.lectures,
          notes_count: c.notes,
          dpp_quizzes_count: c.quizzes,
          dpp_pdfs_count: c.dpp_pdfs,
          dpp_videos_count: c.dpp_videos
        };
      });
    }

    res.json({ chapters: chaptersWithCounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chapters', chapters: [] });
  }
});

// POST /api/admin/chapters
router.post('/chapters', isAdmin, async (req, res) => {
  const { subject_id, title, chapter_number = 1, description = '', display_order = 0, is_published = 1 } = req.body;
  if (!subject_id || !title || !title.trim()) {
    return res.status(400).json({ error: 'Subject ID and Chapter Title are required' });
  }

  try {
    const subId = parseInt(subject_id, 10);
    const subject = await db.get('SELECT id FROM subjects WHERE id = ?', [subId]);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found for this chapter' });
    }

    const result = await db.run(
      'INSERT INTO chapters (subject_id, title, chapter_number, description, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?)',
      [
        subId,
        title.trim(),
        parseInt(chapter_number, 10) || 1,
        description ? String(description).trim() : '',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );

    const countObj = await db.get('SELECT COUNT(*) as count FROM chapters WHERE subject_id = ?', [subId]);
    const count = parseInt(countObj?.count || 0, 10);
    await db.run('UPDATE subjects SET chapter_count = ? WHERE id = ?', [count, subId]);

    const chapter = await db.get('SELECT * FROM chapters WHERE id = ?', [result.lastInsertRowid]);
    if (!chapter) {
      return res.status(500).json({ error: 'Failed to verify created chapter in database' });
    }
    res.status(201).json({ success: true, chapter });
  } catch (err) {
    console.error('Add chapter error:', err);
    res.status(500).json({ error: 'Failed to add chapter: ' + (err.message || 'Server error') });
  }
});

// GET /api/admin/subjects/:id/chapters
router.get('/subjects/:id/chapters', isAdmin, async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  try {
    const chapters = await db.all(
      'SELECT * FROM chapters WHERE subject_id = ? ORDER BY display_order ASC, chapter_number ASC, id ASC',
      [subjectId]
    );
    res.json({ chapters });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subject chapters', chapters: [] });
  }
});

// POST /api/admin/subjects/:id/chapters
router.post('/subjects/:id/chapters', isAdmin, async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  const { title, chapter_number = 1, description = '', display_order = 0, is_published = 1 } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Chapter title is required' });
  }

  try {
    const subject = await db.get('SELECT id FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const result = await db.run(
      'INSERT INTO chapters (subject_id, title, chapter_number, description, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?)',
      [
        subjectId,
        title.trim(),
        parseInt(chapter_number, 10) || 1,
        description ? String(description).trim() : '',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );

    const countObj = await db.get('SELECT COUNT(*) as count FROM chapters WHERE subject_id = ?', [subjectId]);
    const count = parseInt(countObj?.count || 0, 10);
    await db.run('UPDATE subjects SET chapter_count = ? WHERE id = ?', [count, subjectId]);

    const chapter = await db.get('SELECT * FROM chapters WHERE id = ?', [result.lastInsertRowid]);
    if (!chapter) {
      return res.status(500).json({ error: 'Failed to verify created chapter in database' });
    }
    res.status(201).json({ success: true, chapter });
  } catch (err) {
    console.error('Add chapter error:', err);
    res.status(500).json({ error: 'Failed to add chapter: ' + (err.message || 'Server error') });
  }
});

// PUT /api/admin/chapters/:id
router.put('/chapters/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, chapter_number, description, display_order, is_published } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Chapter title is required' });
  }

  try {
    const existing = await db.get('SELECT id FROM chapters WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    await db.run(
      'UPDATE chapters SET title = ?, chapter_number = ?, description = ?, display_order = ?, is_published = ? WHERE id = ?',
      [
        title.trim(),
        parseInt(chapter_number, 10) || 1,
        description ? String(description).trim() : '',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0,
        id
      ]
    );
    const chapter = await db.get('SELECT * FROM chapters WHERE id = ?', [id]);
    if (!chapter) {
      return res.status(500).json({ error: 'Failed to verify updated chapter in database' });
    }
    res.json({ success: true, chapter });
  } catch (err) {
    console.error('Update chapter error:', err);
    res.status(500).json({ error: 'Failed to update chapter: ' + (err.message || 'Server error') });
  }
});

// DELETE /api/admin/chapters/:id
router.delete('/chapters/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const chapter = await db.get('SELECT id, subject_id FROM chapters WHERE id = ?', [id]);
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found or already deleted' });
    }
    const subjectId = chapter.subject_id;

    // Delete associated resources, quizzes, pdfs, videos safely before deleting chapter
    await db.run('DELETE FROM lecture_resources WHERE chapter_id = ?', [id]);
    await db.run('DELETE FROM quizzes WHERE chapter_id = ?', [id]);
    await db.run('DELETE FROM pdfs WHERE chapter_id = ?', [id]);
    await db.run('DELETE FROM videos WHERE chapter_id = ?', [id]);
    await db.run('DELETE FROM chapters WHERE id = ?', [id]);

    const check = await db.get('SELECT id FROM chapters WHERE id = ?', [id]);
    if (check) {
      return res.status(500).json({ error: 'Failed to delete chapter: record still exists in database' });
    }

    if (subjectId) {
      const countObj = await db.get('SELECT COUNT(*) as count FROM chapters WHERE subject_id = ?', [subjectId]);
      const count = parseInt(countObj?.count || 0, 10);
      await db.run('UPDATE subjects SET chapter_count = ? WHERE id = ?', [count, subjectId]);
    }

    res.json({ success: true, message: 'Chapter deleted' });
  } catch (err) {
    console.error('Delete chapter error:', err);
    res.status(500).json({ error: 'Failed to delete chapter: ' + (err.message || 'Server error') });
  }
});

// GET /api/admin/chapters/:id/content - get full chapter content with all tabs
router.get('/chapters/:id/content', isAdmin, async (req, res) => {
  const chapterId = parseInt(req.params.id, 10);
  try {
    const chapter = await db.get('SELECT * FROM chapters WHERE id = ?', [chapterId]);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [chapter.subject_id]);
    const batch = subject ? await db.get('SELECT * FROM batches WHERE id = ?', [subject.batch_id]) : null;

    const [rawLectures, notes, dpp_pdfs, dpp_videos, quizzes] = await Promise.all([
      db.all("SELECT * FROM videos WHERE chapter_id = ? AND type = 'lecture' ORDER BY CASE WHEN lecture_date IS NOT NULL AND lecture_date != '' THEN lecture_date ELSE '1970-01-01' END DESC, display_order ASC, id DESC", [chapterId]),
      db.all("SELECT * FROM pdfs WHERE chapter_id = ? AND type = 'note' ORDER BY display_order ASC, id ASC", [chapterId]),
      db.all("SELECT * FROM pdfs WHERE chapter_id = ? AND type = 'dpp_pdf' ORDER BY display_order ASC, id ASC", [chapterId]),
      db.all("SELECT * FROM videos WHERE chapter_id = ? AND type = 'dpp_video' ORDER BY display_order ASC, id ASC", [chapterId]),
      db.all("SELECT * FROM quizzes WHERE chapter_id = ? ORDER BY display_order ASC, id ASC", [chapterId])
    ]);

    // Batch fetch all extra resources for these lectures in one query
    const lectureIds = rawLectures.map(l => l.id);
    let allResources = [];
    if (lectureIds.length > 0) {
      const resPlaceholders = lectureIds.map(() => '?').join(',');
      allResources = await db.all(`SELECT * FROM lecture_resources WHERE video_id IN (${resPlaceholders}) ORDER BY display_order ASC, id ASC`, lectureIds);
    }

    const resourcesByVideo = {};
    for (const r of allResources) {
      if (!resourcesByVideo[r.video_id]) resourcesByVideo[r.video_id] = [];
      resourcesByVideo[r.video_id].push(r);
    }

    // Batch specific teachers & build teacher map
    const batchTeachers = batch ? await db.all("SELECT * FROM teachers WHERE (batch_id = ? OR batch_id IS NULL) AND is_active = 1 ORDER BY display_order ASC, id ASC", [batch.id]) : await db.all("SELECT * FROM teachers WHERE is_active = 1 ORDER BY display_order ASC, id ASC");
    const teacherMap = {};
    for (const t of batchTeachers) {
      if (t.name) {
        teacherMap[t.name.toLowerCase().trim()] = t;
      }
    }

    // Attach linked resources & extra resources to each lecture in-memory
    const lectures = rawLectures.map(lec => {
      const linkedNote = notes.find(n => n.lecture_id === lec.id || (n.display_order === lec.display_order && !n.lecture_id)) || null;
      const linkedDppPdf = dpp_pdfs.find(p => p.lecture_id === lec.id || (p.display_order === lec.display_order && !p.lecture_id)) || null;
      const linkedDppVideo = dpp_videos.find(v => v.lecture_id === lec.id || (v.display_order === lec.display_order && !v.lecture_id)) || null;
      const linkedQuiz = quizzes.find(q => q.lecture_id === lec.id || (q.display_order === lec.display_order && !q.lecture_id)) || null;
      const extraResources = resourcesByVideo[lec.id] || [];

      const teacherName = (lec.teacher_name && lec.teacher_name.trim()) || subject?.default_teacher_name || '';
      const teacherObj = teacherMap[teacherName.toLowerCase()];
      const teacherPhoto = (teacherObj && (teacherObj.photo_url || teacherObj.default_thumbnail_url)) ? (teacherObj.photo_url || teacherObj.default_thumbnail_url).trim() : '';
      const resolvedThumb = teacherPhoto || (lec.thumbnail_url && lec.thumbnail_url.trim()) || subject?.default_thumbnail_url || batch?.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600';

      return {
        ...lec,
        teacher_name: teacherName,
        thumbnail_url: resolvedThumb,
        notes: linkedNote,
        dpp_pdf: linkedDppPdf,
        dpp_video: linkedDppVideo,
        quiz: linkedQuiz,
        extra_resources: extraResources
      };
    });

    res.json({
      chapter,
      subject,
      batch,
      batch_teachers: batchTeachers,
      lectures,
      notes,
      dpp_pdfs,
      dpp_videos,
      quizzes,
      counts: {
        lectures: lectures.length,
        notes: notes.length,
        dpp_pdfs: dpp_pdfs.length,
        dpp_videos: dpp_videos.length,
        quizzes: quizzes.length,
        total: lectures.length + notes.length + dpp_pdfs.length + dpp_videos.length + quizzes.length
      }
    });
  } catch (err) {
    console.error('Get chapter content error:', err);
    res.status(500).json({ error: 'Failed to load chapter content' });
  }
});

// GET /api/admin/lectures/:id - Get full details of a single lecture and its attached resources for editing
router.get('/lectures/:id', isAdmin, async (req, res) => {
  const lectureId = parseInt(req.params.id, 10);
  try {
    const lecture = await db.get("SELECT * FROM videos WHERE id = ?", [lectureId]);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

    const chapterId = lecture.chapter_id;
    const chapter = chapterId ? await db.get("SELECT * FROM chapters WHERE id = ?", [chapterId]) : null;
    const subject = chapter ? await db.get("SELECT * FROM subjects WHERE id = ?", [chapter.subject_id]) : (lecture.subject_id ? await db.get("SELECT * FROM subjects WHERE id = ?", [lecture.subject_id]) : null);
    const batch = subject ? await db.get("SELECT * FROM batches WHERE id = ?", [subject.batch_id]) : null;

    const linkedNote = await db.get("SELECT * FROM pdfs WHERE type = 'note' AND (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureId, chapterId, lecture.display_order]);
    const linkedDppPdf = await db.get("SELECT * FROM pdfs WHERE type = 'dpp_pdf' AND (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureId, chapterId, lecture.display_order]);
    const linkedDppVideo = await db.get("SELECT * FROM videos WHERE type = 'dpp_video' AND (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureId, chapterId, lecture.display_order]);
    const linkedQuiz = await db.get("SELECT * FROM quizzes WHERE (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureId, chapterId, lecture.display_order]);
    const extraResources = await db.all("SELECT * FROM lecture_resources WHERE video_id = ? ORDER BY display_order ASC, id ASC", [lectureId]);

    const batchTeachers = batch ? await db.all("SELECT * FROM teachers WHERE (batch_id = ? OR batch_id IS NULL) AND is_active = 1 ORDER BY display_order ASC, id ASC", [batch.id]) : [];

    res.json({
      lecture,
      chapter,
      subject,
      batch,
      batch_teachers: batchTeachers,
      notes: linkedNote || null,
      dpp_pdf: linkedDppPdf || null,
      dpp_video: linkedDppVideo || null,
      quiz: linkedQuiz || null,
      extra_resources: extraResources || []
    });
  } catch (err) {
    console.error('Error fetching single lecture:', err);
    res.status(500).json({ error: 'Failed to retrieve lecture details' });
  }
});

// Helper to save or update unified lecture
async function handleSaveUnifiedLecture(req, res, targetChapterId, existingLectureId = null) {
  const chapterId = parseInt(targetChapterId, 10);
  const chapter = await db.get('SELECT * FROM chapters WHERE id = ?', [chapterId]);
  if (!chapter) {
    return res.status(404).json({ error: 'Chapter not found' });
  }
  const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [chapter.subject_id]);
  const defaultTeacher = subject?.default_teacher_name || '';

  const b = req.body || {};
  const id = b.id;
  const lecture_id = b.lecture_id;
  const lecture_number = b.lecture_number;
  const lecture_title = (b.lecture_title || b.title || '').trim();
  const lecture_video_url = (b.lecture_video_url || b.external_link || b.video_url || '').trim();
  const lecture_duration = (b.lecture_duration || b.duration || '45 mins').trim();
  const teacher_name = (b.teacher_name || '').trim();
  const thumbnail_url = (b.thumbnail_url || '').trim();
  const lecture_order = b.lecture_order !== undefined ? b.lecture_order : (b.display_order !== undefined ? b.display_order : 0);
  const rawLectureDate = b.lecture_date;
  let lecture_date = '';
  if (rawLectureDate && String(rawLectureDate).trim()) {
    lecture_date = normalizeDate(String(rawLectureDate).trim());
  } else if (existingLectureId) {
    const existing = await db.get('SELECT lecture_date FROM videos WHERE id = ?', [existingLectureId]);
    lecture_date = existing?.lecture_date || getTodayIST();
  } else {
    lecture_date = getTodayIST();
  }
  // Auto-compute is_today based on lecture_date vs today's date
  const is_today = (lecture_date === getTodayIST()) ? 1 : 0;
  const is_live = b.is_live || 0;
  const is_published = b.is_published !== undefined ? b.is_published : 1;

  // Notes
  const notes_title = (b.notes_title || '').trim();
  const notes_pdf_url = (b.notes_pdf_url || b.notes_link || b.notes_url || '').trim();
  const notes_file_size = (b.notes_file_size || b.file_size || '2.4 MB').trim();

  // DPP PDF
  const dpp_pdf_title = (b.dpp_pdf_title || '').trim();
  const dpp_pdf_url = (b.dpp_pdf_url || b.dpp_pdf_link || b.dpp_url || '').trim();
  const dpp_pdf_file_size = (b.dpp_pdf_file_size || '1.5 MB').trim();

  // DPP Video
  const dpp_video_title = (b.dpp_video_title || '').trim();
  const dpp_video_url = (b.dpp_video_url || b.dpp_video_link || '').trim();
  const dpp_video_duration = (b.dpp_video_duration || '30 mins').trim();
  const dpp_video_teacher = (b.dpp_video_teacher || '').trim();

  // DPP Quiz
  const dpp_quiz_title = (b.dpp_quiz_title || b.quiz_title || '').trim();
  const dpp_quiz_total_questions = b.dpp_quiz_total_questions || b.quiz_total_questions || b.total_questions || 10;
  const dpp_quiz_duration = b.dpp_quiz_duration || b.quiz_duration_mins || b.duration_mins || 15;
  const dpp_quiz_link = (b.dpp_quiz_link || b.quiz_link || '').trim();

  // Extra Resources
  const extra_resources = Array.isArray(b.extra_resources) ? b.extra_resources : [];

  const targetLecId = existingLectureId || id || lecture_id || null;

  if (!lecture_title || !lecture_video_url) {
    return res.status(400).json({ error: 'Lecture title and video URL are required' });
  }

  try {
    const finalTeacher = (teacher_name && teacher_name.trim()) || defaultTeacher || '';
    const orderNum = parseInt(lecture_order, 10) || 0;
    const lecNum = (lecture_number !== undefined && lecture_number !== null && String(lecture_number).trim() !== '') ? parseInt(lecture_number, 10) : orderNum;
    const pubVal = is_published !== undefined ? (is_published ? 1 : 0) : 1;
    const isLiveVal = (is_live === 1 || is_live === '1' || is_live === true || is_live === 'true' || is_live === 'on') ? 1 : 0;
    const finalDate = lecture_date;
    const isTodayVal = (finalDate === getTodayIST() || isLiveVal === 1) ? 1 : 0;

    let lectureVideoId = targetLecId ? parseInt(targetLecId, 10) : null;

    if (lectureVideoId) {
      // UPDATE EXISTING LECTURE VIDEO
      await db.run(
        `UPDATE videos SET
          subject_id = ?,
          chapter_id = ?,
          title = ?,
          external_link = ?,
          thumbnail_url = ?,
          duration = ?,
          teacher_name = ?,
          type = 'lecture',
          display_order = ?,
          lecture_number = ?,
          lecture_date = ?,
          is_today = ?,
          is_live = ?,
          is_published = ?
         WHERE id = ?`,
        [
          chapter.subject_id,
          chapterId,
          lecture_title.trim(),
          lecture_video_url.trim(),
          thumbnail_url ? thumbnail_url.trim() : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600',
          lecture_duration || '45 mins',
          finalTeacher,
          orderNum,
          lecNum,
          finalDate,
          isTodayVal,
          isLiveVal,
          pubVal,
          lectureVideoId
        ]
      );
    } else {
      // INSERT NEW LECTURE VIDEO
      const videoRes = await db.run(
        `INSERT INTO videos (subject_id, chapter_id, title, external_link, thumbnail_url, duration, teacher_name, type, display_order, lecture_number, lecture_date, is_today, is_live, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'lecture', ?, ?, ?, ?, ?, ?)`,
        [
          chapter.subject_id,
          chapterId,
          lecture_title.trim(),
          lecture_video_url.trim(),
          thumbnail_url ? thumbnail_url.trim() : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600',
          lecture_duration || '45 mins',
          finalTeacher,
          orderNum,
          lecNum,
          finalDate,
          isTodayVal,
          isLiveVal,
          pubVal
        ]
      );
      lectureVideoId = videoRes.lastInsertRowid;
    }

    const currentVideo = await db.get('SELECT * FROM videos WHERE id = ?', [lectureVideoId]);

    // 2. NOTES PDF (UPDATE / INSERT / DELETE) - STRICTLY type = 'note'
    const existingNote = await db.get("SELECT * FROM pdfs WHERE type = 'note' AND (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureVideoId, chapterId, orderNum]);
    let savedNotes = null;

    if (notes_pdf_url && notes_pdf_url.trim()) {
      const nTitle = (notes_title && notes_title.trim()) || `${lecture_title.trim()} - Class Notes`;
      if (existingNote) {
        await db.run(
          `UPDATE pdfs SET
            subject_id = ?,
            chapter_id = ?,
            lecture_id = ?,
            title = ?,
            external_link = ?,
            type = 'note',
            file_size = ?,
            lecture_date = ?,
            display_order = ?,
            is_published = ?
           WHERE id = ?`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            nTitle,
            notes_pdf_url.trim(),
            notes_file_size || '2.4 MB',
            finalDate,
            orderNum,
            pubVal,
            existingNote.id
          ]
        );
        savedNotes = await db.get('SELECT * FROM pdfs WHERE id = ?', [existingNote.id]);
      } else {
        const noteRes = await db.run(
          `INSERT INTO pdfs (subject_id, chapter_id, lecture_id, title, external_link, type, file_size, lecture_date, display_order, is_published)
           VALUES (?, ?, ?, ?, ?, 'note', ?, ?, ?, ?)`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            nTitle,
            notes_pdf_url.trim(),
            notes_file_size || '2.4 MB',
            finalDate,
            orderNum,
            pubVal
          ]
        );
        savedNotes = await db.get('SELECT * FROM pdfs WHERE id = ?', [noteRes.lastInsertRowid]);
      }
    } else if (existingNote && targetLecId) {
      await db.run('DELETE FROM pdfs WHERE id = ?', [existingNote.id]);
    }

    // 3. DPP PDF (UPDATE / INSERT / DELETE) - STRICTLY type = 'dpp_pdf'
    const existingDppPdf = await db.get("SELECT * FROM pdfs WHERE type = 'dpp_pdf' AND (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureVideoId, chapterId, orderNum]);
    let savedDppPdf = null;

    if (dpp_pdf_url && dpp_pdf_url.trim()) {
      const dTitle = (dpp_pdf_title && dpp_pdf_title.trim()) || `${lecture_title.trim()} - DPP`;
      if (existingDppPdf) {
        await db.run(
          `UPDATE pdfs SET
            subject_id = ?,
            chapter_id = ?,
            lecture_id = ?,
            title = ?,
            external_link = ?,
            type = 'dpp_pdf',
            file_size = ?,
            lecture_date = ?,
            display_order = ?,
            is_published = ?
           WHERE id = ?`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            dTitle,
            dpp_pdf_url.trim(),
            dpp_pdf_file_size || '1.5 MB',
            finalDate,
            orderNum,
            pubVal,
            existingDppPdf.id
          ]
        );
        savedDppPdf = await db.get('SELECT * FROM pdfs WHERE id = ?', [existingDppPdf.id]);
      } else {
        const dppRes = await db.run(
          `INSERT INTO pdfs (subject_id, chapter_id, lecture_id, title, external_link, type, file_size, lecture_date, display_order, is_published)
           VALUES (?, ?, ?, ?, ?, 'dpp_pdf', ?, ?, ?, ?)`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            dTitle,
            dpp_pdf_url.trim(),
            dpp_pdf_file_size || '1.5 MB',
            finalDate,
            orderNum,
            pubVal
          ]
        );
        savedDppPdf = await db.get('SELECT * FROM pdfs WHERE id = ?', [dppRes.lastInsertRowid]);
      }
    } else if (existingDppPdf && targetLecId) {
      await db.run('DELETE FROM pdfs WHERE id = ?', [existingDppPdf.id]);
    }

    // 4. DPP VIDEO (UPDATE / INSERT / DELETE) - STRICTLY type = 'dpp_video'
    const existingDppVideo = await db.get("SELECT * FROM videos WHERE type = 'dpp_video' AND (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureVideoId, chapterId, orderNum]);
    let savedDppVideo = null;

    if (dpp_video_url && dpp_video_url.trim()) {
      const dvTitle = (dpp_video_title && dpp_video_title.trim()) || `${lecture_title.trim()} - DPP Video Solution`;
      const dvTeacher = (dpp_video_teacher && dpp_video_teacher.trim()) || finalTeacher;
      if (existingDppVideo) {
        await db.run(
          `UPDATE videos SET
            subject_id = ?,
            chapter_id = ?,
            lecture_id = ?,
            title = ?,
            external_link = ?,
            thumbnail_url = ?,
            duration = ?,
            teacher_name = ?,
            type = 'dpp_video',
            display_order = ?,
            is_published = ?
           WHERE id = ?`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            dvTitle,
            dpp_video_url.trim(),
            thumbnail_url ? thumbnail_url.trim() : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600',
            dpp_video_duration || '30 mins',
            dvTeacher,
            orderNum,
            pubVal,
            existingDppVideo.id
          ]
        );
        savedDppVideo = await db.get('SELECT * FROM videos WHERE id = ?', [existingDppVideo.id]);
      } else {
        const dvRes = await db.run(
          `INSERT INTO videos (subject_id, chapter_id, lecture_id, title, external_link, thumbnail_url, duration, teacher_name, type, display_order, is_published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dpp_video', ?, ?)`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            dvTitle,
            dpp_video_url.trim(),
            thumbnail_url ? thumbnail_url.trim() : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600',
            dpp_video_duration || '30 mins',
            dvTeacher,
            orderNum,
            pubVal
          ]
        );
        savedDppVideo = await db.get('SELECT * FROM videos WHERE id = ?', [dvRes.lastInsertRowid]);
      }
    } else if (existingDppVideo && targetLecId) {
      await db.run('DELETE FROM videos WHERE id = ?', [existingDppVideo.id]);
    }

    // 5. DPP QUIZ (UPDATE / INSERT / DELETE)
    const existingQuiz = await db.get("SELECT * FROM quizzes WHERE (lecture_id = ? OR (chapter_id = ? AND display_order = ?)) LIMIT 1", [lectureVideoId, chapterId, orderNum]);
    let savedQuiz = null;

    if (dpp_quiz_title && dpp_quiz_title.trim()) {
      if (existingQuiz) {
        await db.run(
          `UPDATE quizzes SET
            subject_id = ?,
            chapter_id = ?,
            lecture_id = ?,
            title = ?,
            external_link = ?,
            total_questions = ?,
            duration_mins = ?,
            display_order = ?,
            is_published = ?
           WHERE id = ?`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            dpp_quiz_title.trim(),
            dpp_quiz_link ? dpp_quiz_link.trim() : '',
            parseInt(dpp_quiz_total_questions, 10) || 10,
            parseInt(dpp_quiz_duration, 10) || 15,
            orderNum,
            pubVal,
            existingQuiz.id
          ]
        );
        savedQuiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [existingQuiz.id]);
      } else {
        const qRes = await db.run(
          `INSERT INTO quizzes (subject_id, chapter_id, lecture_id, title, external_link, total_questions, duration_mins, display_order, is_published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chapter.subject_id,
            chapterId,
            lectureVideoId,
            dpp_quiz_title.trim(),
            dpp_quiz_link ? dpp_quiz_link.trim() : '',
            parseInt(dpp_quiz_total_questions, 10) || 10,
            parseInt(dpp_quiz_duration, 10) || 15,
            orderNum,
            pubVal
          ]
        );
        savedQuiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [qRes.lastInsertRowid]);
      }
    } else if (existingQuiz && targetLecId) {
      await db.run('DELETE FROM quizzes WHERE id = ?', [existingQuiz.id]);
    }

    // 6. EXTRA RESOURCES (UNLIMITED)
    const submittedResourceIds = [];
    if (Array.isArray(extra_resources)) {
      for (let idx = 0; idx < extra_resources.length; idx++) {
        const resItem = extra_resources[idx];
        if (!resItem || !resItem.title || !resItem.url) continue;
        const resTitle = resItem.title.trim();
        const resUrl = resItem.url.trim();
        const resType = resItem.resource_type || resItem.type || 'Link';
        const resDesc = resItem.description || '';
        const resLabel = resItem.display_label || resItem.label || '';
        const resOrder = parseInt(resItem.display_order, 10) || idx + 1;
        const resActive = resItem.is_active !== undefined ? (resItem.is_active ? 1 : 0) : 1;

        if (resItem.id && typeof resItem.id === 'number') {
          // Update existing extra resource
          await db.run(
            `UPDATE lecture_resources SET
              title = ?,
              resource_type = ?,
              url = ?,
              description = ?,
              display_label = ?,
              display_order = ?,
              is_active = ?
             WHERE id = ? AND video_id = ?`,
            [resTitle, resType, resUrl, resDesc, resLabel, resOrder, resActive, resItem.id, lectureVideoId]
          );
          submittedResourceIds.push(resItem.id);
        } else {
          // Insert new extra resource
          const insRes = await db.run(
            `INSERT INTO lecture_resources (video_id, chapter_id, title, resource_type, url, description, display_label, display_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lectureVideoId, chapterId, resTitle, resType, resUrl, resDesc, resLabel, resOrder, resActive]
          );
          submittedResourceIds.push(insRes.lastInsertRowid);
        }
      }
    }

    // Clean up removed extra resources for this lecture
    if (targetLecId) {
      if (submittedResourceIds.length > 0) {
        const placeholders = submittedResourceIds.map(() => '?').join(',');
        await db.run(`DELETE FROM lecture_resources WHERE video_id = ? AND id NOT IN (${placeholders})`, [lectureVideoId, ...submittedResourceIds]);
      } else {
        await db.run('DELETE FROM lecture_resources WHERE video_id = ?', [lectureVideoId]);
      }
    }

    const savedExtraResources = await db.all('SELECT * FROM lecture_resources WHERE video_id = ? ORDER BY display_order ASC, id ASC', [lectureVideoId]);

    res.status(targetLecId ? 200 : 201).json({
      success: true,
      message: targetLecId ? 'Lecture & resources updated successfully' : 'Unified lecture and resources added successfully',
      data: {
        lecture: currentVideo,
        notes: savedNotes,
        dpp_pdf: savedDppPdf,
        dpp_video: savedDppVideo,
        quiz: savedQuiz,
        extra_resources: savedExtraResources
      }
    });
  } catch (err) {
    console.error('Unified lecture error:', err);
    res.status(500).json({ error: 'Failed to save unified lecture' });
  }
}

// POST /api/admin/chapters/:id/unified-lecture - Unified Add / Update Lecture Form
router.post('/chapters/:id/unified-lecture', isAdmin, async (req, res) => {
  await handleSaveUnifiedLecture(req, res, req.params.id);
});

// PUT /api/admin/lectures/:id/unified - Unified Edit Lecture Form directly
router.put('/lectures/:id/unified', isAdmin, async (req, res) => {
  const lectureId = parseInt(req.params.id, 10);
  const lecture = await db.get('SELECT * FROM videos WHERE id = ?', [lectureId]);
  if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
  await handleSaveUnifiedLecture(req, res, lecture.chapter_id, lectureId);
});

// STATUS TOGGLE / PATCH ROUTES FOR ALL ENTITIES
router.patch('/batches/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isPublished = req.body.is_published !== undefined ? (req.body.is_published ? 1 : 0) : 1;
  try {
    await db.run('UPDATE batches SET is_published = ? WHERE id = ?', [isPublished, id]);
    res.json({ success: true, id, is_published: isPublished });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update batch status' });
  }
});

router.patch('/chapters/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isPublished = req.body.is_published !== undefined ? (req.body.is_published ? 1 : 0) : 1;
  try {
    await db.run('UPDATE chapters SET is_published = ? WHERE id = ?', [isPublished, id]);
    res.json({ success: true, id, is_published: isPublished });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update chapter status' });
  }
});

router.patch('/videos/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isPublished = req.body.is_published !== undefined ? (req.body.is_published ? 1 : 0) : 1;
  try {
    await db.run('UPDATE videos SET is_published = ? WHERE id = ?', [isPublished, id]);
    res.json({ success: true, id, is_published: isPublished });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update video status' });
  }
});

router.patch('/videos/:id/today', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isToday = req.body.is_today !== undefined ? (req.body.is_today ? 1 : 0) : 1;
  try {
    await db.run('UPDATE videos SET is_today = ? WHERE id = ?', [isToday, id]);
    res.json({ success: true, id, is_today: isToday });
  } catch (err) {
    res.status(500).json({ error: "Failed to update today's status" });
  }
});

router.patch('/videos/:id/live', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isLive = req.body.is_live !== undefined ? (req.body.is_live ? 1 : 0) : 1;
  try {
    await db.run('UPDATE videos SET is_live = ? WHERE id = ?', [isLive, id]);
    res.json({ success: true, id, is_live: isLive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update live status' });
  }
});

router.patch('/pdfs/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isPublished = req.body.is_published !== undefined ? (req.body.is_published ? 1 : 0) : 1;
  try {
    await db.run('UPDATE pdfs SET is_published = ? WHERE id = ?', [isPublished, id]);
    res.json({ success: true, id, is_published: isPublished });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pdf status' });
  }
});

router.patch('/quizzes/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isPublished = req.body.is_published !== undefined ? (req.body.is_published ? 1 : 0) : 1;
  try {
    await db.run('UPDATE quizzes SET is_published = ? WHERE id = ?', [isPublished, id]);
    res.json({ success: true, id, is_published: isPublished });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update quiz status' });
  }
});

router.patch('/teachers/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;
  try {
    await db.run('UPDATE teachers SET is_active = ? WHERE id = ?', [isActive, id]);
    res.json({ success: true, id, is_active: isActive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update teacher status' });
  }
});

router.patch('/nav-links/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;
  try {
    await db.run('UPDATE nav_links SET is_active = ? WHERE id = ?', [isActive, id]);
    res.json({ success: true, id, is_active: isActive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update nav link status' });
  }
});

// GET /api/admin/hierarchy - returns all batches -> subjects -> chapters
router.get('/hierarchy', isAdmin, async (req, res) => {
  try {
    const batches = await db.all('SELECT id, title FROM batches ORDER BY id DESC');
    const subjects = await db.all('SELECT id, batch_id, name, icon FROM subjects ORDER BY display_order ASC, id ASC');
    const chapters = await db.all('SELECT id, subject_id, title, chapter_number FROM chapters ORDER BY display_order ASC, chapter_number ASC, id ASC');

    res.json({
      batches,
      subjects,
      chapters
    });
  } catch (err) {
    console.error('Hierarchy error:', err);
    res.status(500).json({ error: 'Failed to fetch hierarchy' });
  }
});

// ==========================================
// VIDEOS / LECTURES / DPP VIDEOS CRUD
// ==========================================

// GET /api/admin/subjects/:id/videos
router.get('/subjects/:id/videos', isAdmin, async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  try {
    const videos = await db.all('SELECT * FROM videos WHERE subject_id = ? ORDER BY display_order ASC, id ASC', [subjectId]);
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subject videos', videos: [] });
  }
});

// POST /api/admin/subjects/:id/videos
router.post('/subjects/:id/videos', isAdmin, async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  const { chapter_id, title, external_link, thumbnail_url, duration = '45 mins', teacher_name = '', type = 'lecture', display_order = 0, is_published = 1 } = req.body;
  if (!title || !external_link) {
    return res.status(400).json({ error: 'Title and video link are required' });
  }

  try {
    const result = await db.run(
      `INSERT INTO videos (subject_id, chapter_id, title, external_link, thumbnail_url, duration, teacher_name, type, display_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subjectId,
        chapter_id ? parseInt(chapter_id, 10) : null,
        title.trim(),
        external_link.trim(),
        thumbnail_url ? thumbnail_url.trim() : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600',
        duration || '45 mins',
        teacher_name || '',
        type || 'lecture',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );
    const video = await db.get('SELECT * FROM videos WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, video });
  } catch (err) {
    console.error('Add video error:', err);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

// GET /api/admin/videos (with filters)
router.get('/videos', isAdmin, async (req, res) => {
  const subjectId = req.query.subject_id ? parseInt(req.query.subject_id, 10) : null;
  const chapterId = req.query.chapter_id ? parseInt(req.query.chapter_id, 10) : null;
  const type = req.query.type || null;

  try {
    let sql = 'SELECT * FROM videos WHERE 1=1';
    const params = [];

    if (subjectId) {
      sql += ' AND subject_id = ?';
      params.push(subjectId);
    }
    if (chapterId) {
      sql += ' AND chapter_id = ?';
      params.push(chapterId);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY display_order ASC, id ASC';

    const videos = await db.all(sql, params);
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch videos', videos: [] });
  }
});

// POST /api/admin/videos
router.post('/videos', isAdmin, async (req, res) => {
  const {
    subject_id,
    chapter_id,
    title,
    external_link,
    thumbnail_url,
    duration = '45 mins',
    teacher_name = '',
    type = 'lecture',
    display_order = 0,
    is_published = 1
  } = req.body;

  if (!subject_id || !title || !external_link) {
    return res.status(400).json({ error: 'Subject, Title, and Video Link are required' });
  }

  try {
    const result = await db.run(
      `INSERT INTO videos (subject_id, chapter_id, title, external_link, thumbnail_url, duration, teacher_name, type, display_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(subject_id, 10),
        chapter_id ? parseInt(chapter_id, 10) : null,
        title,
        external_link,
        thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600',
        duration,
        teacher_name,
        type || 'lecture',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );
    const video = await db.get('SELECT * FROM videos WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, video });
  } catch (err) {
    console.error('Add video error:', err);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

// PUT /api/admin/videos/:id
router.put('/videos/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    subject_id,
    chapter_id,
    title,
    external_link,
    thumbnail_url,
    duration,
    teacher_name,
    type,
    display_order,
    is_published
  } = req.body;

  if (!title || !external_link) {
    return res.status(400).json({ error: 'Title and external link are required' });
  }

  try {
    await db.run(
      `UPDATE videos SET 
        subject_id = COALESCE(?, subject_id),
        chapter_id = ?,
        title = ?,
        external_link = ?,
        thumbnail_url = ?,
        duration = ?,
        teacher_name = ?,
        type = ?,
        display_order = ?,
        is_published = ?
       WHERE id = ?`,
      [
        subject_id ? parseInt(subject_id, 10) : null,
        chapter_id ? parseInt(chapter_id, 10) : null,
        title,
        external_link,
        thumbnail_url,
        duration,
        teacher_name,
        type || 'lecture',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0,
        id
      ]
    );
    const video = await db.get('SELECT * FROM videos WHERE id = ?', [id]);
    res.json({ success: true, video });
  } catch (err) {
    console.error('Update video error:', err);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// DELETE /api/admin/videos/:id
router.delete('/videos/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM lecture_resources WHERE video_id = ?', [id]);
    await db.run('DELETE FROM pdfs WHERE lecture_id = ?', [id]);
    await db.run('DELETE FROM videos WHERE lecture_id = ?', [id]);
    await db.run('DELETE FROM quizzes WHERE lecture_id = ?', [id]);
    await db.run('DELETE FROM videos WHERE id = ?', [id]);
    res.json({ success: true, message: 'Lecture and all associated resources deleted successfully' });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// ==========================================
// PDFS / NOTES / DPP PDFS CRUD
// ==========================================

// GET /api/admin/subjects/:id/pdfs
router.get('/subjects/:id/pdfs', isAdmin, async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  try {
    const pdfs = await db.all('SELECT * FROM pdfs WHERE subject_id = ? ORDER BY display_order ASC, id ASC', [subjectId]);
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PDFs', pdfs: [] });
  }
});

// POST /api/admin/subjects/:id/pdfs
router.post('/subjects/:id/pdfs', isAdmin, async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  const { chapter_id, title, external_link, type = 'note', file_size = '2.4 MB', display_order = 0, is_published = 1 } = req.body;
  if (!title || !external_link) {
    return res.status(400).json({ error: 'Title and PDF link are required' });
  }

  try {
    const result = await db.run(
      'INSERT INTO pdfs (subject_id, chapter_id, title, external_link, type, file_size, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        subjectId,
        chapter_id ? parseInt(chapter_id, 10) : null,
        title.trim(),
        external_link.trim(),
        type || 'note',
        file_size || '2.4 MB',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );
    const pdf = await db.get('SELECT * FROM pdfs WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, pdf });
  } catch (err) {
    console.error('Add PDF error:', err);
    res.status(500).json({ error: 'Failed to add PDF' });
  }
});

// GET /api/admin/pdfs (with filters)
router.get('/pdfs', isAdmin, async (req, res) => {
  const subjectId = req.query.subject_id ? parseInt(req.query.subject_id, 10) : null;
  const chapterId = req.query.chapter_id ? parseInt(req.query.chapter_id, 10) : null;
  const type = req.query.type || null;

  try {
    let sql = 'SELECT * FROM pdfs WHERE 1=1';
    const params = [];

    if (subjectId) {
      sql += ' AND subject_id = ?';
      params.push(subjectId);
    }
    if (chapterId) {
      sql += ' AND chapter_id = ?';
      params.push(chapterId);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY display_order ASC, id ASC';

    const pdfs = await db.all(sql, params);
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PDFs', pdfs: [] });
  }
});

// POST /api/admin/pdfs
router.post('/pdfs', isAdmin, async (req, res) => {
  const {
    subject_id,
    chapter_id,
    title,
    external_link,
    type = 'note',
    file_size = '2.4 MB',
    display_order = 0,
    is_published = 1
  } = req.body;

  if (!subject_id || !title || !external_link) {
    return res.status(400).json({ error: 'Subject, Title, and PDF link are required' });
  }

  try {
    const result = await db.run(
      'INSERT INTO pdfs (subject_id, chapter_id, title, external_link, type, file_size, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        parseInt(subject_id, 10),
        chapter_id ? parseInt(chapter_id, 10) : null,
        title,
        external_link,
        type || 'note',
        file_size || '2.4 MB',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );
    const pdf = await db.get('SELECT * FROM pdfs WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, pdf });
  } catch (err) {
    console.error('Add PDF error:', err);
    res.status(500).json({ error: 'Failed to add PDF' });
  }
});

// PUT /api/admin/pdfs/:id
router.put('/pdfs/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    subject_id,
    chapter_id,
    title,
    external_link,
    type,
    file_size,
    display_order,
    is_published
  } = req.body;

  if (!title || !external_link) {
    return res.status(400).json({ error: 'Title and external link are required' });
  }

  try {
    await db.run(
      `UPDATE pdfs SET 
        subject_id = COALESCE(?, subject_id),
        chapter_id = ?,
        title = ?,
        external_link = ?,
        type = ?,
        file_size = ?,
        display_order = ?,
        is_published = ?
       WHERE id = ?`,
      [
        subject_id ? parseInt(subject_id, 10) : null,
        chapter_id ? parseInt(chapter_id, 10) : null,
        title,
        external_link,
        type || 'note',
        file_size || '2.4 MB',
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0,
        id
      ]
    );
    const pdf = await db.get('SELECT * FROM pdfs WHERE id = ?', [id]);
    res.json({ success: true, pdf });
  } catch (err) {
    console.error('Update PDF error:', err);
    res.status(500).json({ error: 'Failed to update PDF' });
  }
});

// DELETE /api/admin/pdfs/:id
router.delete('/pdfs/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM pdfs WHERE id = ?', [id]);
    res.json({ success: true, message: 'PDF deleted' });
  } catch (err) {
    console.error('Delete PDF error:', err);
    res.status(500).json({ error: 'Failed to delete PDF' });
  }
});

// ==========================================
// DPP QUIZZES CRUD
// ==========================================

// GET /api/admin/quizzes
router.get('/quizzes', isAdmin, async (req, res) => {
  const subjectId = req.query.subject_id ? parseInt(req.query.subject_id, 10) : null;
  const chapterId = req.query.chapter_id ? parseInt(req.query.chapter_id, 10) : null;

  try {
    let sql = 'SELECT * FROM quizzes WHERE 1=1';
    const params = [];

    if (subjectId) {
      sql += ' AND subject_id = ?';
      params.push(subjectId);
    }
    if (chapterId) {
      sql += ' AND chapter_id = ?';
      params.push(chapterId);
    }
    sql += ' ORDER BY display_order ASC, id ASC';

    const quizzes = await db.all(sql, params);
    res.json({ quizzes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quizzes', quizzes: [] });
  }
});

// POST /api/admin/quizzes
router.post('/quizzes', isAdmin, async (req, res) => {
  const {
    subject_id,
    chapter_id,
    title,
    external_link = '',
    total_questions = 10,
    duration_mins = 15,
    questions_json = '',
    display_order = 0,
    is_published = 1
  } = req.body;

  if (!subject_id || !title) {
    return res.status(400).json({ error: 'Subject and Quiz Title are required' });
  }

  try {
    const result = await db.run(
      'INSERT INTO quizzes (subject_id, chapter_id, title, external_link, total_questions, duration_mins, questions_json, display_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        parseInt(subject_id, 10),
        chapter_id ? parseInt(chapter_id, 10) : null,
        title,
        external_link || '',
        parseInt(total_questions, 10) || 10,
        parseInt(duration_mins, 10) || 15,
        typeof questions_json === 'object' ? JSON.stringify(questions_json) : (questions_json || ''),
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0
      ]
    );
    const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, quiz });
  } catch (err) {
    console.error('Add quiz error:', err);
    res.status(500).json({ error: 'Failed to add quiz' });
  }
});

// PUT /api/admin/quizzes/:id
router.put('/quizzes/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    subject_id,
    chapter_id,
    title,
    external_link,
    total_questions,
    duration_mins,
    questions_json,
    display_order,
    is_published
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Quiz title is required' });
  }

  try {
    await db.run(
      `UPDATE quizzes SET
        subject_id = COALESCE(?, subject_id),
        chapter_id = ?,
        title = ?,
        external_link = ?,
        total_questions = ?,
        duration_mins = ?,
        questions_json = ?,
        display_order = ?,
        is_published = ?
       WHERE id = ?`,
      [
        subject_id ? parseInt(subject_id, 10) : null,
        chapter_id ? parseInt(chapter_id, 10) : null,
        title,
        external_link || '',
        parseInt(total_questions, 10) || 10,
        parseInt(duration_mins, 10) || 15,
        typeof questions_json === 'object' ? JSON.stringify(questions_json) : (questions_json || ''),
        parseInt(display_order, 10) || 0,
        is_published ? 1 : 0,
        id
      ]
    );
    const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [id]);
    res.json({ success: true, quiz });
  } catch (err) {
    console.error('Update quiz error:', err);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// DELETE /api/admin/quizzes/:id
router.delete('/quizzes/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM quizzes WHERE id = ?', [id]);
    res.json({ success: true, message: 'Quiz deleted' });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// ==========================================
// USERS MANAGEMENT
// ==========================================

// GET /api/admin/users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.name, u.email, u.xp, u.created_at,
             COUNT(e.id) as enrolled_count
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.id DESC
    `);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', users: [] });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==========================================
// ANNOUNCEMENTS MANAGEMENT
// ==========================================

// GET /api/admin/announcements/:batchId
router.get('/announcements/:batchId', isAdmin, async (req, res) => {
  const batchId = parseInt(req.params.batchId, 10);
  try {
    const announcements = await db.all('SELECT * FROM announcements WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements', announcements: [] });
  }
});

// POST /api/admin/announcements
router.post('/announcements', isAdmin, async (req, res) => {
  const { batch_id, message } = req.body;
  if (!batch_id || !message) {
    return res.status(400).json({ error: 'Batch ID and message are required' });
  }

  try {
    const result = await db.run('INSERT INTO announcements (batch_id, message) VALUES (?, ?)', [parseInt(batch_id, 10), message.trim()]);
    const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, announcement });
  } catch (err) {
    console.error('Add announcement error:', err);
    res.status(500).json({ error: 'Failed to add announcement' });
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/announcements/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM announcements WHERE id = ?', [id]);
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ==========================================
// SITE SETTINGS MANAGEMENT
// ==========================================

// GET /api/admin/settings
router.get('/settings', isAdmin, async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM site_settings');
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', settings: {} });
  }
});

// POST & PUT /api/admin/settings - update one or all settings (optimized parallel execution)
const handleSettingsUpdate = async (req, res) => {
  const { key, value, settings } = req.body;

  try {
    const entriesToSave = [];

    if (settings && typeof settings === 'object') {
      for (const [k, v] of Object.entries(settings)) {
        const valStr = String(v ?? '');
        entriesToSave.push([k, valStr]);
        if (k === 'site_logo_url') entriesToSave.push(['logo_url', valStr]);
        else if (k === 'logo_url') entriesToSave.push(['site_logo_url', valStr]);
      }
    } else if (key) {
      const valStr = String(value ?? '');
      entriesToSave.push([key, valStr]);
      if (key === 'site_logo_url') entriesToSave.push(['logo_url', valStr]);
      else if (key === 'logo_url') entriesToSave.push(['site_logo_url', valStr]);
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      for (const [k, v] of Object.entries(req.body)) {
        const valStr = String(v ?? '');
        entriesToSave.push([k, valStr]);
        if (k === 'site_logo_url') entriesToSave.push(['logo_url', valStr]);
        else if (k === 'logo_url') entriesToSave.push(['site_logo_url', valStr]);
      }
    } else {
      return res.status(400).json({ error: 'No settings data provided' });
    }

    // Execute all upserts in parallel
    await Promise.all(
      entriesToSave.map(([k, valStr]) =>
        db.run(
          'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [k, valStr]
        )
      )
    );

    const rows = await db.all('SELECT key, value FROM site_settings');
    const updatedSettings = {};
    for (const r of rows) {
      updatedSettings[r.key] = r.value;
    }
    res.json({ success: true, message: 'Settings saved successfully', settings: updatedSettings });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

router.post('/settings', isAdmin, handleSettingsUpdate);
router.put('/settings', isAdmin, handleSettingsUpdate);

// ==========================================
// BANNERS MANAGEMENT
// ==========================================

// GET /api/admin/banners - get all banners with carousel settings (optimized parallel execution)
router.get('/banners', isAdmin, async (req, res) => {
  try {
    const [banners, intervalRow, autoSlideRow] = await Promise.all([
      db.all('SELECT * FROM banners ORDER BY display_order ASC, id ASC'),
      db.get('SELECT value FROM site_settings WHERE key = ?', ['banner_interval']),
      db.get('SELECT value FROM site_settings WHERE key = ?', ['banner_auto_slide'])
    ]);

    res.json({
      banners: banners || [],
      settings: {
        banner_interval: intervalRow ? parseInt(intervalRow.value, 10) || 4000 : 4000,
        banner_auto_slide: autoSlideRow ? parseInt(autoSlideRow.value, 10) !== 0 : true
      }
    });
  } catch (err) {
    console.error('Error fetching admin banners:', err);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// GET /api/admin/banners/:id
router.get('/banners/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const banner = await db.get('SELECT * FROM banners WHERE id = ?', [id]);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });
    res.json({ banner });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch banner' });
  }
});

// POST /api/admin/banners - create a new promotional banner
router.post('/banners', isAdmin, async (req, res) => {
  const {
    title,
    subtitle = '',
    image_url,
    redirect_url = '',
    badge_text = 'SPECIAL OFFER',
    badge_color = '#EF4444',
    display_order = 0,
    is_active = 1
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Banner title is required' });
  }
  if (!image_url || !image_url.trim()) {
    return res.status(400).json({ error: 'Banner image URL is required' });
  }

  try {
    let orderNum = parseInt(display_order, 10);
    if (!orderNum) {
      const maxOrderObj = await db.get('SELECT MAX(display_order) as max_ord FROM banners');
      orderNum = (parseInt(maxOrderObj?.max_ord, 10) || 0) + 1;
    }

    const result = await db.run(
      `INSERT INTO banners (title, subtitle, image_url, redirect_url, badge_text, badge_color, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        subtitle.trim(),
        image_url.trim(),
        redirect_url.trim(),
        badge_text.trim() || 'SPECIAL OFFER',
        badge_color.trim() || '#EF4444',
        orderNum,
        is_active ? 1 : 0
      ]
    );

    const banner = await db.get('SELECT * FROM banners WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, banner, message: 'Banner added successfully' });
  } catch (err) {
    console.error('Create banner error:', err);
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

// PUT /api/admin/banners/:id - update a banner
router.put('/banners/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    title,
    subtitle = '',
    image_url,
    redirect_url = '',
    badge_text = 'SPECIAL OFFER',
    badge_color = '#EF4444',
    display_order = 0,
    is_active = 1
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Banner title is required' });
  }
  if (!image_url || !image_url.trim()) {
    return res.status(400).json({ error: 'Banner image URL is required' });
  }

  try {
    await db.run(
      `UPDATE banners SET
        title = ?,
        subtitle = ?,
        image_url = ?,
        redirect_url = ?,
        badge_text = ?,
        badge_color = ?,
        display_order = ?,
        is_active = ?
       WHERE id = ?`,
      [
        title.trim(),
        subtitle.trim(),
        image_url.trim(),
        redirect_url.trim(),
        badge_text.trim(),
        badge_color.trim(),
        parseInt(display_order, 10) || 0,
        is_active ? 1 : 0,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM banners WHERE id = ?', [id]);
    res.json({ success: true, banner: updated, message: 'Banner updated successfully' });
  } catch (err) {
    console.error('Update banner error:', err);
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

// PATCH /api/admin/banners/:id/status - update status
router.patch('/banners/:id/status', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;
  try {
    await db.run('UPDATE banners SET is_active = ? WHERE id = ?', [isActive, id]);
    res.json({ success: true, id, is_active: isActive });
  } catch (err) {
    console.error('Banner status error:', err);
    res.status(500).json({ error: 'Failed to update banner status' });
  }
});

// PATCH /api/admin/banners/:id/toggle - quick toggle enable/disable
router.patch('/banners/:id/toggle', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const banner = await db.get('SELECT id, is_active FROM banners WHERE id = ?', [id]);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    const newStatus = banner.is_active ? 0 : 1;
    await db.run('UPDATE banners SET is_active = ? WHERE id = ?', [newStatus, id]);

    res.json({ success: true, id, is_active: newStatus, message: `Banner ${newStatus ? 'enabled' : 'disabled'}` });
  } catch (err) {
    console.error('Toggle banner error:', err);
    res.status(500).json({ error: 'Failed to toggle banner status' });
  }
});

// POST /api/admin/banners/reorder - batch reorder banners
router.post('/banners/reorder', isAdmin, async (req, res) => {
  const { order, banners } = req.body;

  try {
    if (Array.isArray(order)) {
      for (let index = 0; index < order.length; index++) {
        await db.run('UPDATE banners SET display_order = ? WHERE id = ?', [index + 1, parseInt(order[index], 10)]);
      }
    } else if (Array.isArray(banners)) {
      for (let index = 0; index < banners.length; index++) {
        const b = banners[index];
        const id = b.id || b;
        const ord = b.display_order !== undefined ? parseInt(b.display_order, 10) : index + 1;
        await db.run('UPDATE banners SET display_order = ? WHERE id = ?', [ord, parseInt(id, 10)]);
      }
    } else {
      return res.status(400).json({ error: 'Order or banners array is required' });
    }

    const updated = await db.all('SELECT * FROM banners ORDER BY display_order ASC, id ASC');
    res.json({ success: true, banners: updated, message: 'Banner order updated' });
  } catch (err) {
    console.error('Reorder banners error:', err);
    res.status(500).json({ error: 'Failed to reorder banners' });
  }
});

// DELETE /api/admin/banners/:id - delete a banner
router.delete('/banners/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.run('DELETE FROM banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (err) {
    console.error('Delete banner error:', err);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

// POST & PUT /api/admin/banners/settings - update carousel interval and auto-slide settings
const handleBannerSettings = async (req, res) => {
  const interval = req.body.banner_interval !== undefined ? req.body.banner_interval : req.body.interval;
  const autoSlide = req.body.banner_auto_slide !== undefined ? req.body.banner_auto_slide : req.body.auto_slide;

  try {
    if (interval !== undefined) {
      await db.run(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        ['banner_interval', String(parseInt(interval, 10) || 4000)]
      );
    }

    if (autoSlide !== undefined) {
      await db.run(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        ['banner_auto_slide', autoSlide ? '1' : '0']
      );
    }

    res.json({
      success: true,
      message: 'Banner carousel settings updated successfully',
      settings: {
        banner_interval: interval !== undefined ? parseInt(interval, 10) || 4000 : 4000,
        banner_auto_slide: autoSlide !== undefined ? !!autoSlide : true
      }
    });
  } catch (err) {
    console.error('Update banner settings error:', err);
    res.status(500).json({ error: 'Failed to update banner settings' });
  }
};
router.post('/banners/settings', isAdmin, handleBannerSettings);
router.put('/banners/settings', isAdmin, handleBannerSettings);

// ==========================================
// TEACHERS / FACULTY CRUD
// ==========================================

// GET /api/admin/teachers (supports ?batch_id=X)
router.get('/teachers', isAdmin, async (req, res) => {
  const batchId = req.query.batch_id ? parseInt(req.query.batch_id, 10) : null;
  try {
    let teachers = [];
    if (batchId) {
      teachers = await db.all(
        `SELECT t.*, b.title AS batch_title 
         FROM teachers t 
         LEFT JOIN batches b ON t.batch_id = b.id 
         WHERE t.batch_id = ? OR t.batch_id IS NULL
         ORDER BY t.display_order ASC, t.id ASC`,
        [batchId]
      );
    } else {
      teachers = await db.all(
        `SELECT t.*, b.title AS batch_title 
         FROM teachers t 
         LEFT JOIN batches b ON t.batch_id = b.id 
         ORDER BY t.display_order ASC, t.id ASC`
      );
    }
    res.json({ teachers });
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ error: 'Failed to fetch teachers', teachers: [] });
  }
});

// GET /api/admin/batches/:id/teachers
router.get('/batches/:id/teachers', isAdmin, async (req, res) => {
  const batchId = parseInt(req.params.id, 10);
  try {
    const teachers = await db.all(
      `SELECT t.*, b.title AS batch_title 
       FROM teachers t 
       LEFT JOIN batches b ON t.batch_id = b.id 
       WHERE t.batch_id = ? OR t.batch_id IS NULL
       ORDER BY t.display_order ASC, t.id ASC`,
      [batchId]
    );
    res.json({ teachers });
  } catch (err) {
    console.error('Error fetching batch teachers:', err);
    res.status(500).json({ error: 'Failed to fetch batch teachers', teachers: [] });
  }
});

// POST /api/admin/teachers
router.post('/teachers', isAdmin, async (req, res) => {
  const {
    name,
    subject = '',
    subjects_taught = '',
    batch_id = null,
    photo_url = '',
    default_thumbnail_url = '',
    bio = '',
    experience = '',
    is_active = 1,
    display_order = 0
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Teacher name is required' });
  }

  const subjectName = (subject || subjects_taught || '').trim();
  if (!subjectName) {
    return res.status(400).json({ error: 'Subject taught is required' });
  }

  try {
    const bId = batch_id !== undefined && batch_id !== null && batch_id !== '' ? parseInt(batch_id, 10) : null;
    const result = await db.run(
      'INSERT INTO teachers (name, subject, subjects_taught, batch_id, photo_url, default_thumbnail_url, bio, experience, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name.trim(),
        subjectName,
        subjectName,
        bId,
        photo_url ? String(photo_url).trim() : '',
        default_thumbnail_url ? String(default_thumbnail_url).trim() : '',
        bio ? String(bio).trim() : '',
        experience ? String(experience).trim() : '',
        is_active ? 1 : 0,
        parseInt(display_order, 10) || 0
      ]
    );

    const teacher = await db.get(
      'SELECT t.*, b.title AS batch_title FROM teachers t LEFT JOIN batches b ON t.batch_id = b.id WHERE t.id = ?',
      [result.lastInsertRowid]
    );
    if (!teacher) {
      return res.status(500).json({ error: 'Failed to verify created educator in database' });
    }
    res.status(201).json({ success: true, teacher });
  } catch (err) {
    console.error('Create teacher error:', err);
    res.status(500).json({ error: 'Failed to add teacher: ' + (err.message || 'Server error') });
  }
});

// PUT /api/admin/teachers/:id
router.put('/teachers/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    name,
    subject = '',
    subjects_taught = '',
    batch_id,
    photo_url = '',
    default_thumbnail_url = '',
    bio = '',
    experience = '',
    is_active = 1,
    display_order = 0
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Teacher name is required' });
  }

  const subjectName = (subject || subjects_taught || '').trim();
  if (!subjectName) {
    return res.status(400).json({ error: 'Subject taught is required' });
  }

  try {
    const existing = await db.get('SELECT id FROM teachers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Educator not found' });
    }

    const bId = batch_id !== undefined && batch_id !== null && batch_id !== '' ? parseInt(batch_id, 10) : null;
    await db.run(
      'UPDATE teachers SET name = ?, subject = ?, subjects_taught = ?, batch_id = ?, photo_url = ?, default_thumbnail_url = ?, bio = ?, experience = ?, is_active = ?, display_order = ? WHERE id = ?',
      [
        name.trim(),
        subjectName,
        subjectName,
        bId,
        photo_url ? String(photo_url).trim() : '',
        default_thumbnail_url !== undefined ? String(default_thumbnail_url).trim() : '',
        bio ? String(bio).trim() : '',
        experience ? String(experience).trim() : '',
        is_active ? 1 : 0,
        parseInt(display_order, 10) || 0,
        id
      ]
    );

    const teacher = await db.get(
      'SELECT t.*, b.title AS batch_title FROM teachers t LEFT JOIN batches b ON t.batch_id = b.id WHERE t.id = ?',
      [id]
    );
    if (!teacher) {
      return res.status(500).json({ error: 'Failed to verify updated educator in database' });
    }
    res.json({ success: true, teacher });
  } catch (err) {
    console.error('Update teacher error:', err);
    res.status(500).json({ error: 'Failed to update teacher: ' + (err.message || 'Server error') });
  }
});

// DELETE /api/admin/teachers/:id
router.delete('/teachers/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const existing = await db.get('SELECT id, name FROM teachers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Educator not found or already deleted' });
    }

    await db.run('DELETE FROM teachers WHERE id = ?', [id]);
    const check = await db.get('SELECT id FROM teachers WHERE id = ?', [id]);
    if (check) {
      return res.status(500).json({ error: 'Failed to delete educator: record still exists in database' });
    }
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ error: 'Failed to delete teacher: ' + (err.message || 'Server error') });
  }
});

// ==========================================
// NAVIGATION LINKS CRUD
// ==========================================

// GET /api/admin/nav-links
router.get('/nav-links', isAdmin, async (req, res) => {
  try {
    const navLinks = await db.all('SELECT * FROM nav_links ORDER BY display_order ASC, id ASC');
    res.json({ navLinks, links: navLinks });
  } catch (err) {
    console.error('Error fetching nav links:', err);
    res.status(500).json({ error: 'Failed to fetch navigation links', navLinks: [], links: [] });
  }
});

// POST /api/admin/nav-links
router.post('/nav-links', isAdmin, async (req, res) => {
  const { label, icon = '🔗', url, is_external = 0, display_order = 0, is_active = 1 } = req.body;
  if (!label || !label.trim() || !url || !url.trim()) {
    return res.status(400).json({ error: 'Label and destination URL are required' });
  }

  try {
    const result = await db.run(
      'INSERT INTO nav_links (label, icon, url, is_external, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [
        label.trim(),
        (icon || '🔗').trim(),
        url.trim(),
        is_external ? 1 : 0,
        parseInt(display_order, 10) || 0,
        is_active ? 1 : 0
      ]
    );

    const navLink = await db.get('SELECT * FROM nav_links WHERE id = ?', [result.lastInsertRowid]);
    if (!navLink) {
      return res.status(500).json({ error: 'Failed to verify created navigation item in database' });
    }
    res.status(201).json({ success: true, navLink, link: navLink });
  } catch (err) {
    console.error('Create nav link error:', err);
    res.status(500).json({ error: 'Failed to add navigation link: ' + (err.message || 'Server error') });
  }
});

// PUT /api/admin/nav-links/:id
router.put('/nav-links/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { label, icon, url, is_external, display_order, is_active } = req.body;
  if (!label || !label.trim() || !url || !url.trim()) {
    return res.status(400).json({ error: 'Label and destination URL are required' });
  }

  try {
    const existing = await db.get('SELECT id FROM nav_links WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Navigation item not found' });
    }

    await db.run(
      'UPDATE nav_links SET label = ?, icon = ?, url = ?, is_external = ?, display_order = ?, is_active = ? WHERE id = ?',
      [
        label.trim(),
        (icon || '🔗').trim(),
        url.trim(),
        is_external ? 1 : 0,
        parseInt(display_order, 10) || 0,
        is_active ? 1 : 0,
        id
      ]
    );

    const navLink = await db.get('SELECT * FROM nav_links WHERE id = ?', [id]);
    if (!navLink) {
      return res.status(500).json({ error: 'Failed to verify updated navigation item in database' });
    }
    res.json({ success: true, navLink, link: navLink });
  } catch (err) {
    console.error('Update nav link error:', err);
    res.status(500).json({ error: 'Failed to update navigation link: ' + (err.message || 'Server error') });
  }
});

// DELETE /api/admin/nav-links/:id
router.delete('/nav-links/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const existing = await db.get('SELECT id, label FROM nav_links WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Navigation item not found or already deleted' });
    }

    await db.run('DELETE FROM nav_links WHERE id = ?', [id]);
    const check = await db.get('SELECT id FROM nav_links WHERE id = ?', [id]);
    if (check) {
      return res.status(500).json({ error: 'Failed to delete navigation link: item still exists' });
    }
    res.json({ success: true, message: 'Navigation link deleted successfully' });
  } catch (err) {
    console.error('Delete nav link error:', err);
    res.status(500).json({ error: 'Failed to delete navigation link: ' + (err.message || 'Server error') });
  }
});

export default router;
