import express from 'express';
import { db, getTodayIST } from '../db.js';

const router = express.Router();

// Helper to fetch all active teachers and build a lookup map by name and batch_id
async function getActiveTeachersMap() {
  try {
    const teachers = await db.all('SELECT * FROM teachers WHERE is_active = 1');
    const map = {};
    if (Array.isArray(teachers)) {
      for (const t of teachers) {
        if (t && t.name) {
          const cleanName = t.name.toLowerCase().trim();
          map[cleanName] = t;
          if (t.batch_id) {
            map[`${t.batch_id}_${cleanName}`] = t;
          }
        }
      }
    }
    return map;
  } catch (err) {
    console.error('Error fetching teachers map:', err);
    return {};
  }
}

// Helper to resolve lecture thumbnail: Teacher's photo/logo takes primary priority
function resolveTeacherThumbnail(lec, teacherMap, fallbackThumb = '') {
  const teacherName = (lec.teacher_name && lec.teacher_name.trim()) || lec.default_teacher_name || '';
  const cleanName = teacherName.toLowerCase().trim();
  const batchId = lec.batch_id || (lec.batch && lec.batch.id);

  const teacherObj = (batchId && teacherMap[`${batchId}_${cleanName}`]) || teacherMap[cleanName];
  const teacherPhoto = (teacherObj && (teacherObj.photo_url || teacherObj.default_thumbnail_url))
    ? (teacherObj.photo_url || teacherObj.default_thumbnail_url).trim()
    : '';

  // Primary: If teacher has photo/logo assigned, use it automatically for ALL lectures of that teacher
  if (teacherPhoto) {
    return teacherPhoto;
  }

  // Secondary: Explicit video thumbnail URL
  if (lec.thumbnail_url && lec.thumbnail_url.trim()) {
    return lec.thumbnail_url.trim();
  }

  // Fallback: Batch / Subject default thumbnail
  return fallbackThumb || lec.batch_thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600';
}

// GET /api/today-lectures - automatic today's lectures across batches or for a specific batch
router.get('/today-lectures', async (req, res) => {
  const batchId = req.query.batch_id ? parseInt(req.query.batch_id, 10) : null;
  const todayDate = getTodayIST();

  try {
    let sql = `
      SELECT v.*, 
             s.name as subject_name, s.batch_id, s.icon as subject_icon, s.default_teacher_name,
             b.title as batch_title, b.thumbnail_url as batch_thumbnail,
             c.title as chapter_title
      FROM videos v
      JOIN subjects s ON v.subject_id = s.id
      JOIN batches b ON s.batch_id = b.id
      LEFT JOIN chapters c ON v.chapter_id = c.id
      WHERE v.is_published = 1 
        AND v.type = 'lecture'
        AND (v.is_live = 1 OR v.lecture_date = ?)
        AND b.is_published = 1
    `;
    const params = [todayDate];

    if (batchId) {
      sql += ' AND s.batch_id = ?';
      params.push(batchId);
    }

    // Sort LIVE lectures first, then newest
    sql += ' ORDER BY v.is_live DESC, v.display_order ASC, v.id DESC';

    const [lectures, teacherMap] = await Promise.all([
      db.all(sql, params),
      getActiveTeachersMap()
    ]);

    // Fetch attached materials
    const lectureIds = lectures.map(l => l.id);
    let notes = [];
    let dppPdfs = [];
    let dppVideos = [];
    let quizzes = [];
    let extraRes = [];

    if (lectureIds.length > 0) {
      const placeholders = lectureIds.map(() => '?').join(',');
      const [allPdfs, allVids, allQuizzes, allResources] = await Promise.all([
        db.all(`SELECT * FROM pdfs WHERE lecture_id IN (${placeholders}) AND is_published = 1`, lectureIds),
        db.all(`SELECT * FROM videos WHERE lecture_id IN (${placeholders}) AND type = 'dpp_video' AND is_published = 1`, lectureIds),
        db.all(`SELECT * FROM quizzes WHERE lecture_id IN (${placeholders}) AND is_published = 1`, lectureIds),
        db.all(`SELECT * FROM lecture_resources WHERE video_id IN (${placeholders}) AND is_active = 1`, lectureIds)
      ]);

      notes = allPdfs.filter(p => p.type === 'note');
      dppPdfs = allPdfs.filter(p => p.type === 'dpp_pdf');
      dppVideos = allVids;
      quizzes = allQuizzes;
      extraRes = allResources;
    }

    const enrichedLectures = lectures.map(lec => {
      const note = notes.find(n => n.lecture_id === lec.id) || null;
      const dppPdf = dppPdfs.find(p => p.lecture_id === lec.id) || null;
      const dppVid = dppVideos.find(v => v.lecture_id === lec.id) || null;
      const quiz = quizzes.find(q => q.lecture_id === lec.id) || null;
      const res = extraRes.filter(r => r.video_id === lec.id);

      const teacherName = (lec.teacher_name && lec.teacher_name.trim()) || lec.default_teacher_name || 'Kota Master Faculty';
      const resolvedThumb = resolveTeacherThumbnail({ ...lec, teacher_name: teacherName }, teacherMap, lec.batch_thumbnail);

      return {
        ...lec,
        teacher_name: teacherName,
        thumbnail_url: resolvedThumb,
        today_date_ist: todayDate,
        notes: note,
        dpp_pdf: dppPdf,
        dpp_video: dppVid,
        dpp_quiz: quiz,
        extra_resources: res
      };
    });

    res.json({
      today_date: todayDate,
      count: enrichedLectures.length,
      lectures: enrichedLectures
    });
  } catch (err) {
    console.error('Error fetching today lectures:', err);
    res.json({ today_date: todayDate, count: 0, lectures: [] });
  }
});

