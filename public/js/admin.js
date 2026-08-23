/**
 * PW SENSEI - Admin Panel Logic (admin.js)
 */

let currentAdmin = null;
let allBatches = [];
let allSubjects = [];
let allBanners = [];

// Toast for Admin
function adminToast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span>${type === 'success' ? '✅' : '⚠️'}</span>
      <span>${msg}</span>
    </div>
    <button class="toast-close-btn">&times;</button>
  `;

  toast.querySelector('.toast-close-btn').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Modal Open / Close Helpers
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('active');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
}

function openNewBatchModal() {
  openCreateBatchModal();
}

// Global Admin Fetch Interceptor to ensure Token and Session authentication
// work seamlessly inside Google AI Studio iframes as well as standalone tabs
(function setupAdminFetchInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = async function (resource, init = {}) {
    let url = '';
    if (typeof resource === 'string') {
      url = resource;
    } else if (resource && typeof resource.url === 'string') {
      url = resource.url;
    }

    const token = localStorage.getItem('pw_admin_token');
    if (url.includes('/api/admin') || url.startsWith('/api/')) {
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (token && !headers.has('x-admin-token')) {
        headers.set('x-admin-token', token);
      }
      init.headers = headers;
      if (!init.credentials) {
        init.credentials = 'include';
      }
    }

    const res = await originalFetch.call(this, resource, init);
    if (res.status === 401 && url.includes('/api/admin') && !url.includes('/api/admin/login') && !url.includes('/api/admin/logout') && !url.includes('/api/admin/me')) {
      console.warn('[ADMIN] 401 Unauthorized received on', url, 'redirecting to login...');
      localStorage.removeItem('pw_admin_token');
      window.location.href = '/SK08/login';
    }
    return res;
  };
})();

// Helper for Admin authenticated API calls
async function adminFetch(url, options = {}) {
  const token = localStorage.getItem('pw_admin_token');
  const defaultHeaders = {};
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
    defaultHeaders['x-admin-token'] = token;
  }
  const defaultOptions = {
    credentials: 'include',
    headers: defaultHeaders
  };
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  const res = await fetch(url, mergedOptions);
  if (res.status === 401 && !url.includes('/api/admin/logout') && !url.includes('/api/admin/me')) {
    console.warn('[ADMIN] Unauthorized access detected, redirecting to login...');
    localStorage.removeItem('pw_admin_token');
    window.location.href = '/SK08/login';
  }
  return res;
}

// Check Admin Auth
async function checkAdminAuth() {
  try {
    const token = localStorage.getItem('pw_admin_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }
    const res = await adminFetch('/api/admin/me', {
      headers,
      credentials: 'include'
    });
    if (!res.ok) {
      localStorage.removeItem('pw_admin_token');
      window.location.href = '/SK08/login';
      return;
    }
    const data = await res.json();
    currentAdmin = data.admin || {};
    const adminDisplayEl = document.getElementById('admin-email-display');
    if (adminDisplayEl) {
      adminDisplayEl.textContent = currentAdmin.username || currentAdmin.email || 'Administrator';
    }
    await loadDashboard();
  } catch (err) {
    console.error('checkAdminAuth error:', err);
    localStorage.removeItem('pw_admin_token');
    window.location.href = '/SK08/login';
  }
}

// Logout Admin
async function logoutAdmin() {
  try {
    const token = localStorage.getItem('pw_admin_token');
    localStorage.removeItem('pw_admin_token');
    await adminFetch('/api/admin/logout', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}`, 'x-admin-token': token } : {},
      credentials: 'include'
    });
    window.location.href = '/SK08/login';
  } catch (err) {
    console.error('Logout error:', err);
    localStorage.removeItem('pw_admin_token');
    window.location.href = '/SK08/login';
  }
}

