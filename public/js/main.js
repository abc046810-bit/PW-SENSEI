/**
 * PW SENSEI - Public Frontend Logic (main.js)
 * Fully open educational portal - No visitor login/signup required.
 */

window.AppState = {
  settings: {},
  darkMode: localStorage.getItem('theme') === 'dark',
  savedBatches: JSON.parse(localStorage.getItem('pwsensei_saved_batches') || '[]')
};

// Official Telegram Brand SVG Icon
window.TELEGRAM_LOGO_SVG = `
<svg class="telegram-brand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; flex-shrink: 0;">
  <circle cx="12" cy="12" r="12" fill="#24A1DE"/>
  <path d="M5.4 11.972l11.455-4.664c.531-.192 1.002.13.829.896l-1.95 9.186c-.144.646-.531.802-1.077.502l-2.986-2.203-1.44 1.388c-.16.16-.293.293-.6.293l.214-3.045 5.54-5.008c.241-.214-.053-.332-.373-.12l-6.848 4.312-2.95-.923c-.642-.2-.656-.642.134-.951z" fill="#FFFFFF"/>
</svg>
`.trim();

// Global Toast System
window.showToast = function (message, type = 'success') {
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
      <span>${message}</span>
    </div>
    <button class="toast-close-btn">&times;</button>
  `;

  toast.querySelector('.toast-close-btn').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Apply Theme
function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    window.AppState.darkMode = true;
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    window.AppState.darkMode = false;
  }
}

// Toggle Dark Mode
window.toggleDarkMode = function () {
  applyTheme(!window.AppState.darkMode);
};

// Mobile Sidebar Toggle
window.toggleSidebar = function () {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
};

// Load Dynamic Navigation Links from Database
async function loadDynamicNavLinks() {
  try {
    const res = await fetch('/api/nav-links');
    const data = await res.json();
    const navLinks = data.navLinks || [];
    if (navLinks.length === 0) return;

    const sidebarNav = document.querySelector('.sidebar-nav');
    if (!sidebarNav) return;

    // Check if dynamic links container already mounted
    let dynamicContainer = document.getElementById('sidebar-dynamic-links');
    if (!dynamicContainer) {
      dynamicContainer = document.createElement('div');
      dynamicContainer.id = 'sidebar-dynamic-links';
      dynamicContainer.style.margin = '4px 0';
      sidebarNav.appendChild(dynamicContainer);
    }

    dynamicContainer.innerHTML = navLinks.map(link => {
      const isExt = link.is_external || link.url.startsWith('http://') || link.url.startsWith('https://') || link.url.startsWith('tg://');
      const targetAttr = isExt ? 'target="_blank" rel="noopener noreferrer"' : '';
      const isTg = link.url.includes('t.me') || link.label.toLowerCase().includes('telegram');
      const iconHtml = isTg ? window.TELEGRAM_LOGO_SVG : `<span class="nav-icon">${link.icon || '🔗'}</span>`;

      return `
        <a href="${link.url}" ${targetAttr} class="nav-link">
          ${iconHtml}
          <span>${link.label}</span>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load custom nav links:', err);
  }
}

// Render Top Notice Bar if enabled
function renderTopNoticeBar(settings) {
  if (!settings || settings.notice_bar_active === '0' || !settings.notice_bar_text) {
    const existing = document.getElementById('top-notice-bar');
    if (existing) existing.remove();
    return;
  }

  let noticeBar = document.getElementById('top-notice-bar');
  if (!noticeBar) {
    noticeBar = document.createElement('div');
    noticeBar.id = 'top-notice-bar';
    document.body.prepend(noticeBar);
  }

  const noticeLink = settings.notice_bar_link || 'https://t.me/pwsensei_official';
  noticeBar.innerHTML = `
    <div style="background: linear-gradient(90deg, #1E1B4B 0%, #312E81 50%, #1E1B4B 100%); color: #F8FAFC; padding: 8px 16px; font-size: 13px; font-weight: 600; text-align: center; border-bottom: 1px solid rgba(124, 58, 237, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
      <span>${settings.notice_bar_text}</span>
      <a href="${noticeLink}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 5px; background: rgba(56, 189, 248, 0.2); color: #38BDF8; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-decoration: none; border: 1px solid rgba(56, 189, 248, 0.35); margin-left: 6px;">
        ${window.TELEGRAM_LOGO_SVG}
        <span>Join Updates</span>
        <span style="font-size: 10px;">&rarr;</span>
      </a>
      <button onclick="document.getElementById('top-notice-bar').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 16px; margin-left: 8px; line-height: 1;" title="Dismiss">&times;</button>
    </div>
  `;
}