// GET /api/upcoming-lectures - automatic scheduled/upcoming future lectures
router.get('/upcoming-lectures', async (req, res) => {
  const batchId = req.query.batch_id ? parseInt(req.query.batch_id, 10) : null;
  const todayDate = getTodayIST();

  try {
    let sql = `
      SELECT v.*, 
             s.name as subject_name, s.batch_id, s.icon as subject_icon, s.default_teacher_name,
             b.title as batch_title, b.thumbnail_url as batch_thumbnail,
             c.title as chapter_title
      FROM videos v
      JOIN subjects s ON v.subject_id = s.id
      JOIN batches b ON s.batch_id = b.id
      LEFT JOIN chapters c ON v.chapter_id = c.id
      WHERE v.is_published = 1 
        AND v.type = 'lecture'
        AND v.lecture_date > ?
        AND (v.is_live = 0 OR v.is_live IS NULL)
        AND b.is_published = 1
    `;
    const params = [todayDate];

    if (batchId) {
      sql += ' AND s.batch_id = ?';
      params.push(batchId);
    }

    // Sort by soonest upcoming date first
    sql += ' ORDER BY v.lecture_date ASC, v.display_order ASC, v.id ASC';

    const [lectures, teacherMap] = await Promise.all([
      db.all(sql, params),
      getActiveTeachersMap()
    ]);

    // Fetch attached materials
    const lectureIds = lectures.map(l => l.id);
    let notes = [];
    let dppPdfs = [];
    let dppVideos = [];
    let quizzes = [];
    let extraRes = [];

    if (lectureIds.length > 0) {
      const placeholders = lectureIds.map(() => '?').join(',');
      const [allPdfs, allVids, allQuizzes, allResources] = await Promise.all([
        db.all(`SELECT * FROM pdfs WHERE lecture_id IN (${placeholders}) AND is_published = 1`, lectureIds),
        db.all(`SELECT * FROM videos WHERE lecture_id IN (${placeholders}) AND type = 'dpp_video' AND is_published = 1`, lectureIds),
        db.all(`SELECT * FROM quizzes WHERE lecture_id IN (${placeholders}) AND is_published = 1`, lectureIds),
        db.all(`SELECT * FROM lecture_resources WHERE video_id IN (${placeholders}) AND is_active = 1`, lectureIds)
      ]);

      notes = allPdfs.filter(p => p.type === 'note');
      dppPdfs = allPdfs.filter(p => p.type === 'dpp_pdf');
      dppVideos = allVids;
      quizzes = allQuizzes;
      extraRes = allResources;
    }

    const enrichedLectures = lectures.map(lec => {
      const note = notes.find(n => n.lecture_id === lec.id) || null;
      const dppPdf = dppPdfs.find(p => p.lecture_id === lec.id) || null;
      const dppVid = dppVideos.find(v => v.lecture_id === lec.id) || null;
      const quiz = quizzes.find(q => q.lecture_id === lec.id) || null;
      const res = extraRes.filter(r => r.video_id === lec.id);

      const teacherName = (lec.teacher_name && lec.teacher_name.trim()) || lec.default_teacher_name || 'Kota Master Faculty';
      const resolvedThumb = resolveTeacherThumbnail({ ...lec, teacher_name: teacherName }, teacherMap, lec.batch_thumbnail);

      return {
        ...lec,
        teacher_name: teacherName,
        thumbnail_url: resolvedThumb,
        today_date_ist: todayDate,
        is_upcoming: true,
        notes: note,
        dpp_pdf: dppPdf,
        dpp_video: dppVid,
        dpp_quiz: quiz,
        extra_resources: res
      };
    });

    res.json({
      today_date: todayDate,
      count: enrichedLectures.length,
      lectures: enrichedLectures
    });
  } catch (err) {
    console.error('Error fetching upcoming lectures:', err);
    res.json({ today_date: todayDate, count: 0, lectures: [] });
  }
});

