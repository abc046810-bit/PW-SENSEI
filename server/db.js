import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

let pool = null;
let isInitialized = false;
let initPromise = null;

// Convert SQLite '?' placeholders to PostgreSQL / CockroachDB '$1', '$2', ... placeholders
export function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Indian Standard Time (Asia/Kolkata) Date Helper: returns "YYYY-MM-DD" e.g. "2026-08-23"
export function getTodayIST() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    // Fallback if ICU data has issue
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Normalizes any incoming date string to standard "YYYY-MM-DD"
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return getTodayIST();
  const s = dateStr.trim();
  if (!s || /today/i.test(s)) return getTodayIST();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // If DD-MM-YYYY or DD/MM/YYYY or YYYY/MM/DD
  const parts = s.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const fullYear = year < 100 ? 2000 + year : year;
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(parsed);
    } catch (e) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return s;
}

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.trim()) {
    console.warn('⚠️ [COCKROACHDB CLOUD ALERT] DATABASE_URL environment variable is not set.');
    console.warn('Please supply DATABASE_URL in your hosting platform (e.g. Render Dashboard or Vercel Environment Variables).');
    return null;
  }

  // Configure CockroachDB Cloud PostgreSQL-compatible connection pool with SSL enabled
  pool = new Pool({
    connectionString: connectionString.trim(),
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('⚠️ Unexpected error on idle CockroachDB client:', err.message);
  });

  return pool;
}

export async function initDb() {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const currentPool = getPool();
    if (!currentPool) {
      console.log('ℹ️ Server waiting for DATABASE_URL environment variable.');
      return false;
    }

    try {
      const client = await currentPool.connect();
      console.log('🪳 Connected to CockroachDB Cloud database successfully.');

    // 1. Create Core Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50) DEFAULT '📚',
        default_teacher_name VARCHAR(255) DEFAULT '',
        chapter_count INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0
      );

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
        is_today INTEGER DEFAULT 0,
        is_live INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        is_published INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, batch_id)
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );

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
    `);

    // 2. Safe Column Migrations
    await client.query(`
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS teacher_name VARCHAR(255);
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'lecture';
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS lecture_id INTEGER;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS lecture_date VARCHAR(100) DEFAULT '';
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS lecture_number INTEGER;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_today INTEGER DEFAULT 0;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_live INTEGER DEFAULT 0;

      ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL;
      ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'note';
      ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS file_size VARCHAR(50) DEFAULT '2.4 MB';
      ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS lecture_id INTEGER;
      ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS lecture_date VARCHAR(100) DEFAULT '';

      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS lecture_id INTEGER;
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL;
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS default_thumbnail_url TEXT DEFAULT '';
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS default_teacher_name VARCHAR(255) DEFAULT '';
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS default_thumbnail_url TEXT DEFAULT '';
      ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `);

    // 3. Performance Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_batch_id ON subjects(batch_id);
      CREATE INDEX IF NOT EXISTS idx_chapters_subject_id ON chapters(subject_id);
      CREATE INDEX IF NOT EXISTS idx_videos_chapter_id ON videos(chapter_id);
      CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(type);
      CREATE INDEX IF NOT EXISTS idx_videos_is_today ON videos(is_today);
      CREATE INDEX IF NOT EXISTS idx_videos_is_live ON videos(is_live);
      CREATE INDEX IF NOT EXISTS idx_videos_lecture_date ON videos(lecture_date);
      CREATE INDEX IF NOT EXISTS idx_pdfs_chapter_id ON pdfs(chapter_id);
      CREATE INDEX IF NOT EXISTS idx_pdfs_type ON pdfs(type);
      CREATE INDEX IF NOT EXISTS idx_quizzes_chapter_id ON quizzes(chapter_id);
      CREATE INDEX IF NOT EXISTS idx_teachers_batch_id ON teachers(batch_id);
      CREATE INDEX IF NOT EXISTS idx_lecture_resources_video_id ON lecture_resources(video_id);
    `);

    // 4. Seed Default Site Settings if empty
    const settingsRes = await client.query('SELECT COUNT(*) as count FROM site_settings');
    const settingsCount = parseInt(settingsRes.rows[0].count, 10);

    if (settingsCount === 0) {
      const defaultSettings = {
        site_name: "PW SENSEI",
        site_logo_url: "",
        hero_heading: "We Make Education Affordable.",
        hero_subheading: "Access premium educational content, structured live batches, and comprehensive study materials from India's top educators.",
        hero_cta_text: "Start Learning Now",
        hero_cta_link: "/study.html",
        notice_bar_text: "🚀 Vidyapeeth 2026 Batch Lectures & DPPs are now LIVE! Join our official Telegram channel for updates.",
        notice_bar_link: "https://t.me/pwsensei_official",
        notice_bar_active: "1",
        app_download_link: "https://t.me/pwsensei_official",
        banner_image_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200",
        banner_link: "/study.html",
        banner_interval: "4000",
        banner_auto_slide: "1",
        footer_text: "The premier platform for accessible structured education. © 2026 PW SENSEI. All rights reserved.",
        contact_email: "support@pwsensei.live",
        telegram_link: "https://t.me/pwsensei_official",
        telegram_channel_name: "PW SENSEI Official",
        donate_upi_id: "pwsensei@upi",
        donate_qr_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&q=80&w=400",
        primary_color: "#7C3AED",
        admin_email: "contact@pwsensei.live",
        ent_section_title: "Official Entertainment",
        ent_section_desc: "Explore our official web portal and community channels for verified updates, study drives, and interactive sessions.",
        ent_web_title: "Official Website",
        ent_web_desc: "Access our official web platform for batch enrollments, syllabus roadmaps, interactive quizzes, and test series.",
        ent_web_img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600",
        ent_web_url: "https://pwsensei.live",
        ent_tg_title: "Official Telegram Channel",
        ent_tg_desc: "Movies, Web Series & Entertainment Updates",
        ent_tg_img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png",
        ent_tg_url: "https://t.me/pwsensei_official"
      };

      for (const [key, value] of Object.entries(defaultSettings)) {
        await client.query(
          'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          [key, value]
        );
      }
    }

    // 5. Seed Batches & Hierarchy if empty
    const batchRes = await client.query('SELECT COUNT(*) as count FROM batches');
    const batchCount = parseInt(batchRes.rows[0].count, 10);

    if (batchCount === 0) {
      await seedInitialData(client);
    }

    client.release();
    isInitialized = true;
    console.log('✅ CockroachDB Cloud database schema validated and initialized.');
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize CockroachDB Cloud database:', err.message);
    return false;
  } finally {
    initPromise = null;
  }
})();

  return initPromise;
}