// Load Site Settings and Apply to Page
async function loadSiteSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.settings) {
      window.AppState.settings = data.settings;
      const s = data.settings;

      // Apply Notice Bar
      renderTopNoticeBar(s);

      // Apply primary color
      if (s.primary_color) {
        document.documentElement.style.setProperty('--primary', s.primary_color);
      }

      // Site Name in Title and Navbars
      if (s.site_name) {
        document.querySelectorAll('.site-name-text').forEach(el => {
          el.textContent = s.site_name;
        });
      }

      // Site Logo
      const logoUrl = s.site_logo_url || s.logo_url;
      if (logoUrl && logoUrl.trim()) {
        const cleanLogo = logoUrl.trim();
        document.querySelectorAll('.site-logo-img').forEach(el => {
          el.src = cleanLogo;
          el.style.display = 'inline-block';
        });

        // Auto-inject or update logo inside .sidebar-header
        document.querySelectorAll('.sidebar-header').forEach(header => {
          let logoImg = header.querySelector('.sidebar-logo-img');
          if (!logoImg) {
            logoImg = document.createElement('img');
            logoImg.className = 'sidebar-logo-img site-logo-img';
            logoImg.alt = s.site_name || 'PW SENSEI';
            logoImg.style.width = '34px';
            logoImg.style.height = '34px';
            logoImg.style.borderRadius = '8px';
            logoImg.style.objectFit = 'contain';
            logoImg.style.flexShrink = '0';
            header.prepend(logoImg);
          }
          logoImg.src = cleanLogo;
          logoImg.style.display = 'inline-block';
          const emojiIcon = header.querySelector('.sidebar-logo-icon');
          if (emojiIcon) emojiIcon.style.display = 'none';
        });

        // Auto-inject or update logo inside .landing-logo
        document.querySelectorAll('.landing-logo').forEach(logoContainer => {
          let logoImg = logoContainer.querySelector('.landing-logo-img');
          if (!logoImg) {
            logoImg = document.createElement('img');
            logoImg.className = 'landing-logo-img site-logo-img';
            logoImg.alt = s.site_name || 'PW SENSEI';
            logoImg.style.width = '38px';
            logoImg.style.height = '38px';
            logoImg.style.borderRadius = '8px';
            logoImg.style.objectFit = 'contain';
            logoImg.style.flexShrink = '0';
            logoContainer.prepend(logoImg);
          }
          logoImg.src = cleanLogo;
          logoImg.style.display = 'inline-block';
          const iconSpan = logoContainer.querySelector('.icon');
          if (iconSpan) iconSpan.style.display = 'none';
        });
      }

      // Footer Text
      if (s.footer_text) {
        document.querySelectorAll('.site-footer-text').forEach(el => {
          el.textContent = s.footer_text;
        });
      }

      // Telegram Link
      if (s.telegram_link) {
        document.querySelectorAll('.telegram-link-btn').forEach(el => {
          el.href = s.telegram_link;
        });
      }

      // Replace any Telegram icon spans with official Telegram Brand SVG
      document.querySelectorAll('.telegram-icon-holder, .telegram-icon-svg-slot').forEach(el => {
        el.innerHTML = window.TELEGRAM_LOGO_SVG;
      });

      // Contact Us -> Telegram Link (Bot or Channel)
      const contactUrl = s.telegram_bot || s.telegram_link || 'https://t.me/pwsensei_official';
      const formattedContactUrl = contactUrl.startsWith('@') ? `https://t.me/${contactUrl.replace(/^@/, '')}` : contactUrl;
      document.querySelectorAll('.contact-telegram-link, .contact-email-link, .contact-link').forEach(el => {
        el.href = formattedContactUrl;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      });
    }
    
    // Also load dynamic navigation links
    loadDynamicNavLinks();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Render Clean Public Header (No login needed)