// Sidebar Mobile Toggle
function toggleAdminSidebar(open) {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('admin-sidebar-overlay');
  if (sidebar) {
    if (open === true) {
      sidebar.classList.add('open');
    } else if (open === false) {
      sidebar.classList.remove('open');
    } else {
      sidebar.classList.toggle('open');
    }
  }
  if (overlay) {
    if (sidebar && sidebar.classList.contains('open')) {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }
}

// Navigation between Admin Sections
function switchSection(sectionId) {
  toggleAdminSidebar(false);
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(item => item.classList.remove('active'));

  const targetSection = document.getElementById(`sec-${sectionId}`);
  const targetNav = document.getElementById(`nav-${sectionId}`);

  if (targetSection) targetSection.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  // Load section-specific data
  if (sectionId === 'dashboard') loadDashboard();
  if (sectionId === 'batches') loadBatchesTable();
  if (sectionId === 'subjects') loadSubjectsManager();
  if (sectionId === 'content' || sectionId === 'videos' || sectionId === 'pdfs') loadContentManager();
  if (sectionId === 'teachers') loadTeachersTable();
  if (sectionId === 'navlinks') loadNavLinksTable();
  if (sectionId === 'banners') loadBannersManager();
  if (sectionId === 'announcements') loadAnnouncementsManager();
  if (sectionId === 'settings') loadSettingsForm();
  if (sectionId === 'database') checkDatabaseStatus();
}

// 1. DASHBOARD
async function loadDashboard() {
  try {
    const res = await adminFetch('/api/admin/dashboard');
    if (!res.ok) {
      console.warn('Dashboard API returned status:', res.status);
      return;
    }
    const data = await res.json();
    if (!data || !data.stats) {
      console.warn('Dashboard data missing stats:', data);
      return;
    }

    const statBatches = document.getElementById('stat-batches');
    const statSubjects = document.getElementById('stat-subjects');
    const statVideos = document.getElementById('stat-videos');
    const statPdfs = document.getElementById('stat-pdfs');
    const statBanners = document.getElementById('stat-banners');

    if (statBatches) statBatches.textContent = data.stats.totalBatches ?? 0;
    if (statSubjects) statSubjects.textContent = data.stats.totalSubjects ?? 0;
    if (statVideos) statVideos.textContent = data.stats.totalVideos ?? 0;
    if (statPdfs) statPdfs.textContent = data.stats.totalPdfs ?? 0;
    if (statBanners) statBanners.textContent = data.stats.totalBanners ?? 0;

    const tbody = document.getElementById('recent-batches-tbody');
    if (tbody) {
      if (!data.recentBatches || data.recentBatches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: #6B7280;">No batches created yet. Click "+ Add New Batch" to get started.</td></tr>';
        return;
      }

      tbody.innerHTML = data.recentBatches
        .map(
          b => `
        <tr>
          <td><strong>${b.title || ''}</strong></td>
          <td>${b.language || 'Hinglish'} (${b.target_audience || 'All'})</td>
          <td>${b.is_free ? '<span style="color: #16A34A; font-weight: 700;">FREE</span>' : `₹${b.price || 0}`}</td>
          <td>${b.is_published ? '<span class="badge-published">Live</span>' : '<span class="badge-draft">Draft</span>'}</td>
          <td>
            <button class="btn-primary-sm" onclick="switchSection('batches')" style="padding: 4px 10px; font-size: 12px;">Manage &rarr;</button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// 2. BATCHES MANAGER
async function loadBatchesTable() {
  try {
    const res = await adminFetch('/api/admin/batches');
    const data = await res.json();
    allBatches = data.batches || [];

    const tbody = document.getElementById('batches-tbody');
    if (allBatches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px;">No batches created yet.</td></tr>';
      return;
    }

    tbody.innerHTML = allBatches
      .map(
        b => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${b.thumbnail_url || 'https://via.placeholder.com/60'}" style="width: 48px; height: 36px; object-fit: cover; border-radius: 6px;" />
            <div>
              <strong>${b.title}</strong>
              <div style="font-size: 12px; color: #6B7280;">${b.target_audience || 'All Students'}</div>
            </div>
          </div>
        </td>
        <td>${b.language}</td>
        <td style="font-size: 13px;">${b.start_date || 'N/A'} - ${b.end_date || 'N/A'}</td>
        <td>${b.is_free ? '<span style="color:#15803D; font-weight:700;">FREE</span>' : `₹${b.price}`}</td>
        <td>${b.is_published ? '<span class="badge-published">Published</span>' : '<span class="badge-draft">Draft</span>'}</td>
        <td>
          <button class="btn-sm-edit" onclick="openEditBatchModal(${b.id})">Edit</button>
          <button class="btn-sm-edit" style="background:#F3E8FF; color:#7C3AED;" onclick="goToManageContent(${b.id})">Content</button>
          <button class="btn-sm-delete" onclick="deleteBatch(${b.id})">Delete</button>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load batches:', err);
  }
}

function openCreateBatchModal() {
  document.getElementById('batch-modal-title').textContent = 'Create New Batch';
  document.getElementById('batch-form').reset();
  document.getElementById('batch-id-input').value = '';
  document.getElementById('batch-thumb').value = '';
  const bannerInput = document.getElementById('batch-banner-url');
  if (bannerInput) bannerInput.value = '';
  document.getElementById('batch-is-free').checked = true;
  document.getElementById('batch-is-published').checked = true;
  document.getElementById('batch-is-new').checked = true;
  document.getElementById('batch-modal').classList.add('active');
}

function openEditBatchModal(batchId) {
  const batch = allBatches.find(b => b.id === batchId);
  if (!batch) return;

  document.getElementById('batch-modal-title').textContent = 'Edit Batch';
  document.getElementById('batch-id-input').value = batch.id;
  document.getElementById('batch-title').value = batch.title;
  document.getElementById('batch-thumb').value = batch.thumbnail_url || '';
  const bannerInput = document.getElementById('batch-banner-url');
  if (bannerInput) bannerInput.value = batch.banner_url || '';
  document.getElementById('batch-lang').value = batch.language || 'Hinglish';
  document.getElementById('batch-target').value = batch.target_audience || '';
  document.getElementById('batch-start').value = batch.start_date || '';
  document.getElementById('batch-end').value = batch.end_date || '';
  document.getElementById('batch-price').value = batch.price || 0;
  document.getElementById('batch-is-free').checked = !!batch.is_free;
  document.getElementById('batch-is-new').checked = !!batch.is_new;
  document.getElementById('batch-is-published').checked = !!batch.is_published;

  document.getElementById('batch-modal').classList.add('active');
}

async function saveBatch(e) {
  e.preventDefault();
  const id = document.getElementById('batch-id-input').value;
  const bannerInput = document.getElementById('batch-banner-url');
  const payload = {
    title: document.getElementById('batch-title').value.trim(),
    thumbnail_url: document.getElementById('batch-thumb').value.trim(),
    banner_url: bannerInput ? bannerInput.value.trim() : '',
    language: document.getElementById('batch-lang').value,
    target_audience: document.getElementById('batch-target').value.trim(),
    start_date: document.getElementById('batch-start').value.trim(),
    end_date: document.getElementById('batch-end').value.trim(),
    price: parseInt(document.getElementById('batch-price').value, 10) || 0,
    is_free: document.getElementById('batch-is-free').checked ? 1 : 0,
    is_new: document.getElementById('batch-is-new').checked ? 1 : 0,
    is_published: document.getElementById('batch-is-published').checked ? 1 : 0
  };

  const url = id ? `/api/admin/batches/${id}` : '/api/admin/batches';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      adminToast(id ? 'Batch updated successfully!' : 'Batch created successfully!');
      document.getElementById('batch-modal').classList.remove('active');
      loadBatchesTable();
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save batch', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteBatch(batchId) {
  if (!confirm('Are you sure you want to delete this batch and all its subjects, videos, and PDFs?')) return;

  try {
    const token = localStorage.getItem('pw_admin_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }

    const res = await adminFetch(`/api/admin/batches/${batchId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success !== false) {
      adminToast(data.message || 'Batch deleted successfully', 'success');
      await loadBatchesTable();
      if (typeof loadDashboard === 'function') {
        loadDashboard();
      }
    } else {
      adminToast(data.error || 'Failed to delete batch', 'error');
    }
  } catch (err) {
    console.error('Delete batch client error:', err);
    adminToast('Error deleting batch', 'error');
  }
}

function goToManageContent(batchId) {
  switchSection('subjects');
  setTimeout(() => {
    const select = document.getElementById('content-batch-select');
    if (select) {
      select.value = batchId;
      select.dispatchEvent(new Event('change'));
    }
  }, 100);
}

// 3. SUBJECTS & CONTENT MANAGER
async function loadSubjectsManager() {
  const select = document.getElementById('content-batch-select');
  if (allBatches.length === 0) {
    const res = await adminFetch('/api/admin/batches');
    const data = await res.json();
    allBatches = data.batches || [];
  }

  select.innerHTML = allBatches.map(b => `<option value="${b.id}">${b.title}</option>`).join('');

  if (allBatches.length > 0) {
    loadSubjectsForBatch(select.value || allBatches[0].id);
  }
}

async function loadSubjectsForBatch(batchId) {
  try {
    const res = await adminFetch(`/api/admin/batches/${batchId}/subjects`);
    const data = await res.json();
    allSubjects = data.subjects || [];

    const container = document.getElementById('subjects-list-container');
    if (allSubjects.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: #6B7280;">No subjects added to this batch yet. Click "Add Subject" above.</div>';
      return;
    }

    container.innerHTML = allSubjects
      .map(
        s => `
      <div style="padding: 18px 24px; border-bottom: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-size: 24px; width: 40px; text-align: center;">${s.icon || '📚'}</span>
          <div>
            <strong style="font-size: 16px;">${s.name}</strong>
            <div style="font-size: 13px; color: #6B7280;">${s.chapter_count || 0} Chapters &middot; Display Order: ${s.display_order}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-sm-edit" style="background: #EDE9FE; color: #7C3AED; font-weight: 700;" onclick="openChaptersManageModal(${s.id}, '${s.name.replace(/'/g, "\\'")}')">📂 Manage Chapters</button>
          <button class="btn-sm-edit" onclick="openEditSubjectModal(${s.id})">Edit</button>
          <button class="btn-sm-delete" onclick="deleteSubject(${s.id})">Delete</button>
        </div>
      </div>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load subjects:', err);
  }
}

// CHAPTERS MANAGEMENT
let currentSubjectForChapters = null;
let allSubjectChapters = [];

async function openChaptersManageModal(subjectId, subjectName) {
  currentSubjectForChapters = subjectId;
  document.getElementById('chapters-manage-title').textContent = `📂 ${subjectName} - Chapters`;
  document.getElementById('chapters-manage-subtitle').textContent = 'Manage syllabus chapter hierarchy and content';
  document.getElementById('chapters-manage-modal').classList.add('active');
  loadChaptersTable(subjectId);
}

function openAddChapterModal() {
  if (!currentSubjectForChapters) return;
  document.getElementById('chapter-form-title').textContent = 'Add Chapter';
  document.getElementById('chapter-form').reset();
  document.getElementById('chapter-id-input').value = '';
  document.getElementById('chapter-subject-id-input').value = currentSubjectForChapters;
  document.getElementById('chapter-number-input').value = (allSubjectChapters.length + 1);
  document.getElementById('chapter-order-input').value = (allSubjectChapters.length + 1);
  document.getElementById('chapter-form-modal').classList.add('active');
}

function openEditChapterModal(chapterId) {
  const chapter = allSubjectChapters.find(c => c.id === chapterId);
  if (!chapter) return;

  document.getElementById('chapter-form-title').textContent = 'Edit Chapter';
  document.getElementById('chapter-id-input').value = chapter.id;
  document.getElementById('chapter-subject-id-input').value = chapter.subject_id;
  document.getElementById('chapter-number-input').value = chapter.chapter_number || 1;
  document.getElementById('chapter-order-input').value = chapter.display_order || 0;
  document.getElementById('chapter-title-input').value = chapter.title;
  document.getElementById('chapter-desc-input').value = chapter.description || '';
  document.getElementById('chapter-form-modal').classList.add('active');
}

async function saveChapter(e) {
  e.preventDefault();
  const id = document.getElementById('chapter-id-input').value;
  const subjectId = document.getElementById('chapter-subject-id-input').value;

  const payload = {
    subject_id: parseInt(subjectId, 10),
    chapter_number: parseInt(document.getElementById('chapter-number-input').value, 10) || 1,
    title: document.getElementById('chapter-title-input').value.trim(),
    description: document.getElementById('chapter-desc-input').value.trim(),
    display_order: parseInt(document.getElementById('chapter-order-input').value, 10) || 0,
    is_published: 1
  };

  const url = id ? `/api/admin/chapters/${id}` : '/api/admin/chapters';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      adminToast(id ? 'Chapter updated successfully' : 'Chapter created successfully');
      document.getElementById('chapter-form-modal').classList.remove('active');
      loadChaptersTable(subjectId);
      const batchId = document.getElementById('content-batch-select').value;
      if (batchId) loadSubjectsForBatch(batchId);
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save chapter', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteChapter(chapterId) {
  if (!confirm('Are you sure you want to delete this chapter and all associated lectures/notes?')) return;

  try {
    const res = await adminFetch(`/api/admin/chapters/${chapterId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      adminToast(data.message || 'Chapter deleted successfully', 'success');
      if (currentSubjectForChapters) {
        await loadChaptersTable(currentSubjectForChapters);
      }
      const batchId = document.getElementById('content-batch-select')?.value;
      if (batchId) {
        await loadSubjectsForBatch(batchId);
      }
    } else {
      adminToast(data.error || 'Failed to delete chapter', 'error');
    }
  } catch (err) {
    adminToast('Error deleting chapter', 'error');
  }
}

async function loadChaptersTable(subjectId) {
  const tbody = document.getElementById('chapters-tbody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Loading chapters...</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/chapters?subject_id=${subjectId}`);
    const data = await res.json();
    allSubjectChapters = data.chapters || [];

    document.getElementById('chapters-count-label').textContent = `Chapters in Subject (${allSubjectChapters.length}):`;

    if (allSubjectChapters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: #6B7280;">No chapters added yet. Click "+ Add New Chapter" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = allSubjectChapters.map(ch => `
      <tr>
        <td><strong style="color: #7C3AED;">Ch ${ch.chapter_number || 1}</strong></td>
        <td>
          <div style="font-weight: 700; color: #111827;">${ch.title}</div>
          ${ch.description ? `<div style="font-size: 12px; color: #6B7280; margin-top: 2px;">${ch.description}</div>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 11px; padding: 2px 6px; background: #F3F4F6; border-radius: 4px;">📹 ${ch.lectures_count || 0} Lectures</span>
            <span style="font-size: 11px; padding: 2px 6px; background: #F3F4F6; border-radius: 4px;">📑 ${ch.notes_count || 0} Notes</span>
            <span style="font-size: 11px; padding: 2px 6px; background: #F3F4F6; border-radius: 4px;">📝 ${ch.dpp_quizzes_count || 0} Quizzes</span>
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn-primary-sm" style="padding: 4px 8px; font-size: 11px;" onclick="openChapterContentModal(${ch.id}, '${ch.title.replace(/'/g, "\\'")}', ${subjectId})">📖 Manage Content</button>
            <button class="btn-sm-edit" onclick="openEditChapterModal(${ch.id})">Edit</button>
            <button class="btn-sm-delete" onclick="deleteChapter(${ch.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load chapters:', err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #EF4444; padding: 20px;">Failed to load chapters.</td></tr>';
  }
}

// CHAPTER CONTENT & UNIFIED LECTURE MANAGEMENT
let currentContentChapter = null;
let currentChapterData = null;

async function openChapterContentModal(chapterId, chapterTitle, subjectId) {
  currentContentChapter = chapterId;
  document.getElementById('current-content-chapter-id').value = chapterId;
  document.getElementById('current-content-subject-id').value = subjectId;
  
  const titleEl = document.getElementById('chapter-content-modal-title');
  if (titleEl) titleEl.textContent = `📖 ${chapterTitle}`;
  
  openModal('chapter-content-modal');
  switchChapterContentTab('lectures');
  loadChapterContent(chapterId);
}

async function loadChapterContent(chapterId) {
  try {
    const res = await adminFetch(`/api/admin/chapters/${chapterId}/content`);
    const data = await res.json();
    currentChapterData = data;

    // Update Counts in Sub-Tabs
    const counts = data.counts || {};
    const cntLec = document.getElementById('cnt-tab-lectures');
    const cntNotes = document.getElementById('cnt-tab-notes');
    const cntDppPdf = document.getElementById('cnt-tab-dpp-pdfs');
    const cntDppVid = document.getElementById('cnt-tab-dpp-videos');
    const cntQuiz = document.getElementById('cnt-tab-quizzes');

    if (cntLec) cntLec.textContent = counts.lectures || 0;
    if (cntNotes) cntNotes.textContent = counts.notes || 0;
    if (cntDppPdf) cntDppPdf.textContent = counts.dpp_pdfs || 0;
    if (cntDppVid) cntDppVid.textContent = counts.dpp_videos || 0;
    if (cntQuiz) cntQuiz.textContent = counts.quizzes || 0;

    // Render Lectures Table
    const lecTbody = document.getElementById('chapter-lectures-tbody');
    const lectures = data.lectures || [];
    let todayISTStr = '';
    try {
      todayISTStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch(e) {
      todayISTStr = new Date().toISOString().split('T')[0];
    }

    if (lectures.length === 0) {
      lecTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#6B7280;">No lectures added. Click "+ Unified Add Lecture" above.</td></tr>';
    } else {
      lecTbody.innerHTML = lectures.map((v, i) => {
        let scheduleBadge = '';
        if (v.lecture_date === todayISTStr) {
          scheduleBadge = '<span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #EDE9FE; color: #6D28D9;">⚡ TODAY</span>';
        } else if (v.lecture_date > todayISTStr) {
          scheduleBadge = '<span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #E0F2FE; color: #0369A1;">⏳ UPCOMING</span>';
        } else if (v.lecture_date) {
          scheduleBadge = '<span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #F1F5F9; color: #64748B;">PAST</span>';
        }

        return `
        <tr>
          <td><strong>#${v.display_order || i + 1}</strong></td>
          <td>
            <strong>${v.title}</strong>
            <div><a href="${v.external_link}" target="_blank" style="color: #7C3AED; font-size: 11px; text-decoration: underline;">Watch Video ↗</a></div>
          </td>
          <td>
            <span style="font-size: 11px; font-weight: 700; color: #4B5563; background: #F3F4F6; padding: 2px 6px; border-radius: 4px; display: inline-block;">
              📅 ${v.lecture_date || 'No Date'}
            </span>
          </td>
          <td><span style="font-size: 12px; background: #EDE9FE; color: #7C3AED; font-weight: 600; padding: 2px 6px; border-radius: 4px;">${v.teacher_name || data.subject?.default_teacher_name || 'Kota Faculty'}</span></td>
          <td>${v.duration || '50 mins'}</td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              ${scheduleBadge}
              <button class="btn-sm-edit" style="font-size: 10px; font-weight: 700; padding: 3px 6px; border-radius: 6px; cursor: pointer; background: ${v.is_live ? '#FEE2E2; color: #DC2626; border: 1px solid #FCA5A5;' : '#F3F4F6; color: #64748B; border: 1px solid #E5E7EB;'};" onclick="toggleVideoLive(${v.id}, ${v.is_live ? 0 : 1})" title="Toggle Live Lecture status">
                ${v.is_live ? '🔴 LIVE' : '⚪ Live OFF'}
              </button>
            </div>
          </td>
          <td>
            <button class="btn-sm-edit" style="font-size: 11px; padding: 2px 6px; background: ${v.is_published ? '#DCFCE7; color: #16A34A' : '#F3F4F6; color: #6B7280'};" onclick="toggleVideoPublish(${v.id}, ${v.is_published ? 0 : 1})">
              ${v.is_published ? '✅ Live' : '⏸️ Hidden'}
            </button>
          </td>
          <td>
            <div style="display:flex; gap: 4px;">
              <button class="btn-sm-edit" onclick="openEditUnifiedLectureModal(${v.id})">Edit</button>
              <button class="btn-sm-delete" onclick="deleteVideoItem(${v.id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
      }).join('');
    }

    // Render Notes Table
    const notesTbody = document.getElementById('chapter-notes-tbody');
    const notes = data.notes || [];
    if (notes.length === 0) {
      notesTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#6B7280;">No notes added yet.</td></tr>';
    } else {
      notesTbody.innerHTML = notes.map((n, i) => `
        <tr>
          <td><strong>#${n.display_order || i + 1}</strong></td>
          <td>
            <strong>${n.title}</strong>
            <div><a href="${n.external_link}" target="_blank" style="color: #7C3AED; font-size: 11px; text-decoration: underline;">Open PDF ↗</a></div>
          </td>
          <td>${n.file_size || '2.4 MB'}</td>
          <td>
            <button class="btn-sm-edit" style="font-size: 11px; padding: 2px 6px; background: ${n.is_published ? '#DCFCE7; color: #16A34A' : '#F3F4F6; color: #6B7280'};" onclick="togglePdfPublish(${n.id}, ${n.is_published ? 0 : 1})">
              ${n.is_published ? '✅ Live' : '⏸️ Hidden'}
            </button>
          </td>
          <td>
            <div style="display:flex; gap: 4px;">
              <button class="btn-sm-edit" onclick="openEditPdfModalItem(${n.id})">Edit</button>
              <button class="btn-sm-delete" onclick="deletePdfItem(${n.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Render DPP PDFs Table
    const dppPdfTbody = document.getElementById('chapter-dpp-pdfs-tbody');
    const dppPdfs = data.dpp_pdfs || [];
    if (dppPdfs.length === 0) {
      dppPdfTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#6B7280;">No DPP PDFs added yet.</td></tr>';
    } else {
      dppPdfTbody.innerHTML = dppPdfs.map((d, i) => `
        <tr>
          <td><strong>#${d.display_order || i + 1}</strong></td>
          <td>
            <strong>${d.title}</strong>
            <div><a href="${d.external_link}" target="_blank" style="color: #7C3AED; font-size: 11px; text-decoration: underline;">Open Worksheet ↗</a></div>
          </td>
          <td>${d.file_size || '1.5 MB'}</td>
          <td>
            <button class="btn-sm-edit" style="font-size: 11px; padding: 2px 6px; background: ${d.is_published ? '#DCFCE7; color: #16A34A' : '#F3F4F6; color: #6B7280'};" onclick="togglePdfPublish(${d.id}, ${d.is_published ? 0 : 1})">
              ${d.is_published ? '✅ Live' : '⏸️ Hidden'}
            </button>
          </td>
          <td>
            <div style="display:flex; gap: 4px;">
              <button class="btn-sm-edit" onclick="openEditPdfModalItem(${d.id})">Edit</button>
              <button class="btn-sm-delete" onclick="deletePdfItem(${d.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Render DPP Videos Table
    const dppVidTbody = document.getElementById('chapter-dpp-videos-tbody');
    const dppVideos = data.dpp_videos || [];
    if (dppVideos.length === 0) {
      dppVidTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#6B7280;">No DPP video solutions added yet.</td></tr>';
    } else {
      dppVidTbody.innerHTML = dppVideos.map((v, i) => `
        <tr>
          <td><strong>#${v.display_order || i + 1}</strong></td>
          <td>
            <strong>${v.title}</strong>
            <div><a href="${v.external_link}" target="_blank" style="color: #7C3AED; font-size: 11px; text-decoration: underline;">Watch Solution ↗</a></div>
          </td>
          <td><span style="font-size: 12px; background: #EDE9FE; color: #7C3AED; font-weight: 600; padding: 2px 6px; border-radius: 4px;">${v.teacher_name || data.subject?.default_teacher_name || 'Kota Faculty'}</span></td>
          <td>${v.duration || '30 mins'}</td>
          <td>
            <button class="btn-sm-edit" style="font-size: 11px; padding: 2px 6px; background: ${v.is_published ? '#DCFCE7; color: #16A34A' : '#F3F4F6; color: #6B7280'};" onclick="toggleVideoPublish(${v.id}, ${v.is_published ? 0 : 1})">
              ${v.is_published ? '✅ Live' : '⏸️ Hidden'}
            </button>
          </td>
          <td>
            <div style="display:flex; gap: 4px;">
              <button class="btn-sm-edit" onclick="openEditVideoModalItem(${v.id})">Edit</button>
              <button class="btn-sm-delete" onclick="deleteVideoItem(${v.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Render Quizzes Table
    const quizTbody = document.getElementById('chapter-quizzes-tbody');
    const quizzes = data.quizzes || [];
    if (quizzes.length === 0) {
      quizTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#6B7280;">No quizzes added yet.</td></tr>';
    } else {
      quizTbody.innerHTML = quizzes.map((q, i) => `
        <tr>
          <td><strong>#${q.display_order || i + 1}</strong></td>
          <td><strong>${q.title}</strong></td>
          <td>${q.total_questions || 10} Qs</td>
          <td>${q.duration_mins || 15} mins</td>
          <td>
            <button class="btn-sm-edit" style="font-size: 11px; padding: 2px 6px; background: ${q.is_published ? '#DCFCE7; color: #16A34A' : '#F3F4F6; color: #6B7280'};" onclick="toggleQuizPublish(${q.id}, ${q.is_published ? 0 : 1})">
              ${q.is_published ? '✅ Live' : '⏸️ Hidden'}
            </button>
          </td>
          <td>
            <button class="btn-sm-delete" onclick="deleteQuizItem(${q.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    }

  } catch (err) {
    console.error('Failed to load chapter content:', err);
    adminToast('Failed to load chapter materials', 'error');
  }
}

function switchChapterContentTab(tabName) {
  const tabs = ['lectures', 'notes', 'dpp-pdfs', 'dpp-videos', 'quizzes'];
  tabs.forEach(t => {
    const pane = document.getElementById(`content-tab-view-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (pane) pane.style.display = t === tabName ? 'block' : 'none';
    if (btn) {
      if (t === tabName) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary-outline');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary-outline');
      }
    }
  });
}

// UNIFIED LECTURE MODAL & EXTRA RESOURCES
function addUnifiedExtraResourceRow(resData = {}) {
  const container = document.getElementById('unified-extra-resources-list');
  if (!container) return;

  const rowId = 'res-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const row = document.createElement('div');
  row.className = 'extra-resource-item';
  row.id = rowId;
  row.style = 'background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 8px;';

  const resType = resData.resource_type || resData.type || 'pdf';
  const resTitle = (resData.title || '').replace(/"/g, '&quot;');
  const resUrl = (resData.url || resData.external_link || '').replace(/"/g, '&quot;');
  const resDesc = (resData.description || resData.file_size || '').replace(/"/g, '&quot;');
  const resId = resData.id || '';

  row.innerHTML = `
    <input type="hidden" class="extra-res-id" value="${resId}" />
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Resource Entry</span>
      <button type="button" onclick="document.getElementById('${rowId}').remove()" style="background: transparent; border: none; color: #EF4444; font-size: 12px; cursor: pointer; font-weight: 700;">✖ Remove</button>
    </div>
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
      <input type="text" class="form-control extra-res-title" placeholder="Resource Title (e.g. Formula Sheet / PYQs)" value="${resTitle}" required />
      <select class="form-control extra-res-type">
        <option value="pdf" ${resType === 'pdf' ? 'selected' : ''}>📑 PDF Document</option>
        <option value="link" ${resType === 'link' ? 'selected' : ''}>🔗 Web / Article Link</option>
        <option value="video" ${resType === 'video' ? 'selected' : ''}>📹 Video Link</option>
        <option value="assignment" ${resType === 'assignment' ? 'selected' : ''}>📝 Assignment</option>
      </select>
    </div>
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
      <input type="url" class="form-control extra-res-url" placeholder="Resource URL (https://...)" value="${resUrl}" required />
      <input type="text" class="form-control extra-res-desc" placeholder="Size / Label (e.g. 1.2 MB)" value="${resDesc}" />
    </div>
  `;

  container.appendChild(row);
}

function populateBatchTeachersDatalist() {
  const datalist = document.getElementById('batch-teachers-datalist');
  if (!datalist) return;
  
  const teachers = currentChapterData?.batch_teachers || allTeachers || [];
  datalist.innerHTML = teachers.map(t => `<option value="${t.name}">`).join('');
}

function openUnifiedAddLectureModal() {
  if (!currentContentChapter) return;
  document.getElementById('unified-lecture-form').reset();
  document.getElementById('unified-chapter-id-input').value = currentContentChapter;
  document.getElementById('unified-lecture-id-input').value = '';
  
  const titleEl = document.getElementById('unified-lecture-modal-title');
  if (titleEl) titleEl.textContent = '⚡ Unified Add Lecture Form';
  const submitBtn = document.getElementById('unified-lecture-submit-btn');
  if (submitBtn) submitBtn.textContent = '⚡ Save All Lecture Content';

  const extraList = document.getElementById('unified-extra-resources-list');
  if (extraList) extraList.innerHTML = '';
  
  populateBatchTeachersDatalist();

  const defaultTeacher = currentChapterData?.subject?.default_teacher_name || '';
  if (defaultTeacher) {
    document.getElementById('unified-lec-teacher').placeholder = `Default: ${defaultTeacher}`;
  }
  
  // Default to today's date in IST
  try {
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    document.getElementById('unified-lec-date').value = todayIST;
  } catch (e) {
    document.getElementById('unified-lec-date').value = new Date().toISOString().split('T')[0];
  }

  const isLiveEl = document.getElementById('unified-lec-is-live');
  if (isLiveEl) isLiveEl.checked = false;
  const isPubEl = document.getElementById('unified-lec-is-published');
  if (isPubEl) isPubEl.checked = true;

  const existingLecturesCount = (currentChapterData?.lectures?.length || 0) + 1;
  const numInput = document.getElementById('unified-lec-number');
  if (numInput) numInput.value = existingLecturesCount;
  document.getElementById('unified-lec-order').value = existingLecturesCount;
  
  openModal('unified-lecture-modal');
}

async function openEditUnifiedLectureModal(lectureId) {
  try {
    const res = await adminFetch(`/api/admin/lectures/${lectureId}`);
    if (!res.ok) {
      adminToast('Failed to load lecture details', 'error');
      return;
    }
    const data = await res.json();
    const lec = data.lecture || {};
    
    document.getElementById('unified-lecture-form').reset();
    document.getElementById('unified-chapter-id-input').value = lec.chapter_id || currentContentChapter || '';
    document.getElementById('unified-lecture-id-input').value = lec.id;

    const titleEl = document.getElementById('unified-lecture-modal-title');
    if (titleEl) titleEl.textContent = '⚡ Edit Lecture & All Resources';
    const submitBtn = document.getElementById('unified-lecture-submit-btn');
    if (submitBtn) submitBtn.textContent = '⚡ Update Lecture & Resources';

    // 1. Lecture Details
    document.getElementById('unified-lec-title').value = lec.title || '';
    document.getElementById('unified-lec-video-url').value = lec.external_link || '';
    document.getElementById('unified-lec-teacher').value = lec.teacher_name || '';
    document.getElementById('unified-lec-date').value = lec.lecture_date || '';
    document.getElementById('unified-lec-duration').value = lec.duration || '50 mins';
    
    const numEl = document.getElementById('unified-lec-number');
    if (numEl) {
      numEl.value = (lec.lecture_number !== undefined && lec.lecture_number !== null && String(lec.lecture_number).trim() !== '') ? lec.lecture_number : (lec.display_order || 1);
    }
    document.getElementById('unified-lec-order').value = lec.display_order || 1;
    document.getElementById('unified-lec-thumb').value = lec.thumbnail_url || '';

    const isLiveEl = document.getElementById('unified-lec-is-live');
    if (isLiveEl) isLiveEl.checked = Boolean(lec.is_live);
    const isPubEl = document.getElementById('unified-lec-is-published');
    if (isPubEl) isPubEl.checked = lec.is_published !== 0;

    // 2. Notes PDF
    if (data.notes) {
      document.getElementById('unified-notes-title').value = data.notes.title || '';
      document.getElementById('unified-notes-pdf-url').value = data.notes.external_link || '';
      document.getElementById('unified-notes-size').value = data.notes.file_size || '2.4 MB';
    } else {
      document.getElementById('unified-notes-title').value = '';
      document.getElementById('unified-notes-pdf-url').value = '';
      document.getElementById('unified-notes-size').value = '2.4 MB';
    }

    // 3. DPP PDF
    if (data.dpp_pdf) {
      document.getElementById('unified-dpp-pdf-title').value = data.dpp_pdf.title || '';
      document.getElementById('unified-dpp-pdf-url').value = data.dpp_pdf.external_link || '';
      document.getElementById('unified-dpp-pdf-size').value = data.dpp_pdf.file_size || '1.5 MB';
    } else {
      document.getElementById('unified-dpp-pdf-title').value = '';
      document.getElementById('unified-dpp-pdf-url').value = '';
      document.getElementById('unified-dpp-pdf-size').value = '1.5 MB';
    }

    // 4. DPP Video
    if (data.dpp_video) {
      document.getElementById('unified-dpp-vid-title').value = data.dpp_video.title || '';
      document.getElementById('unified-dpp-vid-url').value = data.dpp_video.external_link || '';
      document.getElementById('unified-dpp-vid-duration').value = data.dpp_video.duration || '30 mins';
    } else {
      document.getElementById('unified-dpp-vid-title').value = '';
      document.getElementById('unified-dpp-vid-url').value = '';
      document.getElementById('unified-dpp-vid-duration').value = '30 mins';
    }

    // 5. DPP Quiz
    if (data.quiz) {
      document.getElementById('unified-quiz-title').value = data.quiz.title || '';
      document.getElementById('unified-quiz-questions').value = data.quiz.total_questions || 10;
      document.getElementById('unified-quiz-duration').value = data.quiz.duration_mins || 15;
    } else {
      document.getElementById('unified-quiz-title').value = '';
      document.getElementById('unified-quiz-questions').value = 10;
      document.getElementById('unified-quiz-duration').value = 15;
    }

    // 6. Extra Resources
    const extraList = document.getElementById('unified-extra-resources-list');
    if (extraList) {
      extraList.innerHTML = '';
      if (Array.isArray(data.extra_resources) && data.extra_resources.length > 0) {
        data.extra_resources.forEach(r => addUnifiedExtraResourceRow(r));
      }
    }

    populateBatchTeachersDatalist();
    openModal('unified-lecture-modal');

  } catch (err) {
    console.error('Error opening edit unified lecture modal:', err);
    adminToast('Failed to load lecture', 'error');
  }
}

async function saveUnifiedLecture(e) {
  e.preventDefault();
  const chapterId = document.getElementById('unified-chapter-id-input').value;
  const lectureId = document.getElementById('unified-lecture-id-input').value;

  // Gather Extra Resources
  const extraResources = [];
  document.querySelectorAll('#unified-extra-resources-list .extra-resource-item').forEach((item, idx) => {
    const title = item.querySelector('.extra-res-title')?.value.trim();
    const url = item.querySelector('.extra-res-url')?.value.trim();
    const resource_type = item.querySelector('.extra-res-type')?.value || 'pdf';
    const description = item.querySelector('.extra-res-desc')?.value.trim() || '';
    const idVal = item.querySelector('.extra-res-id')?.value;
    const id = idVal ? parseInt(idVal, 10) : undefined;
    if (title && url) {
      extraResources.push({ id, title, url, resource_type, description, display_order: idx + 1 });
    }
  });

  const isLiveChecked = document.getElementById('unified-lec-is-live')?.checked ? 1 : 0;
  const isPubChecked = document.getElementById('unified-lec-is-published')?.checked !== false ? 1 : 0;
  const lectureDateVal = document.getElementById('unified-lec-date')?.value.trim() || '';

  const lecNumbVal = document.getElementById('unified-lec-number')?.value;
  const lecOrderVal = parseInt(document.getElementById('unified-lec-order').value, 10) || 1;
  const parsedLecNum = (lecNumbVal !== undefined && lecNumbVal !== null && String(lecNumbVal).trim() !== '') ? parseInt(lecNumbVal, 10) : lecOrderVal;

  const payload = {
    id: lectureId ? parseInt(lectureId, 10) : undefined,
    lecture_id: lectureId ? parseInt(lectureId, 10) : undefined,
    lecture_title: document.getElementById('unified-lec-title').value.trim(),
    lecture_video_url: document.getElementById('unified-lec-video-url').value.trim(),
    lecture_duration: document.getElementById('unified-lec-duration').value.trim() || '50 mins',
    teacher_name: document.getElementById('unified-lec-teacher').value.trim(),
    lecture_date: lectureDateVal,
    is_live: isLiveChecked,
    thumbnail_url: document.getElementById('unified-lec-thumb').value.trim(),
    lecture_order: lecOrderVal,
    lecture_number: parsedLecNum,
    is_published: isPubChecked,
    // Notes
    notes_title: document.getElementById('unified-notes-title').value.trim(),
    notes_pdf_url: document.getElementById('unified-notes-pdf-url').value.trim(),
    notes_file_size: document.getElementById('unified-notes-size').value.trim() || '2.4 MB',
    // DPP PDF
    dpp_pdf_title: document.getElementById('unified-dpp-pdf-title').value.trim(),
    dpp_pdf_url: document.getElementById('unified-dpp-pdf-url').value.trim(),
    dpp_pdf_file_size: document.getElementById('unified-dpp-pdf-size').value.trim() || '1.5 MB',
    // DPP Video
    dpp_video_title: document.getElementById('unified-dpp-vid-title').value.trim(),
    dpp_video_url: document.getElementById('unified-dpp-vid-url').value.trim(),
    dpp_video_duration: document.getElementById('unified-dpp-vid-duration').value.trim() || '30 mins',
    // DPP Quiz
    dpp_quiz_title: document.getElementById('unified-quiz-title').value.trim(),
    dpp_quiz_total_questions: parseInt(document.getElementById('unified-quiz-questions').value, 10) || 10,
    dpp_quiz_duration: parseInt(document.getElementById('unified-quiz-duration').value, 10) || 15,
    // Extra Resources
    extra_resources: extraResources
  };

  try {
    const url = lectureId ? `/api/admin/lectures/${lectureId}/unified` : `/api/admin/chapters/${chapterId}/unified-lecture`;
    const method = lectureId ? 'PUT' : 'POST';

    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      adminToast(lectureId ? '⚡ Lecture & resources updated successfully!' : '⚡ Lecture & resources added successfully!');
      closeModal('unified-lecture-modal');
      if (chapterId) {
        loadChapterContent(chapterId);
        loadContentManagerLectures(chapterId);
      }
      if (currentSubjectForChapters) loadChaptersTable(currentSubjectForChapters);
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save unified lecture', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// Single Action Modal Helpers inside Chapter
function openAddSingleVideoModal() {
  const subId = document.getElementById('current-content-subject-id').value;
  if (!subId) return;
  document.getElementById('video-form').reset();
  document.getElementById('video-subject-id-input').value = subId;
  openModal('video-modal');
}

function openAddSinglePdfModal() {
  const subId = document.getElementById('current-content-subject-id').value;
  if (!subId) return;
  document.getElementById('pdf-form').reset();
  document.getElementById('pdf-subject-id-input').value = subId;
  openModal('pdf-modal');
}

function openAddSingleQuizModal() {
  adminToast('Use Unified Add Lecture to attach interactive quizzes to lectures');
}

// Single Item Edit & Delete handlers
function openEditVideoModalItem(videoId) {
  const video = currentChapterData?.lectures?.find(v => v.id === videoId) || currentChapterData?.dpp_videos?.find(v => v.id === videoId);
  if (!video) return;

  document.getElementById('edit-video-id-input').value = video.id;
  document.getElementById('edit-video-subject-id-input').value = video.subject_id;
  document.getElementById('edit-video-chapter-id-input').value = video.chapter_id || '';
  document.getElementById('edit-video-title').value = video.title || '';
  document.getElementById('edit-video-url').value = video.external_link || '';
  document.getElementById('edit-video-type').value = video.type || 'lecture';
  document.getElementById('edit-video-duration').value = video.duration || '50 mins';
  document.getElementById('edit-video-teacher').value = video.teacher_name || '';
  document.getElementById('edit-video-order').value = video.display_order || 1;
  document.getElementById('edit-video-thumb').value = video.thumbnail_url || '';

  openModal('edit-video-modal');
}

async function updateVideo(e) {
  e.preventDefault();
  const id = document.getElementById('edit-video-id-input').value;
  const payload = {
    title: document.getElementById('edit-video-title').value.trim(),
    external_link: document.getElementById('edit-video-url').value.trim(),
    type: document.getElementById('edit-video-type').value,
    duration: document.getElementById('edit-video-duration').value.trim() || '50 mins',
    teacher_name: document.getElementById('edit-video-teacher').value.trim(),
    display_order: parseInt(document.getElementById('edit-video-order').value, 10) || 1,
    thumbnail_url: document.getElementById('edit-video-thumb').value.trim()
  };

  try {
    const res = await adminFetch(`/api/admin/videos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      adminToast('Video updated successfully!');
      closeModal('edit-video-modal');
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to update video', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteVideoItem(videoId) {
  if (!confirm('Are you sure you want to delete this video lecture?')) return;
  try {
    const res = await adminFetch(`/api/admin/videos/${videoId}`, { method: 'DELETE' });
    if (res.ok) {
      adminToast('Video deleted');
      if (currentContentChapter) loadChapterContent(currentContentChapter);
      if (currentSubjectForChapters) loadChaptersTable(currentSubjectForChapters);
    } else {
      adminToast('Failed to delete video', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

function openEditPdfModalItem(pdfId) {
  const pdf = currentChapterData?.notes?.find(p => p.id === pdfId) || currentChapterData?.dpp_pdfs?.find(p => p.id === pdfId);
  if (!pdf) return;

  document.getElementById('edit-pdf-id-input').value = pdf.id;
  document.getElementById('edit-pdf-subject-id-input').value = pdf.subject_id;
  document.getElementById('edit-pdf-chapter-id-input').value = pdf.chapter_id || '';
  document.getElementById('edit-pdf-title').value = pdf.title || '';
  document.getElementById('edit-pdf-url').value = pdf.external_link || '';
  document.getElementById('edit-pdf-type').value = pdf.type || 'note';
  document.getElementById('edit-pdf-size').value = pdf.file_size || '2.4 MB';
  document.getElementById('edit-pdf-order').value = pdf.display_order || 1;

  openModal('edit-pdf-modal');
}

async function updatePdf(e) {
  e.preventDefault();
  const id = document.getElementById('edit-pdf-id-input').value;
  const payload = {
    title: document.getElementById('edit-pdf-title').value.trim(),
    external_link: document.getElementById('edit-pdf-url').value.trim(),
    type: document.getElementById('edit-pdf-type').value,
    file_size: document.getElementById('edit-pdf-size').value.trim() || '2.4 MB',
    display_order: parseInt(document.getElementById('edit-pdf-order').value, 10) || 1
  };

  try {
    const res = await adminFetch(`/api/admin/pdfs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      adminToast('PDF updated successfully!');
      closeModal('edit-pdf-modal');
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to update PDF', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deletePdfItem(pdfId) {
  if (!confirm('Are you sure you want to delete this document?')) return;
  try {
    const res = await adminFetch(`/api/admin/pdfs/${pdfId}`, { method: 'DELETE' });
    if (res.ok) {
      adminToast('PDF deleted');
      if (currentContentChapter) loadChapterContent(currentContentChapter);
      if (currentSubjectForChapters) loadChaptersTable(currentSubjectForChapters);
    } else {
      adminToast('Failed to delete PDF', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteQuizItem(quizId) {
  if (!confirm('Are you sure you want to delete this quiz?')) return;
  try {
    const res = await adminFetch(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' });
    if (res.ok) {
      adminToast('Quiz deleted');
      if (currentContentChapter) loadChapterContent(currentContentChapter);
      if (currentSubjectForChapters) loadChaptersTable(currentSubjectForChapters);
    } else {
      adminToast('Failed to delete quiz', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// Publish Toggles for Videos / PDFs / Quizzes
async function toggleVideoToday(videoId, isToday) {
  try {
    const res = await adminFetch(`/api/admin/videos/${videoId}/today`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_today: isToday })
    });
    if (res.ok) {
      adminToast(`Lecture ${isToday ? "added to Today's Lectures" : "removed from Today's Lectures"}`);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    } else {
      adminToast("Failed to update Today's status", 'error');
    }
  } catch (err) {
    adminToast("Error updating Today's status", 'error');
  }
}

async function toggleVideoLive(videoId, isLive) {
  try {
    const res = await adminFetch(`/api/admin/videos/${videoId}/live`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_live: isLive })
    });
    if (res.ok) {
      adminToast(`Lecture marked as ${isLive ? '🔴 LIVE' : '⚪ Recorded / Regular'}`);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    } else {
      adminToast('Failed to update Live status', 'error');
    }
  } catch (err) {
    adminToast('Error updating Live status', 'error');
  }
}

async function toggleVideoPublish(videoId, isPublished) {
  try {
    const res = await adminFetch(`/api/admin/videos/${videoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished })
    });
    if (res.ok) {
      adminToast(`Video lecture ${isPublished ? 'published (Live)' : 'hidden'}`);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    }
  } catch (err) {
    adminToast('Error updating video status', 'error');
  }
}

async function togglePdfPublish(pdfId, isPublished) {
  try {
    const res = await adminFetch(`/api/admin/pdfs/${pdfId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished })
    });
    if (res.ok) {
      adminToast(`Document ${isPublished ? 'published (Live)' : 'hidden'}`);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    }
  } catch (err) {
    adminToast('Error updating document status', 'error');
  }
}

async function toggleQuizPublish(quizId, isPublished) {
  try {
    const res = await adminFetch(`/api/admin/quizzes/${quizId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished })
    });
    if (res.ok) {
      adminToast(`Quiz ${isPublished ? 'published (Live)' : 'hidden'}`);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    }
  } catch (err) {
    adminToast('Error updating quiz status', 'error');
  }
}

function openAddSubjectModal() {
  document.getElementById('subject-modal-title').textContent = 'Add Subject';
  document.getElementById('subject-form').reset();
  document.getElementById('subject-id-input').value = '';
  document.getElementById('subject-batch-id').value = document.getElementById('content-batch-select').value;
  const defTeacher = document.getElementById('subject-default-teacher');
  if (defTeacher) defTeacher.value = '';
  const defThumb = document.getElementById('subject-default-thumb');
  if (defThumb) defThumb.value = '';
  document.getElementById('subject-modal').classList.add('active');
}

function openEditSubjectModal(subId) {
  const sub = allSubjects.find(s => s.id === subId);
  if (!sub) return;

  document.getElementById('subject-modal-title').textContent = 'Edit Subject';
  document.getElementById('subject-id-input').value = sub.id;
  document.getElementById('subject-batch-id').value = sub.batch_id;
  document.getElementById('subject-name').value = sub.name;
  const defTeacher = document.getElementById('subject-default-teacher');
  if (defTeacher) defTeacher.value = sub.default_teacher_name || '';
  const defThumb = document.getElementById('subject-default-thumb');
  if (defThumb) defThumb.value = sub.default_thumbnail_url || '';
  document.getElementById('subject-icon').value = sub.icon || '📚';
  document.getElementById('subject-chapters').value = sub.chapter_count || 0;
  document.getElementById('subject-order').value = sub.display_order || 0;
  document.getElementById('subject-modal').classList.add('active');
}

async function saveSubject(e) {
  e.preventDefault();
  const id = document.getElementById('subject-id-input').value;
  const batchId = document.getElementById('subject-batch-id').value;
  const defTeacher = document.getElementById('subject-default-teacher');
  const defThumb = document.getElementById('subject-default-thumb');

  const payload = {
    name: document.getElementById('subject-name').value.trim(),
    default_teacher_name: defTeacher ? defTeacher.value.trim() : '',
    default_thumbnail_url: defThumb ? defThumb.value.trim() : '',
    icon: document.getElementById('subject-icon').value.trim() || '📚',
    chapter_count: parseInt(document.getElementById('subject-chapters').value, 10) || 0,
    display_order: parseInt(document.getElementById('subject-order').value, 10) || 0
  };

  const url = id ? `/api/admin/subjects/${id}` : `/api/admin/batches/${batchId}/subjects`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      adminToast(id ? 'Subject updated' : 'Subject added');
      document.getElementById('subject-modal').classList.remove('active');
      loadSubjectsForBatch(batchId);
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save subject', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteSubject(subId) {
  if (!confirm('Are you sure you want to delete this subject and its content?')) return;
  try {
    const res = await adminFetch(`/api/admin/subjects/${subId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      adminToast(data.message || 'Subject deleted', 'success');
      const batchId = document.getElementById('content-batch-select')?.value;
      if (batchId) {
        await loadSubjectsForBatch(batchId);
      }
    } else {
      adminToast(data.error || 'Failed to delete subject', 'error');
    }
  } catch (err) {
    adminToast('Error deleting subject', 'error');
  }
}

// 4. CONTENT MANAGER (UNIFIED LECTURES, NOTES, DPPs, VIDEOS & UNLIMITED EXTRA RESOURCES)
let contentMgrBatches = [];
let contentMgrSubjects = [];
let contentMgrChapters = [];
let contentMgrLectures = [];

async function loadContentManager() {
  const batchSelect = document.getElementById('content-mgr-batch-select');
  if (!batchSelect) return;

  try {
    const res = await adminFetch('/api/admin/batches');
    const data = await res.json();
    contentMgrBatches = data.batches || [];

    if (contentMgrBatches.length === 0) {
      batchSelect.innerHTML = '<option value="">No batches available</option>';
      const subSelect = document.getElementById('content-mgr-subject-select');
      const chapSelect = document.getElementById('content-mgr-chapter-select');
      const tbody = document.getElementById('content-mgr-tbody');
      if (subSelect) subSelect.innerHTML = '<option value="">No subjects</option>';
      if (chapSelect) chapSelect.innerHTML = '<option value="">No chapters</option>';
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:28px; color:#6B7280;">No batches found. Please create a batch first.</td></tr>';
      return;
    }

    batchSelect.innerHTML = contentMgrBatches.map(b => `<option value="${b.id}">${b.title}</option>`).join('');

    batchSelect.onchange = () => {
      const selectedBatchId = batchSelect.value;
      if (selectedBatchId) loadSubjectsForContentManager(selectedBatchId);
    };

    loadSubjectsForContentManager(batchSelect.value || contentMgrBatches[0].id);
  } catch (err) {
    console.error('Failed to load content manager batches:', err);
    adminToast('Failed to load batches', 'error');
  }
}

async function loadSubjectsForContentManager(batchId) {
  const subSelect = document.getElementById('content-mgr-subject-select');
  if (!subSelect) return;

  try {
    const res = await adminFetch(`/api/admin/batches/${batchId}/subjects`);
    const data = await res.json();
    contentMgrSubjects = data.subjects || [];

    if (contentMgrSubjects.length === 0) {
      subSelect.innerHTML = '<option value="">No subjects in this batch</option>';
      const chapSelect = document.getElementById('content-mgr-chapter-select');
      const tbody = document.getElementById('content-mgr-tbody');
      if (chapSelect) chapSelect.innerHTML = '<option value="">No chapters</option>';
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:28px; color:#6B7280;">No subjects found in this batch. Please add a subject in Subjects & Syllabus.</td></tr>';
      return;
    }

    subSelect.innerHTML = contentMgrSubjects.map(s => `<option value="${s.id}">${s.icon || '📚'} ${s.name}</option>`).join('');

    subSelect.onchange = () => {
      const selectedSubId = subSelect.value;
      if (selectedSubId) loadChaptersForContentManager(selectedSubId);
    };

    loadChaptersForContentManager(subSelect.value || contentMgrSubjects[0].id);
  } catch (err) {
    console.error('Failed to load subjects for content manager:', err);
  }
}

async function loadChaptersForContentManager(subjectId) {
  const chapSelect = document.getElementById('content-mgr-chapter-select');
  if (!chapSelect) return;

  try {
    const res = await adminFetch(`/api/admin/subjects/${subjectId}/chapters`);
    const data = await res.json();
    contentMgrChapters = data.chapters || [];

    if (contentMgrChapters.length === 0) {
      chapSelect.innerHTML = '<option value="">No chapters in this subject</option>';
      const tbody = document.getElementById('content-mgr-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:28px; color:#6B7280;">No chapters found in this subject. Click Subjects & Syllabus to create a chapter first.</td></tr>';
      const pathEl = document.getElementById('content-mgr-current-path');
      if (pathEl) pathEl.textContent = 'No chapters found. Please add a chapter first.';
      return;
    }

    chapSelect.innerHTML = contentMgrChapters.map(c => `<option value="${c.id}">${c.chapter_number ? 'Ch ' + c.chapter_number + ': ' : ''}${c.title}</option>`).join('');

    chapSelect.onchange = () => {
      const selectedChapId = chapSelect.value;
      if (selectedChapId) loadContentManagerLectures(selectedChapId);
    };

    loadContentManagerLectures(chapSelect.value || contentMgrChapters[0].id);
  } catch (err) {
    console.error('Failed to load chapters for content manager:', err);
  }
}

async function loadContentManagerLectures(chapterId) {
  const tbody = document.getElementById('content-mgr-tbody');
  const pathEl = document.getElementById('content-mgr-current-path');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:28px; color:#6B7280;">Loading chapter lectures & materials...</td></tr>';

    const res = await adminFetch(`/api/admin/chapters/${chapterId}/content`);
    const data = await res.json();
    currentChapterData = data;
    currentContentChapter = chapterId;
    currentContentSubject = data.chapter?.subject_id || '';

    const batchName = contentMgrBatches.find(b => String(b.id) === String(document.getElementById('content-mgr-batch-select')?.value))?.title || 'Batch';
    const subName = contentMgrSubjects.find(s => String(s.id) === String(document.getElementById('content-mgr-subject-select')?.value))?.name || 'Subject';
    const chapTitle = data.chapter?.title || 'Chapter';

    if (pathEl) {
      pathEl.innerHTML = `<strong>${batchName}</strong> &rsaquo; <strong>${subName}</strong> &rsaquo; <span>${chapTitle}</span>`;
    }

    const lectures = data.lectures || [];
    contentMgrLectures = lectures;

    if (lectures.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 36px 20px;">
            <div style="font-size: 28px; margin-bottom: 8px;">🎬</div>
            <div style="font-size: 15px; font-weight: 700; color: #1E293B; margin-bottom: 4px;">No Lectures or Content in this Chapter Yet</div>
            <div style="font-size: 13px; color: #64748B; margin-bottom: 16px;">Add unified lectures with video, class notes, DPPs, and extra resource links in one form.</div>
            <button class="btn-primary" onclick="openNewUnifiedContentFromManager()">⚡ + Add First Lecture (All-In-One)</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lectures.map((v, idx) => {
      const attachedNotes = data.notes?.find(n => n.lecture_id === v.id || (n.chapter_id === v.chapter_id && n.display_order === v.display_order));
      const attachedDppPdf = data.dpp_pdfs?.find(d => d.lecture_id === v.id || (d.chapter_id === v.chapter_id && d.display_order === v.display_order));
      const attachedDppVid = data.dpp_videos?.find(dv => dv.lecture_id === v.id || (dv.chapter_id === v.chapter_id && dv.display_order === v.display_order));
      const attachedQuiz = data.quizzes?.find(q => q.lecture_id === v.id || (q.chapter_id === v.chapter_id && q.display_order === v.display_order));
      const extraResList = Array.isArray(v.extra_resources) ? v.extra_resources : [];

      const notesPill = attachedNotes
        ? `<a href="${attachedNotes.external_link}" target="_blank" class="badge-notes-pill" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:#EDE9FE; color:#7C3AED; padding:2px 8px; border-radius:4px; font-weight:600; text-decoration:none;">📑 Notes PDF ↗</a>`
        : `<span style="font-size:11px; color:#94A3B8; background:#F1F5F9; padding:2px 6px; border-radius:4px;">No Notes</span>`;

      const dppPill = attachedDppPdf
        ? `<a href="${attachedDppPdf.external_link}" target="_blank" class="badge-dpp-pill" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:#DCFCE7; color:#15803D; padding:2px 8px; border-radius:4px; font-weight:600; text-decoration:none;">📝 DPP PDF ↗</a>`
        : `<span style="font-size:11px; color:#94A3B8; background:#F1F5F9; padding:2px 6px; border-radius:4px;">No DPP</span>`;

      const dppVidPill = attachedDppVid
        ? `<a href="${attachedDppVid.external_link}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:4px; font-weight:600; text-decoration:none;">🎥 DPP Video ↗</a>`
        : '';

      const quizPill = attachedQuiz
        ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:#FEE2E2; color:#B91C1C; padding:2px 8px; border-radius:4px; font-weight:600;">❓ Quiz (${attachedQuiz.total_questions || 10} Qs)</span>`
        : '';

      const extraPill = extraResList.length > 0
        ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:4px; font-weight:600;">🔗 ${extraResList.length} Extra Link${extraResList.length > 1 ? 's' : ''}</span>`
        : '';

      return `
        <tr>
          <td><strong style="color: #64748B;">#${v.display_order || idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700; color: #1E293B; font-size: 14px; margin-bottom: 2px;">${v.title}</div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <a href="${v.external_link}" target="_blank" style="font-size: 11.5px; color: #7C3AED; font-weight: 600; text-decoration: underline;">🎬 Watch Lecture Video ↗</a>
              <span style="font-size: 11.5px; color: #64748B;">⏱️ ${v.duration || '50 mins'}</span>
            </div>
          </td>
          <td>
            <div style="font-size: 12.5px; font-weight: 600; color: #334155;">👨‍🏫 ${v.teacher_name || data.subject?.default_teacher_name || 'Faculty'}</div>
            <div style="font-size: 11px; color: #94A3B8;">${v.lecture_date || 'Class Session'}</div>
          </td>
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              ${notesPill}
              ${dppPill}
              ${dppVidPill}
              ${quizPill}
              ${extraPill}
            </div>
          </td>
          <td>
            <button class="btn-sm-edit" style="font-size: 11px; padding: 3px 8px; border-radius: 4px; background: ${v.is_published ? '#DCFCE7; color: #16A34A' : '#F3F4F6; color: #6B7280'};" onclick="toggleUnifiedVideoPublish(${v.id}, ${v.is_published ? 0 : 1}, ${chapterId})">
              ${v.is_published ? '✅ Live' : '⏸️ Hidden'}
            </button>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-sm-edit" style="background: #7C3AED; color: white; border: none; padding: 4px 10px; font-weight: 600; font-size: 12px; border-radius: 4px;" onclick="openEditUnifiedLectureModal(${v.id})">⚡ Edit</button>
              <button class="btn-sm-delete" style="padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="deleteUnifiedLectureItem(${v.id}, ${chapterId})">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load content manager lectures:', err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:28px; color:#EF4444;">Failed to load content. Please try refreshing.</td></tr>';
  }
}

function refreshContentManagerList() {
  const chapId = document.getElementById('content-mgr-chapter-select')?.value;
  if (chapId) {
    loadContentManagerLectures(chapId);
    adminToast('Content refreshed');
  } else {
    loadContentManager();
  }
}

function openNewUnifiedContentFromManager() {
  const chapSelect = document.getElementById('content-mgr-chapter-select');
  const subSelect = document.getElementById('content-mgr-subject-select');
  const chapId = chapSelect ? chapSelect.value : null;

  if (!chapId) {
    adminToast('Please select a batch, subject, and chapter first', 'error');
    return;
  }

  currentContentChapter = chapId;
  currentContentSubject = subSelect ? subSelect.value : '';

  openUnifiedAddLectureModal();
}

async function toggleUnifiedVideoPublish(videoId, isPublished, chapterId) {
  try {
    const res = await adminFetch(`/api/admin/videos/${videoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished })
    });
    if (res.ok) {
      adminToast(`Lecture ${isPublished ? 'published (Live)' : 'hidden'}`);
      if (chapterId) loadContentManagerLectures(chapterId);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
    }
  } catch (err) {
    adminToast('Error updating status', 'error');
  }
}

async function deleteUnifiedLectureItem(lectureId, chapterId) {
  if (!confirm('Are you sure you want to delete this lecture and all its attached notes, DPPs, and extra resources?')) return;
  try {
    const res = await adminFetch(`/api/admin/videos/${lectureId}`, { method: 'DELETE' });
    if (res.ok) {
      adminToast('Lecture & materials removed');
      if (chapterId) loadContentManagerLectures(chapterId);
      if (currentContentChapter) loadChapterContent(currentContentChapter);
      if (currentSubjectForChapters) loadChaptersTable(currentSubjectForChapters);
    } else {
      adminToast('Failed to delete lecture', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// 6. USERS MANAGER
async function loadUsersTable() {
  try {
    const res = await adminFetch('/api/admin/users');
    const data = await res.json();
    const users = data.users || [];

    const tbody = document.getElementById('users-tbody');
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px;">No registered users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map(
        u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>⭐ <strong>${u.xp || 0} XP</strong></td>
        <td><span class="badge-published">${u.enrolled_count || 0} Batches</span></td>
        <td style="font-size: 13px; color: #6B7280;">${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-sm-delete" onclick="deleteUser(${u.id})">Delete User</button>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user and all their enrollments?')) return;
  try {
    const res = await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      adminToast('User deleted successfully');
      loadUsersTable();
    }
  } catch (err) {
    adminToast('Failed to delete user', 'error');
  }
}

// 7. ANNOUNCEMENTS MANAGER
async function loadAnnouncementsManager() {
  const batchSelect = document.getElementById('ann-batch-select');
  if (allBatches.length === 0) {
    const res = await adminFetch('/api/admin/batches');
    const data = await res.json();
    allBatches = data.batches || [];
  }

  batchSelect.innerHTML = allBatches.map(b => `<option value="${b.id}">${b.title}</option>`).join('');

  if (allBatches.length > 0) {
    loadAnnouncementsForBatch(batchSelect.value || allBatches[0].id);
  }
}

async function loadAnnouncementsForBatch(batchId) {
  try {
    const res = await adminFetch(`/api/admin/announcements/${batchId}`);
    const data = await res.json();
    const announcements = data.announcements || [];

    const list = document.getElementById('announcements-list');
    if (announcements.length === 0) {
      list.innerHTML = '<div style="padding: 24px; text-align: center; color: #6B7280;">No announcements for this batch yet.</div>';
      return;
    }

    list.innerHTML = announcements
      .map(
        a => `
      <div style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
        <div>
          <p style="font-size: 14.5px; color: #111827; font-weight: 500; margin-bottom: 6px;">${a.message}</p>
          <span style="font-size: 12px; color: #6B7280;">${new Date(a.created_at).toLocaleString()}</span>
        </div>
        <button class="btn-sm-delete" onclick="deleteAnnouncement(${a.id}, ${batchId})">Delete</button>
      </div>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load announcements:', err);
  }
}

async function createAnnouncement(e) {
  e.preventDefault();
  const batchId = document.getElementById('ann-batch-select').value;
  const message = document.getElementById('ann-message-input').value.trim();

  if (!message) return;

  try {
    const res = await adminFetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId, message })
    });
    if (res.ok) {
      adminToast('Announcement broadcasted!');
      document.getElementById('ann-message-input').value = '';
      loadAnnouncementsForBatch(batchId);
    }
  } catch (err) {
    adminToast('Failed to create announcement', 'error');
  }
}

async function deleteAnnouncement(annId, batchId) {
  if (!confirm('Delete this announcement?')) return;
  try {
    const res = await adminFetch(`/api/admin/announcements/${annId}`, { method: 'DELETE' });
    if (res.ok) {
      adminToast('Announcement removed');
      loadAnnouncementsForBatch(batchId);
    }
  } catch (err) {
    adminToast('Failed to delete announcement', 'error');
  }
}

// 8. SITE SETTINGS MANAGER
async function loadSettingsForm() {
  try {
    const res = await adminFetch('/api/admin/settings');
    const data = await res.json();
    const s = data.settings || {};

    const setNoticeActive = document.getElementById('set-notice-active');
    if (setNoticeActive) setNoticeActive.value = s.notice_bar_active !== undefined ? String(s.notice_bar_active) : '1';
    
    const setNoticeText = document.getElementById('set-notice-text');
    if (setNoticeText) setNoticeText.value = s.notice_bar_text || '';

    const setNoticeLink = document.getElementById('set-notice-link');
    if (setNoticeLink) setNoticeLink.value = s.notice_bar_link || '';

    const setSiteName = document.getElementById('set-site-name');
    if (setSiteName) setSiteName.value = s.site_name || 'PW SENSEI';

    const setLogoUrl = document.getElementById('set-logo-url');
    if (setLogoUrl) setLogoUrl.value = s.site_logo_url || '';

    const setPrimaryColor = document.getElementById('set-primary-color');
    if (setPrimaryColor) setPrimaryColor.value = s.primary_color || '#7C3AED';

    const setFooterText = document.getElementById('set-footer-text');
    if (setFooterText) setFooterText.value = s.footer_text || '';

    const setTelegram = document.getElementById('set-telegram');
    if (setTelegram) setTelegram.value = s.telegram_link || 'https://t.me/pwsensei_official';

    const setTelegramName = document.getElementById('set-telegram-name');
    if (setTelegramName) setTelegramName.value = s.telegram_channel_name || '@pwsensei_official';

    const setTelegramBot = document.getElementById('set-telegram-bot');
    if (setTelegramBot) setTelegramBot.value = s.telegram_bot || '';

    const setAppDownload = document.getElementById('set-app-download');
    if (setAppDownload) setAppDownload.value = s.app_download_link || '';

    const setDonateUpi = document.getElementById('set-donate-upi');
    if (setDonateUpi) setDonateUpi.value = s.donate_upi_id || '';

    const setDonateQr = document.getElementById('set-donate-qr');
    if (setDonateQr) setDonateQr.value = s.donate_qr_image_url || '';

    const setHeroHeading = document.getElementById('set-hero-heading');
    if (setHeroHeading) setHeroHeading.value = s.hero_heading || '';

    const setHeroSub = document.getElementById('set-hero-subheading');
    if (setHeroSub) setHeroSub.value = s.hero_subheading || '';

    const setHeroCtaText = document.getElementById('set-hero-cta-text');
    if (setHeroCtaText) setHeroCtaText.value = s.hero_cta_text || '';

    const setHeroCtaLink = document.getElementById('set-hero-cta-link');
    if (setHeroCtaLink) setHeroCtaLink.value = s.hero_cta_link || '';

    // Official Entertainment section fields
    const setEntSecTitle = document.getElementById('set-ent-section-title');
    if (setEntSecTitle) setEntSecTitle.value = s.ent_section_title || 'Official Entertainment';

    const setEntSecDesc = document.getElementById('set-ent-section-desc');
    if (setEntSecDesc) setEntSecDesc.value = s.ent_section_desc || 'Explore our official web portal and community channels for verified updates, study drives, and interactive sessions.';

    const setEntWebTitle = document.getElementById('set-ent-web-title');
    if (setEntWebTitle) setEntWebTitle.value = s.ent_web_title || 'Official Website';

    const setEntWebDesc = document.getElementById('set-ent-web-desc');
    if (setEntWebDesc) setEntWebDesc.value = s.ent_web_desc || 'Access our official web platform for batch enrollments, syllabus roadmaps, interactive quizzes, and test series.';

    const setEntWebImg = document.getElementById('set-ent-web-img');
    if (setEntWebImg) setEntWebImg.value = s.ent_web_img || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600';

    const setEntWebUrl = document.getElementById('set-ent-web-url');
    if (setEntWebUrl) setEntWebUrl.value = s.ent_web_url || 'https://pwsensei.live';

    const setEntTgTitle = document.getElementById('set-ent-tg-title');
    if (setEntTgTitle) setEntTgTitle.value = s.ent_tg_title || 'Official Telegram Channel';

    const setEntTgDesc = document.getElementById('set-ent-tg-desc');
    if (setEntTgDesc) setEntTgDesc.value = s.ent_tg_desc || 'Movies, Web Series & Entertainment Updates';

    const setEntTgImg = document.getElementById('set-ent-tg-img');
    if (setEntTgImg) setEntTgImg.value = s.ent_tg_img || 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png';

    const setEntTgUrl = document.getElementById('set-ent-tg-url');
    if (setEntTgUrl) setEntTgUrl.value = s.ent_tg_url || 'https://t.me/pwsensei_official';

  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveAllSettings(e) {
  if (e) e.preventDefault();

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const settings = {
    notice_bar_active: getVal('set-notice-active') === '1' ? 1 : 0,
    notice_bar_text: getVal('set-notice-text'),
    notice_bar_link: getVal('set-notice-link'),
    site_name: getVal('set-site-name') || 'PW SENSEI',
    site_logo_url: getVal('set-logo-url'),
    primary_color: getVal('set-primary-color') || '#7C3AED',
    footer_text: getVal('set-footer-text'),
    telegram_link: getVal('set-telegram'),
    telegram_channel_name: getVal('set-telegram-name'),
    telegram_bot: getVal('set-telegram-bot'),
    app_download_link: getVal('set-app-download'),
    donate_upi_id: getVal('set-donate-upi'),
    donate_qr_image_url: getVal('set-donate-qr'),
    hero_heading: getVal('set-hero-heading'),
    hero_subheading: getVal('set-hero-subheading'),
    hero_cta_text: getVal('set-hero-cta-text'),
    hero_cta_link: getVal('set-hero-cta-link'),
    // Official Entertainment settings
    ent_section_title: getVal('set-ent-section-title') || 'Official Entertainment',
    ent_section_desc: getVal('set-ent-section-desc'),
    ent_web_title: getVal('set-ent-web-title') || 'Official Website',
    ent_web_desc: getVal('set-ent-web-desc'),
    ent_web_img: getVal('set-ent-web-img'),
    ent_web_url: getVal('set-ent-web-url') || 'https://pwsensei.live',
    ent_tg_title: getVal('set-ent-tg-title') || 'Official Telegram Channel',
    ent_tg_desc: getVal('set-ent-tg-desc'),
    ent_tg_img: getVal('set-ent-tg-img'),
    ent_tg_url: getVal('set-ent-tg-url') || 'https://t.me/pwsensei_official'
  };

  try {
    const res = await adminFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    if (res.ok) {
      adminToast('All site configuration settings saved successfully!');
    } else {
      adminToast('Failed to save settings', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// 9. TEACHERS CRUD
let allTeachers = [];

async function loadTeachersTable() {
  try {
    if (allBatches.length === 0) {
      const bRes = await adminFetch('/api/admin/batches');
      const bData = await bRes.json();
      allBatches = bData.batches || [];
    }

    const res = await adminFetch('/api/admin/teachers');
    const data = await res.json();
    allTeachers = data.teachers || [];

    const tbody = document.getElementById('teachers-table-body');
    if (!tbody) return;

    if (allTeachers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #6B7280; padding: 24px;">No faculty members added yet. Click "+ Add Educator" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = allTeachers.map((t, idx) => {
      const batchObj = allBatches.find(b => b.id === t.batch_id);
      const batchLabel = batchObj ? batchObj.title : 'Global (All Batches)';

      return `
        <tr>
          <td><strong>#${t.display_order || idx + 1}</strong></td>
          <td>
            <img src="${t.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #E5E7EB;" />
          </td>
          <td>
            <strong>${t.name}</strong>
            <div style="font-size: 11px; color: #6B7280;">${batchLabel}</div>
          </td>
          <td><span style="background: #EDE9FE; color: #6D28D9; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${t.subject || t.subjects_taught || 'General'}</span></td>
          <td>${t.experience || 'Faculty'}</td>
          <td>${t.is_active ? '<span class="badge-published">Active</span>' : '<span class="badge-draft">Hidden</span>'}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn-primary-sm" onclick="openEditTeacherModal(${t.id})" style="padding: 4px 8px; font-size: 12px;">✏️ Edit</button>
              <button class="btn-danger-sm" onclick="deleteTeacher(${t.id}, '${t.name.replace(/'/g, "\\'")}')" style="padding: 4px 8px; font-size: 12px;">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load teachers:', err);
    adminToast('Failed to load faculty list', 'error');
  }
}

function populateTeacherBatchSelect(selectedBatchId = null) {
  const select = document.getElementById('teacher-batch-select');
  if (!select) return;

  select.innerHTML = '<option value="">-- All Batches (Global Faculty) --</option>' +
    allBatches.map(b => `<option value="${b.id}" ${selectedBatchId === b.id ? 'selected' : ''}>${b.title}</option>`).join('');
}

function openTeacherModal() {
  document.getElementById('teacher-modal-title').textContent = 'Add Educator';
  document.getElementById('teacher-id-input').value = '';
  document.getElementById('teacher-name-input').value = '';
  document.getElementById('teacher-photo-input').value = '';
  const thumbInput = document.getElementById('teacher-thumb-input');
  if (thumbInput) thumbInput.value = '';
  document.getElementById('teacher-subject-input').value = '';
  document.getElementById('teacher-exp-input').value = '';
  document.getElementById('teacher-bio-input').value = '';
  document.getElementById('teacher-order-input').value = allTeachers.length + 1;
  document.getElementById('teacher-is-active-input').checked = true;

  populateTeacherBatchSelect();
  openModal('teacher-modal');
}

function openEditTeacherModal(teacherId) {
  const t = allTeachers.find(item => item.id === Number(teacherId));
  if (!t) return;

  document.getElementById('teacher-modal-title').textContent = 'Edit Educator';
  document.getElementById('teacher-id-input').value = t.id;
  document.getElementById('teacher-name-input').value = t.name || '';
  document.getElementById('teacher-photo-input').value = t.photo_url || '';
  const thumbInput = document.getElementById('teacher-thumb-input');
  if (thumbInput) thumbInput.value = t.default_thumbnail_url || '';
  document.getElementById('teacher-subject-input').value = t.subject || t.subjects_taught || '';
  document.getElementById('teacher-exp-input').value = t.experience || '';
  document.getElementById('teacher-bio-input').value = t.bio || '';
  document.getElementById('teacher-order-input').value = t.display_order || 0;
  document.getElementById('teacher-is-active-input').checked = Boolean(t.is_active);

  populateTeacherBatchSelect(t.batch_id);
  openModal('teacher-modal');
}

async function saveTeacher(event) {
  event.preventDefault();
  const id = document.getElementById('teacher-id-input').value;
  const batchVal = document.getElementById('teacher-batch-select')?.value;
  const subjectVal = document.getElementById('teacher-subject-input').value.trim();

  const payload = {
    batch_id: batchVal ? parseInt(batchVal, 10) : null,
    name: document.getElementById('teacher-name-input').value.trim(),
    photo_url: document.getElementById('teacher-photo-input').value.trim(),
    default_thumbnail_url: document.getElementById('teacher-thumb-input')?.value.trim() || '',
    subject: subjectVal,
    subjects_taught: subjectVal,
    experience: document.getElementById('teacher-exp-input').value.trim(),
    bio: document.getElementById('teacher-bio-input').value.trim(),
    display_order: parseInt(document.getElementById('teacher-order-input').value, 10) || 0,
    is_active: document.getElementById('teacher-is-active-input').checked ? 1 : 0
  };

  try {
    let res;
    if (id) {
      res = await adminFetch(`/api/admin/teachers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await adminFetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('teacher-modal');
      adminToast(id ? 'Educator profile updated!' : 'New educator added!');
      loadTeachersTable();
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save educator', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteTeacher(teacherId, teacherName) {
  if (!confirm(`Delete educator "${teacherName}"?`)) return;
  try {
    const res = await adminFetch(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      adminToast(data.message || 'Educator removed successfully', 'success');
      await loadTeachersTable();
    } else {
      adminToast(data.error || 'Failed to delete educator', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// 10. NAVIGATION LINKS CRUD
let allNavLinks = [];

async function loadNavLinksTable() {
  try {
    const res = await adminFetch('/api/admin/nav-links');
    const data = await res.json();
    allNavLinks = data.links || data.navLinks || [];

    const tbody = document.getElementById('navlinks-table-body');
    if (!tbody) return;

    if (allNavLinks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #6B7280; padding: 24px;">No custom navigation items yet. Click "+ Add Menu Item" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = allNavLinks.map((l, idx) => `
      <tr>
        <td><strong>#${l.display_order || idx + 1}</strong></td>
        <td style="font-size: 18px;">${l.icon || '🔗'}</td>
        <td><strong>${l.label}</strong></td>
        <td><a href="${l.url}" target="_blank" style="color: #7C3AED; text-decoration: underline; word-break: break-all;">${l.url}</a></td>
        <td>${l.is_external ? '<span style="color:#0284C7; font-size:12px; font-weight:700;">New Tab ↗</span>' : '<span style="color:#6B7280; font-size:12px;">Same Tab</span>'}</td>
        <td>${l.is_active ? '<span class="badge-published">Active</span>' : '<span class="badge-draft">Hidden</span>'}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-primary-sm" onclick="openEditNavLinkModal(${l.id})" style="padding: 4px 8px; font-size: 12px;">✏️ Edit</button>
            <button class="btn-danger-sm" onclick="deleteNavLink(${l.id}, '${l.label.replace(/'/g, "\\'")}')" style="padding: 4px 8px; font-size: 12px;">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load nav links:', err);
    adminToast('Failed to load navigation items', 'error');
  }
}

function openNavLinkModal() {
  document.getElementById('navlink-modal-title').textContent = 'Add Navigation Menu Item';
  document.getElementById('navlink-id-input').value = '';
  document.getElementById('navlink-label-input').value = '';
  document.getElementById('navlink-url-input').value = '';
  document.getElementById('navlink-icon-input').value = '⭐';
  document.getElementById('navlink-order-input').value = allNavLinks.length + 1;
  document.getElementById('navlink-is-external-input').checked = true;
  document.getElementById('navlink-is-active-input').checked = true;
  openModal('navlink-modal');
}

function openEditNavLinkModal(linkId) {
  const l = allNavLinks.find(item => Number(item.id) === Number(linkId));
  if (!l) return;

  document.getElementById('navlink-modal-title').textContent = 'Edit Navigation Menu Item';
  document.getElementById('navlink-id-input').value = l.id;
  document.getElementById('navlink-label-input').value = l.label || '';
  document.getElementById('navlink-url-input').value = l.url || '';
  document.getElementById('navlink-icon-input').value = l.icon || '⭐';
  document.getElementById('navlink-order-input').value = l.display_order || 0;
  document.getElementById('navlink-is-external-input').checked = Boolean(l.is_external);
  document.getElementById('navlink-is-active-input').checked = Boolean(l.is_active);
  openModal('navlink-modal');
}

async function saveNavLink(event) {
  event.preventDefault();
  const id = document.getElementById('navlink-id-input').value;
  const payload = {
    label: document.getElementById('navlink-label-input').value.trim(),
    url: document.getElementById('navlink-url-input').value.trim(),
    icon: document.getElementById('navlink-icon-input').value.trim() || '🔗',
    display_order: parseInt(document.getElementById('navlink-order-input').value, 10) || 0,
    is_external: document.getElementById('navlink-is-external-input').checked ? 1 : 0,
    is_active: document.getElementById('navlink-is-active-input').checked ? 1 : 0
  };

  try {
    let res;
    if (id) {
      res = await adminFetch(`/api/admin/nav-links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await adminFetch('/api/admin/nav-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('navlink-modal');
      adminToast(id ? 'Menu item updated!' : 'New menu item created!');
      await loadNavLinksTable();
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save menu item', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

async function deleteNavLink(linkId, linkLabel) {
  if (!confirm(`Delete navigation item "${linkLabel}"?`)) return;
  try {
    const res = await adminFetch(`/api/admin/nav-links/${linkId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      adminToast(data.message || 'Navigation item removed', 'success');
      await loadNavLinksTable();
    } else {
      adminToast(data.error || 'Failed to delete navigation item', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// 11. COCKROACHDB CLOUD DATABASE CHECK
async function checkDatabaseStatus() {
  const desc = document.getElementById('db-status-desc');
  const badge = document.getElementById('db-mode-badge');
  if (desc) desc.textContent = 'Testing CockroachDB Cloud connectivity...';

  try {
    const res = await fetch('/api/batches');
    if (res.ok) {
      if (desc) desc.textContent = 'CockroachDB Cloud connection verified! Database is active and persistent.';
      if (badge) {
        badge.textContent = 'CONNECTED';
        badge.style.background = '#10B981';
      }
      adminToast('Database connection tested successfully!');
    } else {
      if (desc) desc.textContent = 'Database error or connection issue.';
      if (badge) {
        badge.textContent = 'ERROR';
        badge.style.background = '#EF4444';
      }
    }
  } catch (err) {
    if (desc) desc.textContent = 'Could not reach server API.';
    if (badge) {
      badge.textContent = 'OFFLINE';
      badge.style.background = '#EF4444';
    }
  }
}

// 8. PROMOTIONAL BANNERS MANAGER
async function loadBannersManager() {
  try {
    const res = await adminFetch('/api/admin/banners');
    const data = await res.json();
    allBanners = data.banners || [];

    // Load Carousel Settings
    const intervalSelect = document.getElementById('carousel-interval-select');
    const autoSlideCheck = document.getElementById('carousel-auto-slide-check');

    if (intervalSelect && data.interval) {
      intervalSelect.value = String(data.interval);
    }
    if (autoSlideCheck) {
      autoSlideCheck.checked = data.auto_slide !== false;
    }

    const container = document.getElementById('banners-list-container');
    if (!container) return;

    if (allBanners.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; background: #F9FAFB; border: 2px dashed #E5E7EB; border-radius: 12px;">
          <div style="font-size: 36px; margin-bottom: 12px;">🖼️</div>
          <h3 style="font-size: 16px; font-weight: 700; color: #374151; margin-bottom: 6px;">No Promotional Banners Yet</h3>
          <p style="font-size: 14px; color: #6B7280; margin-bottom: 18px; max-width: 420px; margin-left: auto; margin-right: auto;">
            Add your first promotional banner to display auto-rotating notices, scholarship offers, or Telegram links directly below the search bar.
          </p>
          <button class="btn-primary" onclick="openNewBannerModal()">+ Create First Banner</button>
        </div>
      `;
      return;
    }

    container.innerHTML = allBanners
      .map((b, idx) => {
        const isExternal = b.redirect_url && (b.redirect_url.startsWith('http://') || b.redirect_url.startsWith('https://'));
        const badgeColor = b.badge_color || '#EF4444';
        const imgUrl = b.image_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200';

        return `
          <div class="banner-admin-card" id="banner-admin-card-${b.id}">
            <div class="banner-reorder-btns">
              <button class="banner-reorder-btn" title="Move Up" onclick="moveBannerOrder(${b.id}, 'up')" ${idx === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>▲</button>
              <button class="banner-reorder-btn" title="Move Down" onclick="moveBannerOrder(${b.id}, 'down')" ${idx === allBanners.length - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>▼</button>
            </div>

            <div class="banner-admin-thumb" style="background-image: url('${imgUrl}');">
              ${b.badge_text ? `<span style="position: absolute; top: 6px; left: 6px; background: ${badgeColor}; color: #FFFFFF; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${b.badge_text}</span>` : ''}
            </div>

            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: #6B7280; background: #F3F4F6; padding: 2px 6px; border-radius: 4px;">#${idx + 1}</span>
                <h4 style="font-size: 15px; font-weight: 700; color: #111827; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b.title}</h4>
              </div>
              <p style="font-size: 13px; color: #6B7280; margin: 0 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b.subtitle || 'No subtitle provided'}</p>
              <div style="display: flex; align-items: center; gap: 12px; font-size: 12px;">
                <span style="color: #6B7280;">Target: <a href="${b.redirect_url || '#'}" ${isExternal ? 'target="_blank"' : ''} style="color: #7C3AED; font-weight: 600; text-decoration: underline;">${b.redirect_url || '#'}</a></span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 20px;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <label class="switch-toggle" title="Toggle Banner Visibility">
                  <input type="checkbox" ${b.is_active ? 'checked' : ''} onchange="toggleBannerStatus(${b.id}, this.checked)" />
                  <span class="slider-toggle"></span>
                </label>
                <span style="font-size: 11px; font-weight: 700; color: ${b.is_active ? '#10B981' : '#9CA3AF'};">${b.is_active ? 'LIVE' : 'DISABLED'}</span>
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn-primary-sm" onclick="openEditBannerModal(${b.id})" style="padding: 6px 12px; font-size: 13px;">✏️ Edit</button>
                <button class="btn-danger-sm" onclick="deleteBanner(${b.id}, '${b.title.replace(/'/g, "\\'")}')" style="padding: 6px 12px; font-size: 13px;">🗑️</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load banners in admin:', err);
    adminToast('Failed to load banners', 'error');
  }
}

// Save Carousel Global Settings (Interval & Auto-Slide)
async function saveBannerCarouselSettings(event) {
  if (event) event.preventDefault();
  const intervalSelect = document.getElementById('carousel-interval-select');
  const autoSlideCheck = document.getElementById('carousel-auto-slide-check');

  const interval = intervalSelect ? parseInt(intervalSelect.value, 10) : 4000;
  const auto_slide = autoSlideCheck ? autoSlideCheck.checked : true;

  try {
    const res = await adminFetch('/api/admin/banners/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval, auto_slide })
    });
    if (res.ok) {
      adminToast('Carousel speed and rotation settings saved successfully!');
    } else {
      adminToast('Failed to save carousel settings', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// Open New Banner Modal
function openNewBannerModal() {
  document.getElementById('banner-id-input').value = '';
  document.getElementById('banner-title-input').value = '';
  document.getElementById('banner-subtitle-input').value = '';
  document.getElementById('banner-image-input').value = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200';
  document.getElementById('banner-redirect-input').value = '/study.html';
  document.getElementById('banner-badge-text-input').value = '100% SCHOLARSHIP';
  document.getElementById('banner-badge-color-input').value = '#EF4444';
  document.getElementById('banner-order-input').value = allBanners.length + 1;
  document.getElementById('banner-is-active-input').checked = true;

  document.getElementById('banner-modal-title').textContent = 'Create Promotional Banner';
  updateBannerPreview();
  openModal('banner-modal');
}

// Open Edit Banner Modal
function openEditBannerModal(bannerId) {
  const b = allBanners.find((item) => item.id === Number(bannerId));
  if (!b) return;

  document.getElementById('banner-id-input').value = b.id;
  document.getElementById('banner-title-input').value = b.title || '';
  document.getElementById('banner-subtitle-input').value = b.subtitle || '';
  document.getElementById('banner-image-input').value = b.image_url || '';
  document.getElementById('banner-redirect-input').value = b.redirect_url || '';
  document.getElementById('banner-badge-text-input').value = b.badge_text || '';
  document.getElementById('banner-badge-color-input').value = b.badge_color || '#EF4444';
  document.getElementById('banner-order-input').value = b.display_order || 0;
  document.getElementById('banner-is-active-input').checked = Boolean(b.is_active);

  document.getElementById('banner-modal-title').textContent = 'Edit Promotional Banner';
  updateBannerPreview();
  openModal('banner-modal');
}

// Set Preset Image Helper
function setBannerPresetImage(url) {
  document.getElementById('banner-image-input').value = url;
  updateBannerPreview();
}

// Update Live Preview inside Modal
function updateBannerPreview() {
  const title = document.getElementById('banner-title-input').value || 'Banner Title Preview';
  const subtitle = document.getElementById('banner-subtitle-input').value || 'Banner Subtitle Preview';
  const imgUrl = document.getElementById('banner-image-input').value || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200';
  const badgeText = document.getElementById('banner-badge-text-input').value || 'SCHOLARSHIP TEST';
  const badgeColor = document.getElementById('banner-badge-color-input').value || '#EF4444';

  const previewBox = document.getElementById('banner-modal-preview');
  const previewTitle = document.getElementById('preview-title');
  const previewSub = document.getElementById('preview-subtitle');
  const previewBadge = document.getElementById('preview-badge');

  if (previewBox) previewBox.style.backgroundImage = `url('${imgUrl}')`;
  if (previewTitle) previewTitle.textContent = title;
  if (previewSub) previewSub.textContent = subtitle;
  if (previewBadge) {
    previewBadge.textContent = badgeText;
    previewBadge.style.background = badgeColor;
    previewBadge.style.display = badgeText.trim() ? 'inline-block' : 'none';
  }
}

// Save Banner (Create or Update)
async function saveBanner(event) {
  event.preventDefault();
  const id = document.getElementById('banner-id-input').value;
  const title = document.getElementById('banner-title-input').value.trim();
  const subtitle = document.getElementById('banner-subtitle-input').value.trim();
  const image_url = document.getElementById('banner-image-input').value.trim();
  const redirect_url = document.getElementById('banner-redirect-input').value.trim();
  const badge_text = document.getElementById('banner-badge-text-input').value.trim();
  const badge_color = document.getElementById('banner-badge-color-input').value;
  const display_order = parseInt(document.getElementById('banner-order-input').value, 10) || 0;
  const is_active = document.getElementById('banner-is-active-input').checked;

  if (!title || !image_url || !redirect_url) {
    adminToast('Title, Image URL, and Redirect URL are required', 'error');
    return;
  }

  const payload = {
    title,
    subtitle,
    image_url,
    redirect_url,
    badge_text,
    badge_color,
    display_order,
    is_active
  };

  try {
    let res;
    if (id) {
      res = await adminFetch(`/api/admin/banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await adminFetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('banner-modal');
      adminToast(id ? 'Banner updated successfully!' : 'New promotional banner created!');
      loadBannersManager();
      loadDashboard();
    } else {
      const data = await res.json();
      adminToast(data.error || 'Failed to save banner', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// Toggle Banner Active Status
async function toggleBannerStatus(bannerId, isActive) {
  try {
    const res = await adminFetch(`/api/admin/banners/${bannerId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    if (res.ok) {
      adminToast(`Banner ${isActive ? 'activated (Live)' : 'disabled'}`);
      loadBannersManager();
      loadDashboard();
    } else {
      adminToast('Failed to update banner status', 'error');
      loadBannersManager();
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
    loadBannersManager();
  }
}

// Reorder Banners (Up / Down)
async function moveBannerOrder(bannerId, direction) {
  const idx = allBanners.findIndex((b) => b.id === Number(bannerId));
  if (idx === -1) return;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= allBanners.length) return;

  // Swap elements in memory
  const temp = allBanners[idx];
  allBanners[idx] = allBanners[targetIdx];
  allBanners[targetIdx] = temp;

  // Prepare ordered list with new display_order indices
  const orderList = allBanners.map((b, i) => ({
    id: b.id,
    display_order: i + 1
  }));

  try {
    const res = await adminFetch('/api/admin/banners/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banners: orderList })
    });
    if (res.ok) {
      adminToast('Banners reordered successfully!');
      loadBannersManager();
    } else {
      adminToast('Failed to reorder banners', 'error');
      loadBannersManager();
    }
  } catch (err) {
    adminToast('Error updating banner order', 'error');
  }
}

// Delete Banner
async function deleteBanner(bannerId, bannerTitle) {
  if (!confirm(`Are you sure you want to delete the banner "${bannerTitle}"? This cannot be undone.`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/banners/${bannerId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      adminToast('Banner deleted successfully');
      loadBannersManager();
      loadDashboard();
    } else {
      adminToast('Failed to delete banner', 'error');
    }
  } catch (err) {
    adminToast('Error connecting to server', 'error');
  }
}

// Initialize Admin on load
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();

  // Setup batch select change listeners
  const contentBatchSelect = document.getElementById('content-batch-select');
  if (contentBatchSelect) {
    contentBatchSelect.addEventListener('change', (e) => loadSubjectsForBatch(e.target.value));
  }

  const videoBatchSelect = document.getElementById('video-batch-select');
  if (videoBatchSelect) {
    videoBatchSelect.addEventListener('change', (e) => loadSubjectsForVideos(e.target.value));
  }

  const videoSubSelect = document.getElementById('video-subject-select');
  if (videoSubSelect) {
    videoSubSelect.addEventListener('change', (e) => loadVideosList(e.target.value));
  }

  const pdfBatchSelect = document.getElementById('pdf-batch-select');
  if (pdfBatchSelect) {
    pdfBatchSelect.addEventListener('change', (e) => loadSubjectsForPdfs(e.target.value));
  }

  const pdfSubSelect = document.getElementById('pdf-subject-select');
  if (pdfSubSelect) {
    pdfSubSelect.addEventListener('change', (e) => loadPdfsList(e.target.value));
  }

  const annBatchSelect = document.getElementById('ann-batch-select');
  if (annBatchSelect) {
    annBatchSelect.addEventListener('change', (e) => loadAnnouncementsForBatch(e.target.value));
  }

  // Setup modals outside click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
      }
    });
  });
});
