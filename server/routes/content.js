import express from 'express';
import { db, getTodayIST } from '../db.js';

const router = express.Router();

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
  telegram_link: "https://t.me/pwsensei_official",
  telegram_channel_name: "PW SENSEI Official",
  telegram_bot: "https://t.me/pwsensei_official",
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

// GET /api/settings - returns all site_settings as JSON key-value object
router.get('/settings', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM site_settings');
    const settings = { ...defaultSettings };
    if (Array.isArray(rows)) {
      for (const r of rows) {
        settings[r.key] = r.value;
      }
    }
    res.json({ settings, is_configured: db.isHealthy() });
  } catch (err) {
    console.warn('Using default settings fallback:', err.message);
    res.json({ settings: defaultSettings, is_configured: false });
  }
});

// GET /api/banners - returns all active promotional banners for auto-rotating carousel
router.get('/banners', async (req, res) => {
  try {
    const banners = await db.all(
      'SELECT * FROM banners WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
    );
    const intervalSetting = await db.get('SELECT value FROM site_settings WHERE key = ?', ['banner_interval']);
    const autoSlideSetting = await db.get('SELECT value FROM site_settings WHERE key = ?', ['banner_auto_slide']);

    const interval = intervalSetting ? parseInt(intervalSetting.value, 10) || 4000 : 4000;
    const auto_slide = autoSlideSetting ? parseInt(autoSlideSetting.value, 10) !== 0 : true;

    res.json({
      banners: Array.isArray(banners) ? banners : [],
      interval,
      auto_slide
    });
  } catch (err) {
    console.warn('Fallback empty banners list:', err.message);
    res.json({ banners: [], interval: 4000, auto_slide: true });
  }
});

// GET /api/teachers - returns active teachers (optionally filtered by batch_id)
router.get('/teachers', async (req, res) => {
  const batchId = req.query.batch_id ? parseInt(req.query.batch_id, 10) : null;
  try {
    let teachers = [];
    if (batchId) {
      teachers = await db.all(
        'SELECT * FROM teachers WHERE (batch_id = ? OR batch_id IS NULL) AND is_active = 1 ORDER BY display_order ASC, id ASC',
        [batchId]
      );
    } else {
      teachers = await db.all('SELECT * FROM teachers WHERE is_active = 1 ORDER BY display_order ASC, id ASC');
    }
    res.json({ teachers: Array.isArray(teachers) ? teachers : [] });
  } catch (err) {
    console.warn('Fallback empty teachers list:', err.message);
    res.json({ teachers: [] });
  }
});

// GET /api/nav-links - returns all active navigation links
router.get('/nav-links', async (req, res) => {
  try {
    const navLinks = await db.all('SELECT * FROM nav_links WHERE is_active = 1 ORDER BY display_order ASC, id ASC');
    const safeLinks = Array.isArray(navLinks) ? navLinks : [];
    res.json({ navLinks: safeLinks, links: safeLinks });
  } catch (err) {
    console.warn('Fallback empty nav links list:', err.message);
    res.json({ navLinks: [], links: [] });
  }
});

export default router;