async function seedInitialData(client) {
  console.log('🌱 Seeding initial batches and curriculum structure into CockroachDB Cloud...');

  const batchesData = [
    {
      title: "Vidyapeeth 28-YN201EA (NEET 2024)",
      thumbnail_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800",
      language: "Hinglish",
      target_audience: "For NEET 2024",
      start_date: "12 Apr 2024",
      end_date: "30 Jan 2025",
      is_free: 1,
      price: 0,
      is_new: 1,
      is_published: 1,
      subjects: [
        { name: "Physics", icon: "🔬", chapter_count: 13 },
        { name: "Botany", icon: "🌿", chapter_count: 6 },
        { name: "Zoology", icon: "🐟", chapter_count: 6 },
        { name: "Physical Chemistry", icon: "⚛️", chapter_count: 8 },
        { name: "Organic Chemistry", icon: "🧪", chapter_count: 8 },
        { name: "Inorganic Chemistry", icon: "🧲", chapter_count: 8 }
      ],
      announcements: [
        "Welcome to Vidyapeeth 28-YN201EA! Live lectures start daily at 4:00 PM.",
        "Daily Practice Problems (DPP) sheet #1 is uploaded for Physics."
      ]
    },
    {
      title: "Lakshya NEET Hindi 2027",
      thumbnail_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=800",
      language: "Hindi",
      target_audience: "For NEET 2027",
      start_date: "01 May 2024",
      end_date: "15 Mar 2027",
      is_free: 1,
      price: 0,
      is_new: 1,
      is_published: 1,
      subjects: [
        { name: "Physics", icon: "🔬", chapter_count: 13 },
        { name: "Botany", icon: "🌿", chapter_count: 6 },
        { name: "Zoology", icon: "🐟", chapter_count: 6 },
        { name: "Physical Chemistry", icon: "⚛️", chapter_count: 8 }
      ],
      announcements: [
        "Today's class for Alternating Current (प्रत्यावर्ती धारा 01) starts at 4:00 PM with Vishnu Nagar Sir.",
        "Chemical Equilibrium class scheduled at 6:30 PM with Amit Mahajan Sir."
      ]
    },
    {
      title: "Lakshya JEE 2025 Regular",
      thumbnail_url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=800",
      language: "Hinglish",
      target_audience: "For JEE 2025",
      start_date: "05 May 2024",
      end_date: "15 Feb 2025",
      is_free: 1,
      price: 0,
      is_new: 1,
      is_published: 1,
      subjects: [
        { name: "Physics", icon: "🔬", chapter_count: 13 },
        { name: "Mathematics", icon: "📐", chapter_count: 6 },
        { name: "Chemistry", icon: "🧪", chapter_count: 8 }
      ],
      announcements: [
        "JEE Mock Test Series #1 schedule has been published."
      ]
    }
  ];

  for (const b of batchesData) {
    const bRes = await client.query(`
      INSERT INTO batches (title, thumbnail_url, language, target_audience, start_date, end_date, is_free, price, is_new, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [b.title, b.thumbnail_url, b.language, b.target_audience, b.start_date, b.end_date, b.is_free, b.price, b.is_new, b.is_published]);

    const batchId = bRes.rows[0].id;

    // Announcements
    if (b.announcements) {
      for (const msg of b.announcements) {
        await client.query('INSERT INTO announcements (batch_id, message) VALUES ($1, $2)', [batchId, msg]);
      }
    }

    // Subjects
    for (let sIdx = 0; sIdx < b.subjects.length; sIdx++) {
      const sub = b.subjects[sIdx];
      const subRes = await client.query(`
        INSERT INTO subjects (batch_id, name, icon, chapter_count, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [batchId, sub.name, sub.icon, sub.chapter_count, sIdx + 1]);

      const subId = subRes.rows[0].id;

      // Seed chapters & content
      await seedSubjectChapters(client, subId, sub.name);
    }
  }

  // Seed Banners
  const bannersData = [
    {
      title: "NEET 2026 Ultimate Rankers Batch",
      subtitle: "Daily Live Interactive Classes, Comprehensive DPPs & Personal Gurus",
      image_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200",
      redirect_url: "/study.html",
      badge_text: "ADMISSIONS OPEN",
      badge_color: "#22C55E",
      display_order: 1,
      is_active: 1
    },
    {
      title: "Official PW SENSEI Telegram Channel",
      subtitle: "Join 100,000+ Students for Free Lecture PDFs, DPP Solutions & Live Doubts",
      image_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200",
      redirect_url: "https://t.me/pwsensei_official",
      badge_text: "COMMUNITY",
      badge_color: "#0284C7",
      display_order: 2,
      is_active: 1
    },
    {
      title: "100% Free Complete Video Series & DPPs",
      subtitle: "Kota's Finest Faculty Delivering Structured Physics, Chemistry & Biology",
      image_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200",
      redirect_url: "/study.html",
      badge_text: "100% FREE",
      badge_color: "#7C3AED",
      display_order: 3,
      is_active: 1
    }
  ];

  for (const b of bannersData) {
    await client.query(`
      INSERT INTO banners (title, subtitle, image_url, redirect_url, badge_text, badge_color, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [b.title, b.subtitle, b.image_url, b.redirect_url, b.badge_text, b.badge_color, b.display_order, b.is_active]);
  }

  // Seed Faculty
  const teachersData = [
    { name: "Vishnu Nagar Sir", subject: "Physics", exp: "12+ Years Kota Faculty", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150" },
    { name: "Amit Mahajan Sir", subject: "Physical Chemistry", exp: "15+ Years National Mentor", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150" },
    { name: "Dr. Vipin Sharma", subject: "Botany", exp: "10+ Years NEET Specialist", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150" },
    { name: "Dr. Manish Dubey", subject: "Zoology", exp: "14+ Years Medical Coaching", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150" },
    { name: "Sachin Jhakar Sir", subject: "Mathematics", exp: "11+ Years JEE Advanced", photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150" }
  ];

  for (let tIdx = 0; tIdx < teachersData.length; tIdx++) {
    const t = teachersData[tIdx];
    await client.query(`
      INSERT INTO teachers (name, subject, subjects_taught, experience, photo_url, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, 1)
    `, [t.name, t.subject, t.subject, t.exp, t.photo, tIdx + 1]);
  }
}

async function seedSubjectChapters(client, subjectId, subjectName) {
  const sLower = subjectName.toLowerCase();
  let chaptersList = [
    { num: 1, title: "Units & Dimensions, Measurement & Error Analysis", desc: "Fundamental and derived SI units, dimensional analysis, vernier calipers, screw gauge, and percentage error propagation." },
    { num: 2, title: "Motion in a Straight Line (Kinematics 1D)", desc: "Position, displacement, uniform and non-uniform accelerated motion, calculus approach, and relative velocity in 1D." },
    { num: 3, title: "Motion in a Plane (Vectors & Projectile)", desc: "Vector algebra, dot/cross products, 2D projectile trajectories, maximum height, range, and circular kinematics." }
  ];
  let teacherName = 'Vishnu Nagar Sir';

  if (sLower.includes('chem')) {
    teacherName = 'Amit Mahajan Sir';
    chaptersList = [
      { num: 1, title: "Some Basic Concepts of Chemistry (Mole Concept)", desc: "Stoichiometry, empirical formulas, molarity, molality, mole fraction, and limiting reagent calculations." },
      { num: 2, title: "Structure of Atom & Quantum Numbers", desc: "Bohr model, de Broglie relation, Heisenberg uncertainty, quantum numbers, electronic configuration, and Hund's rule." },
      { num: 3, title: "Classification of Elements & Periodicity", desc: "Periodic trends in atomic radii, ionization enthalpy, electron gain enthalpy, and electronegativity scales." }
    ];
  } else if (sLower.includes('botan')) {
    teacherName = 'Dr. Vipin Sharma';
    chaptersList = [
      { num: 1, title: "The Living World & Biological Classification", desc: "Taxonomical hierarchy, Five-kingdom classification, Monera, Protista, and fungal reproduction." },
      { num: 2, title: "Plant Kingdom (Algae to Angiosperms)", desc: "Algal pigments, bryophytes, pteridophytes, gymnosperms, and alternation of generations." },
      { num: 3, title: "Morphology & Anatomy of Flowering Plants", desc: "Root, stem, leaf modifications, inflorescence, flower anatomy, simple/complex tissues, and secondary growth." }
    ];
  } else if (sLower.includes('zool')) {
    teacherName = 'Dr. Manish Dubey';
    chaptersList = [
      { num: 1, title: "Animal Kingdom (Non-Chordates to Chordates)", desc: "Levels of organisation, coelom types, characteristics of Porifera to Mammalia, and diagnostic features." },
      { num: 2, title: "Structural Organisation in Animals (Tissues)", desc: "Epithelial, connective, muscular, nervous tissues, and comparative morphology of cockroach/frog." },
      { num: 3, title: "Breathing & Exchange of Gases", desc: "Respiratory volumes/capacities, mechanism of pulmonary ventilation, oxygen dissociation curve, and disorders." }
    ];
  } else if (sLower.includes('math')) {
    teacherName = 'Sachin Jhakar Sir';
    chaptersList = [
      { num: 1, title: "Sets, Relations & Functions", desc: "Cartesian product, domain, range, injective/surjective mappings, composite and inverse functions." },
      { num: 2, title: "Trigonometric Ratios & Equations", desc: "Compound angles, multiple angles, transformation formulas, and general solutions of trigonometric equations." },
      { num: 3, title: "Complex Numbers & Quadratic Equations", desc: "Argand plane, Euler form, cube roots of unity, roots nature, and location of roots for quadratic equations." }
    ];
  }

  for (let cIdx = 0; cIdx < chaptersList.length; cIdx++) {
    const ch = chaptersList[cIdx];
    const chRes = await client.query(`
      INSERT INTO chapters (subject_id, title, chapter_number, description, display_order, is_published)
      VALUES ($1, $2, $3, $4, $5, 1)
      RETURNING id
    `, [subjectId, ch.title, ch.num, ch.desc, cIdx + 1]);

    const chapId = chRes.rows[0].id;

    // 1. Lecture Video
    const vidRes = await client.query(`
      INSERT INTO videos (subject_id, chapter_id, title, external_link, thumbnail_url, duration, teacher_name, type, lecture_date, is_today, is_live, display_order, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'lecture', $8, $9, $10, 1, 1)
      RETURNING id
    `, [
      subjectId,
      chapId,
      `Lecture 01 : Fundamental Core Concepts & Theory - ${ch.title}`,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600",
      "54 mins",
      teacherName,
      getTodayIST(),
      cIdx === 0 ? 1 : 0,
      cIdx === 0 ? 1 : 0
    ]);

    const videoId = vidRes.rows[0].id;

    // 2. Class Notes PDF
    await client.query(`
      INSERT INTO pdfs (subject_id, chapter_id, lecture_id, title, external_link, type, file_size, display_order, is_published)
      VALUES ($1, $2, $3, $4, $5, 'note', '4.2 MB', 1, 1)
    `, [
      subjectId,
      chapId,
      videoId,
      `Complete Master Class Notes - ${ch.title}`,
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    ]);

    // 3. DPP PDF
    await client.query(`
      INSERT INTO pdfs (subject_id, chapter_id, lecture_id, title, external_link, type, file_size, display_order, is_published)
      VALUES ($1, $2, $3, $4, $5, 'dpp_pdf', '1.4 MB', 1, 1)
    `, [
      subjectId,
      chapId,
      videoId,
      `DPP 01 Problem Sheet - ${ch.title}`,
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    ]);

    // 4. DPP Video Solution
    await client.query(`
      INSERT INTO videos (subject_id, chapter_id, lecture_id, title, external_link, thumbnail_url, duration, teacher_name, type, display_order, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'dpp_video', 1, 1)
    `, [
      subjectId,
      chapId,
      videoId,
      `DPP 01 Complete Video Solution - ${ch.title}`,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=600",
      "36 mins",
      teacherName
    ]);

    // 5. Practice Quiz
    const sampleQuestions = JSON.stringify([
      {
        q: `Which fundamental principle governs the conceptual framework of ${ch.title.split('(')[0].trim()}?`,
        options: ["Conservation of Energy", "Conservation of Linear Momentum", "First Law of Thermodynamics", "Hooke's Law"],
        answer: 0,
        explanation: "The conservation of total energy remains universally valid across all physical processes."
      }
    ]);

    await client.query(`
      INSERT INTO quizzes (subject_id, chapter_id, lecture_id, title, external_link, total_questions, duration_mins, questions_json, display_order, is_published)
      VALUES ($1, $2, $3, $4, $5, 10, 15, $6, 1, 1)
    `, [
      subjectId,
      chapId,
      videoId,
      `DPP 01 Practice Quiz (${ch.title})`,
      "https://quiz.example.com",
      sampleQuestions
    ]);
  }
}

// Database helper functions compatible with async/await and CockroachDB Cloud / PostgreSQL
export const db = {
  async query(sql, params = []) {
    const currentPool = getPool();
    if (!currentPool) {
      throw new Error('CockroachDB Cloud database not configured. Please set DATABASE_URL.');
    }
    const formattedSql = convertPlaceholders(sql);
    return await currentPool.query(formattedSql, params);
  },

  async all(sql, params = []) {
    const res = await this.query(sql, params);
    return res.rows || [];
  },

  async get(sql, params = []) {
    const res = await this.query(sql, params);
    return (res.rows && res.rows.length > 0) ? res.rows[0] : null;
  },

  async run(sql, params = []) {
    let queryText = sql.trim();
    const isInsert = /^INSERT\s+INTO/i.test(queryText);
    const isSiteSettings = /INSERT\s+INTO\s+site_settings\b/i.test(queryText);

    // If INSERT on tables with an id column and does not already have RETURNING, automatically add RETURNING id
    if (isInsert && !isSiteSettings && !/RETURNING/i.test(queryText)) {
      queryText += ' RETURNING id';
    }

    try {
      const res = await this.query(queryText, params);
      const lastInsertRowid = res.rows && res.rows[0] ? (res.rows[0].id ?? null) : null;

      return {
        lastInsertRowid,
        changes: res.rowCount || 0
      };
    } catch (err) {
      // If error was caused by RETURNING id on a table without an id column, retry with original query
      if (err.message && err.message.includes('column "id" does not exist') && queryText.endsWith(' RETURNING id')) {
        const rawQuery = queryText.replace(/\s+RETURNING\s+id$/i, '');
        const res = await this.query(rawQuery, params);
        return {
          lastInsertRowid: null,
          changes: res.rowCount || 0
        };
      }
      throw err;
    }
  },

  async exec(sql) {
    const currentPool = getPool();
    if (!currentPool) {
      throw new Error('CockroachDB Cloud database not configured. Please set DATABASE_URL.');
    }
    return await currentPool.query(sql);
  },

  isHealthy() {
    return isInitialized && !!pool;
  }
};