// GET /api/batches - all published batches (with search ?q=)
router.get('/batches', async (req, res) => {
  const query = (req.query.q || '').trim();

  try {
    let batches = [];
    if (query) {
      batches = await db.all(
        `SELECT * FROM batches 
         WHERE is_published = 1 AND (title ILIKE ? OR target_audience ILIKE ? OR language ILIKE ?)
         ORDER BY id DESC`,
        [`%${query}%`, `%${query}%`, `%${query}%`]
      );
    } else {
      batches = await db.all(
        `SELECT * FROM batches 
         WHERE is_published = 1 
         ORDER BY id DESC`
      );
    }

    res.json({ batches });
  } catch (err) {
    console.warn('Fallback empty batches list:', err.message);
    res.json({ batches: [], is_configured: db.isHealthy() });
  }
});

// GET /api/batches/:id - single batch with subjects, videos, PDFs, announcements
router.get('/batches/:id', async (req, res) => {
  const batchId = parseInt(req.params.id, 10);

  try {
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Get subjects
    const subjects = await db.all(
      'SELECT * FROM subjects WHERE batch_id = ? ORDER BY display_order ASC, id ASC',
      [batchId]
    );

    // Get videos and PDFs for each subject
    const subjectsWithContent = await Promise.all(
      subjects.map(async (subject) => {
        const videos = await db.all(
          'SELECT * FROM videos WHERE subject_id = ? AND is_published = 1 ORDER BY display_order ASC, id ASC',
          [subject.id]
        );
        const pdfs = await db.all(
          'SELECT * FROM pdfs WHERE subject_id = ? AND is_published = 1 ORDER BY display_order ASC, id ASC',
          [subject.id]
        );
        return {
          ...subject,
          videos,
          pdfs
        };
      })
    );

    // Get announcements
    const announcements = await db.all(
      'SELECT * FROM announcements WHERE batch_id = ? ORDER BY created_at DESC, id DESC',
      [batchId]
    );

    // Get batch-specific teachers (and global fallback teachers)
    const teachers = await db.all(
      'SELECT * FROM teachers WHERE (batch_id = ? OR batch_id IS NULL) AND is_active = 1 ORDER BY display_order ASC, id ASC',
      [batchId]
    );

    res.json({
      batch: {
        ...batch,
        is_enrolled: 1,
        subjects: subjectsWithContent,
        announcements,
        teachers
      }
    });
  } catch (err) {
    console.error('Error fetching single batch:', err);
    res.status(500).json({ error: 'Failed to retrieve batch details' });
  }
});