function renderPublicHeader() {
  const container = document.getElementById('header-user-area');
  if (!container) return;

  const tgUrl = window.AppState?.settings?.telegram_link || 'https://t.me/pwsensei_official';

  container.innerHTML = `
    <a href="${tgUrl}" target="_blank" rel="noopener noreferrer" class="telegram-link-btn" style="display: flex; align-items: center; gap: 7px; padding: 7px 15px; background: rgba(56, 189, 248, 0.12); color: #0284C7; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 9999px; font-size: 13px; font-weight: 700; transition: all 0.2s ease;">
      ${window.TELEGRAM_LOGO_SVG}
      <span class="hide-mobile">Telegram</span>
    </a>
    <button class="theme-toggle-btn" onclick="window.toggleDarkMode()" title="Toggle Theme">
      🌙
    </button>
  `;
}

// Local Bookmarking / Saved Batches
window.isBatchSaved = function (batchId) {
  const saved = JSON.parse(localStorage.getItem('pwsensei_saved_batches') || '[]');
  return saved.includes(Number(batchId));
};

window.saveBatchLocally = function (batchId) {
  const numId = Number(batchId);
  let saved = JSON.parse(localStorage.getItem('pwsensei_saved_batches') || '[]');
  if (!saved.includes(numId)) {
    saved.push(numId);
    localStorage.setItem('pwsensei_saved_batches', JSON.stringify(saved));
    window.AppState.savedBatches = saved;
  }
};

window.removeSavedBatchLocally = function (batchId) {
  const numId = Number(batchId);
  let saved = JSON.parse(localStorage.getItem('pwsensei_saved_batches') || '[]');
  saved = saved.filter(id => id !== numId);
  localStorage.setItem('pwsensei_saved_batches', JSON.stringify(saved));
  window.AppState.savedBatches = saved;
};

// Batch Enrollment / Bookmark Action (Open to all visitors)
window.enrollInBatch = function (event, batchId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  saveBatchLocally(batchId);
  showToast('Batch added to My Batches!', 'success');

  const btn = document.getElementById(`enroll-btn-${batchId}`);
  if (btn) {
    btn.className = 'btn-unenroll';
    btn.textContent = 'Saved ⭐';
    btn.onclick = (e) => unenrollFromBatch(e, batchId);
  }
};

// Batch Unenroll / Remove Action
window.unenrollFromBatch = function (event, batchId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  removeSavedBatchLocally(batchId);
  showToast('Removed from My Batches', 'success');

  const card = document.getElementById(`batch-card-${batchId}`);
  if (card && window.location.pathname.includes('mybatches')) {
    card.remove();
    const grid = document.getElementById('my-batches-grid');
    if (grid && grid.children.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">You have no saved batches. <a href="/study.html" style="color: var(--primary); font-weight: bold; margin-left: 6px;">Browse All Batches</a></div>';
    }
  } else {
    const btn = document.getElementById(`enroll-btn-${batchId}`);
    if (btn) {
      btn.className = 'btn-enroll';
      btn.textContent = 'Enroll Free';
      btn.onclick = (e) => enrollInBatch(e, batchId);
    }
  }
};

// Share Batch URL Helper
window.shareBatch = function () {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Batch link copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy link', 'error');
  });
};

// Banner Carousel Controller
window.initBannerCarousel = async function (mountElementId = 'promo-carousel-mount') {
  const container = document.getElementById(mountElementId);
  if (!container) return;

  try {
    const res = await fetch('/api/banners');
    const data = await res.json();
    const banners = data.banners || [];

    if (banners.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const interval = data.interval || 4000;
    const autoSlide = data.auto_slide !== false;
    let currentIndex = 0;
    let autoSlideTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;
    let isSwiping = false;

    // Render HTML structure
    container.innerHTML = `
      <div class="banner-carousel-wrapper" id="banner-carousel-wrapper">
        <div class="banner-carousel-container" id="banner-track-container">
          <div class="banner-carousel-track" id="banner-carousel-track">
            ${banners
              .map((b, idx) => {
                const isExternal = b.redirect_url && (b.redirect_url.startsWith('http://') || b.redirect_url.startsWith('https://') || b.redirect_url.startsWith('tg://'));
                const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
                const redirectHref = b.redirect_url || '#';
                const bgImage = b.image_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200';
                const badgeColor = b.badge_color || '#EF4444';

                return `
                  <a href="${redirectHref}" ${targetAttr} class="banner-slide" id="banner-slide-${idx}" style="background-image: url('${bgImage}');" draggable="false">
                    <div class="banner-slide-overlay"></div>
                    <div class="banner-slide-content">
                      ${b.badge_text ? `<span class="banner-badge" style="background: ${badgeColor}; color: #FFFFFF;">${b.badge_text}</span>` : ''}
                      <h2 class="banner-title">${b.title}</h2>
                      ${b.subtitle ? `<p class="banner-subtitle">${b.subtitle}</p>` : ''}
                      <div class="banner-cta-btn">
                        <span>Explore Now</span>
                        <span>&rarr;</span>
                      </div>
                    </div>
                  </a>
                `;
              })
              .join('')}
          </div>
        </div>

        ${
          banners.length > 1
            ? `
          <button class="banner-nav-btn banner-nav-prev" id="banner-btn-prev" aria-label="Previous Banner">&#10094;</button>
          <button class="banner-nav-btn banner-nav-next" id="banner-btn-next" aria-label="Next Banner">&#10095;</button>
          <div class="banner-indicators" id="banner-indicators">
            ${banners
              .map(
                (_, idx) => `
              <button class="banner-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="Go to banner ${idx + 1}"></button>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;

    if (banners.length <= 1) return; // No auto-slide needed if only 1 banner

    const track = document.getElementById('banner-carousel-track');
    const wrapper = document.getElementById('banner-carousel-wrapper');
    const dots = container.querySelectorAll('.banner-dot');
    const btnPrev = document.getElementById('banner-btn-prev');
    const btnNext = document.getElementById('banner-btn-next');
    const trackContainer = document.getElementById('banner-track-container');

    function updateCarouselPosition(animated = true) {
      if (track) {
        track.style.transition = animated ? 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
      }
      dots.forEach((dot, idx) => {
        if (idx === currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    function goToSlide(index) {
      currentIndex = (index + banners.length) % banners.length;
      updateCarouselPosition(true);
      resetAutoSlide();
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function startAutoSlide() {
      if (!autoSlide || banners.length <= 1) return;
      stopAutoSlide();
      autoSlideTimer = setInterval(() => {
        nextSlide();
      }, interval);
    }

    function stopAutoSlide() {
      if (autoSlideTimer) {
        clearInterval(autoSlideTimer);
        autoSlideTimer = null;
      }
    }

    function resetAutoSlide() {
      stopAutoSlide();
      startAutoSlide();
    }

    // Button Listeners
    if (btnPrev) {
      btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        prevSlide();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        nextSlide();
      });
    }

    // Dot Listeners
    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetIdx = parseInt(dot.getAttribute('data-index'), 10);
        goToSlide(targetIdx);
      });
    });

    // Pause on Hover (Desktop)
    if (wrapper) {
      wrapper.addEventListener('mouseenter', stopAutoSlide);
      wrapper.addEventListener('mouseleave', startAutoSlide);
    }

    // Touch & Swipe Support (Mobile & Touch Devices)
    if (trackContainer) {
      trackContainer.addEventListener(
        'touchstart',
        (e) => {
          stopAutoSlide();
          const touch = e.touches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          touchDeltaX = 0;
          isSwiping = true;
        },
        { passive: true }
      );

      trackContainer.addEventListener(
        'touchmove',
        (e) => {
          if (!isSwiping) return;
          const touch = e.touches[0];
          const currentDeltaX = touch.clientX - touchStartX;
          const currentDeltaY = touch.clientY - touchStartY;

          // If horizontal gesture is dominant, prevent vertical scroll jitter
          if (Math.abs(currentDeltaX) > Math.abs(currentDeltaY)) {
            touchDeltaX = currentDeltaX;
          }
        },
        { passive: true }
      );

      trackContainer.addEventListener('touchend', () => {
        if (!isSwiping) return;
        isSwiping = false;

        const threshold = 40; // minimum swipe distance in px
        if (touchDeltaX < -threshold) {
          nextSlide();
        } else if (touchDeltaX > threshold) {
          prevSlide();
        } else {
          updateCarouselPosition(true);
        }

        touchDeltaX = 0;
        startAutoSlide();
      });
    }

    // Handle Tab Visibility (Pause auto-sliding when tab is in background)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoSlide();
      } else {
        startAutoSlide();
      }
    });

    // Start auto slide initially
    startAutoSlide();
  } catch (err) {
    console.error('Failed to initialize promotional banner carousel:', err);
  }
};

// Modal Helper
window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
};

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(window.AppState.darkMode);
  loadSiteSettings();
  renderPublicHeader();
  window.initBannerCarousel();

  // Close modals on outside click
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
      }
    });
  });
});