// GET /api/subjects/:id - single subject with all chapters & content counts
router.get('/subjects/:id', async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);

  try {
    const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const batch = await db.get('SELECT id, title, thumbnail_url, language, target_audience FROM batches WHERE id = ?', [subject.batch_id]);

    // Fetch all chapters for this subject
    const chapters = await db.all(
      'SELECT * FROM chapters WHERE subject_id = ? AND is_published = 1 ORDER BY display_order ASC, chapter_number ASC, id ASC',
      [subjectId]
    );

    let chaptersWithCounts = [];
    let totalLectures = 0;
    let totalNotes = 0;
    let totalQuizzes = 0;
    let totalDppPdfs = 0;
    let totalDppVideos = 0;

    if (chapters.length > 0) {
      const chapterIds = chapters.map(c => c.id);
      const inPlaceholders = chapterIds.map(() => '?').join(',');

      // High-performance grouped queries executed in parallel
      const [videoCounts, pdfCounts, quizCounts] = await Promise.all([
        db.all(`SELECT chapter_id, type, COUNT(*) as count FROM videos WHERE chapter_id IN (${inPlaceholders}) AND is_published = 1 GROUP BY chapter_id, type`, chapterIds),
        db.all(`SELECT chapter_id, type, COUNT(*) as count FROM pdfs WHERE chapter_id IN (${inPlaceholders}) AND is_published = 1 GROUP BY chapter_id, type`, chapterIds),
        db.all(`SELECT chapter_id, COUNT(*) as count FROM quizzes WHERE chapter_id IN (${inPlaceholders}) AND is_published = 1 GROUP BY chapter_id`, chapterIds)
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
        totalLectures += c.lectures;
        totalNotes += c.notes;
        totalQuizzes += c.quizzes;
        totalDppPdfs += c.dpp_pdfs;
        totalDppVideos += c.dpp_videos;

        return {
          ...ch,
          lectures_count: c.lectures,
          notes_count: c.notes,
          dpp_quizzes_count: c.quizzes,
          dpp_pdfs_count: c.dpp_pdfs,
          dpp_videos_count: c.dpp_videos,
          total_content_count: c.lectures + c.notes + c.quizzes + c.dpp_pdfs + c.dpp_videos
        };
      });
    }

    res.json({
      subject,
      batch,
      chapters: chaptersWithCounts,
      summary: {
        total_chapters: chaptersWithCounts.length,
        total_lectures: totalLectures,
        total_notes: totalNotes,
        total_dpp_quizzes: totalQuizzes,
        total_dpp_pdfs: totalDppPdfs,
        total_dpp_videos: totalDppVideos,
        total_dpps: totalQuizzes + totalDppPdfs + totalDppVideos
      }
    });
  } catch (err) {
    console.error('Error fetching subject details:', err);
    res.status(500).json({ error: 'Failed to retrieve subject details' });
  }
});

// GET /api/chapters/:id - single chapter with full 5-tab content
router.get('/chapters/:id', async (req, res) => {
  const chapterId = parseInt(req.params.id, 10);

  try {
    const chapter = await db.get('SELECT * FROM chapters WHERE id = ?', [chapterId]);
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const subject = await db.get('SELECT id, batch_id, name, icon, default_teacher_name, default_thumbnail_url FROM subjects WHERE id = ?', [chapter.subject_id]);
    const batch = subject ? await db.get('SELECT id, title, thumbnail_url, language, target_audience FROM batches WHERE id = ?', [subject.batch_id]) : null;

    // Fetch teachers for resolving default thumbnails
    const teachers = batch ? await db.all('SELECT * FROM teachers WHERE (batch_id = ? OR batch_id IS NULL) AND is_active = 1', [batch.id]) : [];
    const teacherMap = {};
    for (const t of teachers) {
      if (t.name) teacherMap[t.name.toLowerCase().trim()] = t;
    }

    // Fetch all content items for this chapter in parallel
    const [rawLectures, allPdfs, allVideos, rawQuizzes, siblingChapters] = await Promise.all([
      db.all("SELECT * FROM videos WHERE chapter_id = ? AND type = 'lecture' AND is_published = 1", [chapterId]),
      db.all("SELECT * FROM pdfs WHERE chapter_id = ? AND is_published = 1 ORDER BY display_order ASC, id ASC", [chapterId]),
      db.all("SELECT * FROM videos WHERE chapter_id = ? AND type = 'dpp_video' AND is_published = 1 ORDER BY display_order ASC, id ASC", [chapterId]),
      db.all("SELECT * FROM quizzes WHERE chapter_id = ? AND is_published = 1 ORDER BY display_order ASC, id ASC", [chapterId]),
      db.all('SELECT id, title, chapter_number FROM chapters WHERE subject_id = ? AND is_published = 1 ORDER BY display_order ASC, chapter_number ASC, id ASC', [chapter.subject_id])
    ]);

    // Parse lecture dates for robust sorting (newest date first)
    function parseDateTimestamp(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return 0;
      const s = dateStr.trim();
      if (!s) return 0;
      if (/today/i.test(s)) return Date.now() + 86400000; // Today ranks first
      const ts = Date.parse(s);
      if (!isNaN(ts)) return ts;
      const parts = s.split(/[-/.]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const d = new Date(year < 100 ? 2000 + year : year, month, day);
          if (!isNaN(d.getTime())) return d.getTime();
        }
      }
      return 0;
    }

    // Sort lectures by date (latest/newest first), without modifying lecture numbers
    rawLectures.sort((a, b) => {
      const tsA = parseDateTimestamp(a.lecture_date);
      const tsB = parseDateTimestamp(b.lecture_date);
      if (tsA !== tsB) {
        return tsB - tsA; // newest date first
      }
      // If dates match or are absent, sort by display_order / lecture_number or id
      const orderA = a.lecture_number != null ? a.lecture_number : (a.display_order || 0);
      const orderB = b.lecture_number != null ? b.lecture_number : (b.display_order || 0);
      if (orderA !== orderB) return orderB - orderA;
      return b.id - a.id;
    });

    // Fetch extra resources for all lectures in this chapter
    const lectureIds = rawLectures.map(l => l.id);
    let allResources = [];
    if (lectureIds.length > 0) {
      const resPlaceholders = lectureIds.map(() => '?').join(',');
      allResources = await db.all(`SELECT * FROM lecture_resources WHERE video_id IN (${resPlaceholders}) AND is_active = 1 ORDER BY display_order ASC, id ASC`, lectureIds);
    }

    const resourcesByVideo = {};
    for (const r of allResources) {
      if (!resourcesByVideo[r.video_id]) resourcesByVideo[r.video_id] = [];
      resourcesByVideo[r.video_id].push(r);
    }

    // Separate notes and dpp_pdfs strictly by type
    const notes = allPdfs.filter(p => p.type === 'note');
    const dpp_pdfs = allPdfs.filter(p => p.type === 'dpp_pdf');

    // Parse quizzes
    const dpp_quizzes = rawQuizzes.map(q => {
      let parsedQuestions = [];
      try {
        if (q.questions_json) {
          parsedQuestions = JSON.parse(q.questions_json);
        }
      } catch (e) {}
      return {
        ...q,
        questions: parsedQuestions
      };
    });

    // DPP Videos with teacher fallback
    const dpp_videos = allVideos.map(vid => ({
      ...vid,
      teacher_name: (vid.teacher_name && vid.teacher_name.trim()) || subject?.default_teacher_name || 'Kota Master Faculty'
    }));

    const defaultSubjectThumb = subject?.default_thumbnail_url || batch?.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600';

    // Attach linked materials in-memory with default thumbnail resolution
    const lectures = rawLectures.map(lec => {
      const linkedNote = notes.find(n => n.lecture_id === lec.id || (n.display_order === lec.display_order && !n.lecture_id)) || null;
      const linkedDppPdf = dpp_pdfs.find(p => p.lecture_id === lec.id || (p.display_order === lec.display_order && !p.lecture_id)) || null;
      const linkedDppVideo = dpp_videos.find(v => v.lecture_id === lec.id || (v.display_order === lec.display_order && !v.lecture_id)) || null;
      const linkedQuiz = dpp_quizzes.find(q => q.lecture_id === lec.id || (q.display_order === lec.display_order && !q.lecture_id)) || null;
      const extraResources = resourcesByVideo[lec.id] || [];

      const teacherName = (lec.teacher_name && lec.teacher_name.trim()) || subject?.default_teacher_name || 'Kota Master Faculty';
      const resolvedThumb = resolveTeacherThumbnail({ ...lec, teacher_name: teacherName, batch_id: batch?.id }, teacherMap, defaultSubjectThumb);

      return {
        ...lec,
        teacher_name: teacherName,
        thumbnail_url: resolvedThumb,
        notes: linkedNote,
        dpp_pdf: linkedDppPdf,
        dpp_video: linkedDppVideo,
        dpp_quiz: linkedQuiz,
        extra_resources: extraResources
      };
    });

    res.json({
      chapter,
      subject,
      batch,
      sibling_chapters: siblingChapters,
      content: {
        lectures,
        notes,
        dpp_quizzes,
        dpp_pdfs,
        dpp_videos
      },
      counts: {
        lectures: lectures.length,
        notes: notes.length,
        dpp_quizzes: dpp_quizzes.length,
        dpp_pdfs: dpp_pdfs.length,
        dpp_videos: dpp_videos.length,
        total: lectures.length + notes.length + dpp_quizzes.length + dpp_pdfs.length + dpp_videos.length
      }
    });
  } catch (err) {
    console.error('Error fetching chapter content:', err);
    res.status(500).json({ error: 'Failed to retrieve chapter content' });
  }
});

export default router;
