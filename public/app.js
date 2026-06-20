// App State Management
const STATE = {
  currentLanguage: 'ar', // 'ar' or 'en'
  detectedPlatform: null,
  isAnalyzing: false,
  lastResultData: null,
  translations: {
    ar: {
      title: 'OneTapDownload - تحميل بضغطة واحدة من أي منصة',
      pasteError: 'عذراً، متصفحك يمنع الوصول التلقائي للحافظة. يرجى لصق الرابط يدوياً.',
      emptyUrlError: 'يرجى إدخال أو لصق رابط صالح أولاً.',
      invalidUrlError: 'الرابط غير مدعوم. يرجى إدخال رابط من المنصات المدعومة.',
      analyzingText: ['جاري قراءة الرابط...', 'جاري تحديد المنصة...', 'جاري جلب روابط التحميل...'],
      downloadingText: 'جاري التحميل...',
      downloadSuccess: 'تم التحميل!',
      btnPaste: 'لصق',
      btnClear: 'مسح'
    },
    en: {
      title: 'OneTapDownload - One Tap Media Downloader',
      pasteError: 'Sorry, your browser blocks clipboard access. Please paste the link manually.',
      emptyUrlError: 'Please enter or paste a valid link first.',
      invalidUrlError: 'Unsupported link. Please enter a URL from the supported platforms.',
      analyzingText: ['Reading URL...', 'Detecting platform...', 'Fetching download links...'],
      downloadingText: 'Downloading...',
      downloadSuccess: 'Downloaded!',
      btnPaste: 'Paste',
      btnClear: 'Clear'
    }
  }
};

// UI Elements
const urlInput = document.getElementById('url-input');
const pasteBtn = document.getElementById('paste-btn');
const clearBtn = document.getElementById('clear-btn');
const downloadBtn = document.getElementById('download-btn');
const platformBadge = document.getElementById('platform-badge');
const platformBadgeName = document.getElementById('platform-badge-name');
const platformsGrid = document.getElementById('platforms-grid');
const loadingState = document.getElementById('loading-state');
const loadingTitle = document.getElementById('loading-title');
const loadingSub = document.getElementById('loading-sub');
const analysisProgress = document.getElementById('analysis-progress');
const errorState = document.getElementById('error-state');
const errorMsg = document.getElementById('error-msg');
const resultCard = document.getElementById('result-card');
const langToggle = document.getElementById('lang-toggle');

// Platform icons configuration
const PLATFORM_ICONS = {
  instagram: 'fa-brands fa-instagram',
  snapchat: 'fa-brands fa-snapchat',
  x: 'fa-brands fa-x-twitter',
  telegram: 'fa-brands fa-telegram',
  youtube: 'fa-brands fa-youtube',
  facebook: 'fa-brands fa-facebook-f',
  tiktok: 'fa-brands fa-tiktok'
};

// Regex for platform checking (matching server.js)
const PLATFORM_REGEXES = {
  instagram: /(instagram\.com|instagr\.am)\/(p|reel|tv|stories)\/([a-zA-Z0-9-_]+)/i,
  snapchat: /(snapchat\.com|snap\.com)\/(add|story|spotlight)\/([a-zA-Z0-9-_.]+)/i,
  x: /(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i,
  telegram: /(t\.me|telegram\.me|telegram\.org)\/([a-zA-Z0-9_]+)\/([0-9]+)/i,
  youtube: /(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i,
  facebook: /(facebook\.com|fb\.watch|fb\.com)\/(.*)\/(videos|posts|reels|watch)?/i,
  tiktok: /(tiktok\.com)/i
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  // Set default view translations
  translateUI(STATE.currentLanguage);
});

// Event Listeners Setup
function setupEventListeners() {
  // Input tracking for live platform detection
  urlInput.addEventListener('input', handleUrlInput);

  // Paste action
  pasteBtn.addEventListener('click', handlePaste);

  // Clear action
  clearBtn.addEventListener('click', handleClear);

  // Download action
  downloadBtn.addEventListener('click', startAnalysis);

  // Platform cards click triggers input placeholder/help
  document.querySelectorAll('.platform-card').forEach(card => {
    card.addEventListener('click', () => {
      const platform = card.getAttribute('data-platform');
      let sampleUrl = '';
      switch (platform) {
        case 'youtube': sampleUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; break;
        case 'instagram': sampleUrl = 'https://www.instagram.com/reel/C-xyz123/'; break;
        case 'x': sampleUrl = 'https://x.com/tech/status/1234567890'; break;
        case 'snapchat': sampleUrl = 'https://www.snapchat.com/spotlight/W7tDg5...'; break;
        case 'telegram': sampleUrl = 'https://t.me/durov/214'; break;
        case 'facebook': sampleUrl = 'https://www.facebook.com/watch/?v=123456'; break;
        case 'tiktok': sampleUrl = 'https://www.tiktok.com/@khaby.lame/video/7033526978453474566'; break;
      }
      urlInput.value = sampleUrl;
      handleUrlInput();
      urlInput.focus();
    });
  });

  // Language toggle click
  langToggle.addEventListener('click', toggleLanguage);
}

// Live URL Input detection
function handleUrlInput() {
  const value = urlInput.value.trim();

  // Show/Hide clear button
  if (value.length > 0) {
    clearBtn.style.display = 'flex';
  } else {
    clearBtn.style.display = 'none';
    resetPlatformBadge();
    return;
  }

  // Detect platform
  let matchedPlatform = null;
  for (const [platform, regex] of Object.entries(PLATFORM_REGEXES)) {
    if (value.match(regex)) {
      matchedPlatform = platform;
      break;
    }
  }

  if (matchedPlatform) {
    setDetectedPlatform(matchedPlatform);
  } else {
    resetPlatformBadge();
  }
}

// Set active platform states
function setDetectedPlatform(platform) {
  STATE.detectedPlatform = platform;
  
  // Update floating badge inside input
  platformBadge.style.display = 'flex';
  platformBadge.className = `platform-indicator ${platform}`;
  platformBadge.querySelector('i').className = PLATFORM_ICONS[platform];
  
  // Set badge label
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  platformBadgeName.innerText = platform === 'x' ? 'X (Twitter)' : label;

  // Highlight platform card in the grid
  platformsGrid.classList.add('has-active');
  document.querySelectorAll('.platform-card').forEach(card => {
    if (card.getAttribute('data-platform') === platform) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

// Reset platform detection states
function resetPlatformBadge() {
  STATE.detectedPlatform = null;
  platformBadge.style.display = 'none';
  platformsGrid.classList.remove('has-active');
  document.querySelectorAll('.platform-card').forEach(card => {
    card.classList.remove('active');
  });
}

// Paste Action
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text;
      handleUrlInput();
      // Add a quick pulse animation to the input wrapper to show it succeeded
      const wrapper = document.querySelector('.downloader-input-wrapper');
      wrapper.style.transform = 'scale(1.02)';
      setTimeout(() => wrapper.style.transform = 'none', 150);
    }
  } catch (err) {
    console.error('Failed to read clipboard: ', err);
    showError(STATE.translations[STATE.currentLanguage].pasteError);
  }
}

// Clear Action
function handleClear() {
  urlInput.value = '';
  clearBtn.style.display = 'none';
  resetPlatformBadge();
  hideResult();
  hideError();
  urlInput.focus();
}

// Start URL Parsing / Extract
async function startAnalysis() {
  const url = urlInput.value.trim();

  if (!url) {
    showError(STATE.translations[STATE.currentLanguage].emptyUrlError);
    return;
  }

  // Frontend check if valid platform
  let isSupported = false;
  for (const regex of Object.values(PLATFORM_REGEXES)) {
    if (url.match(regex)) {
      isSupported = true;
      break;
    }
  }

  if (!isSupported) {
    showError(STATE.translations[STATE.currentLanguage].invalidUrlError);
    return;
  }



  // Reset states
  hideError();
  hideResult();
  showLoading();

  try {
    // Fake loading steps for premium UX feel
    await animateLoadingProgress();

    // Call actual backend API
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Server error occurred');
    }

    hideLoading();
    showResult(data);

  } catch (error) {
    hideLoading();
    showError(error.message);
  }
}

// Animate Progress Bar and Titles
function animateLoadingProgress() {
  return new Promise((resolve) => {
    STATE.isAnalyzing = true;
    let progress = 0;
    const texts = STATE.translations[STATE.currentLanguage].analyzingText;
    
    // Change subtext at intervals
    loadingTitle.innerText = texts[0];
    
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(resolve, 300);
      }
      
      // Update texts depending on progress percentage
      if (progress > 35 && progress < 70) {
        loadingTitle.innerText = texts[1];
      } else if (progress >= 70) {
        loadingTitle.innerText = texts[2];
      }
      
      analysisProgress.style.width = `${progress}%`;
    }, 100);
  });
}

// Display extraction results
function showResult(data) {
  STATE.lastResultData = data;
  
  // Set basic data
  document.getElementById('result-title').innerText = data.title;
  document.getElementById('result-author').innerText = data.author;
  document.getElementById('result-thumb').src = data.thumbnail;
  document.getElementById('result-duration').innerText = data.duration;

  // Platform badge in result card
  const badge = document.getElementById('result-platform');
  badge.className = `result-platform-badge ${data.platform}`;
  badge.querySelector('i').className = PLATFORM_ICONS[data.platform];
  document.getElementById('result-platform-text').innerText = data.platformName;

  // Render options
  renderDownloadOptions(data.downloads);

  resultCard.style.display = 'block';
  // Scroll to results smoothly
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Render the download options list dynamically
function renderDownloadOptions(downloads) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  downloads.forEach(dl => {
    const item = document.createElement('div');
    item.className = 'download-item';

    const isVideo = dl.type === 'video';
    const typeIconClass = isVideo ? 'fa-solid fa-video' : 'fa-solid fa-music';
    const typeColorClass = isVideo ? 'video' : 'audio';

    const details = document.createElement('div');
    details.className = 'download-item-details';
    
    // Choose correct bilingual label
    const label = STATE.currentLanguage === 'ar' ? dl.labelAr : dl.labelEn;

    details.innerHTML = `
      <div class="download-type-icon ${typeColorClass}">
        <i class="${typeIconClass}"></i>
      </div>
      <div class="download-label-info">
        <span class="download-label">${label}</span>
        <span class="download-size-badge">${dl.quality} • ${dl.size}</span>
      </div>
    `;

    const button = document.createElement('button');
    button.className = 'btn btn-secondary btn-sm btn-download-trigger';
    button.innerHTML = `<i class="fa-solid fa-download"></i> <span class="dl-btn-text"></span>`;
    
    // Set bilingual button label
    const dlBtnText = button.querySelector('.dl-btn-text');
    dlBtnText.innerText = STATE.currentLanguage === 'en' ? 'Download' : 'تحميل';

    // Attach Download action with Animation and Ad Gating
    button.addEventListener('click', () => {
      const cleanTitle = STATE.lastResultData ? STATE.lastResultData.title : 'download';
      const filename = `${cleanTitle.replace(/[^a-zA-Z0-9أ-ي]/g, '_')}_${dl.quality}.${isVideo ? 'mp4' : 'mp3'}`;
      
      showDownloadAdModal(() => {
        triggerFileDownload(button, dl.url, filename);
      });
    });

    item.appendChild(details);
    item.appendChild(button);
    container.appendChild(item);
  });
}

// Trigger browser download via Express proxy to force file downloads
function triggerFileDownload(button, url, filename) {
  const textSpan = button.querySelector('.dl-btn-text');
  const icon = button.querySelector('i');
  
  // Set downloading state
  button.classList.add('downloading');
  icon.className = 'fa-solid fa-spinner fa-spin';
  textSpan.innerText = STATE.translations[STATE.currentLanguage].downloadingText;

  // We request it via /api/download which forces attachment download
  let downloadUrl = url;
  if (!url.startsWith('/api/') && !url.startsWith('/')) {
    downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  }
  
  // Simple technique to start the download via iframe or dynamic link
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    // Reset button after download starts
    icon.className = 'fa-solid fa-circle-check';
    textSpan.innerText = STATE.translations[STATE.currentLanguage].downloadSuccess;
    

    
    setTimeout(() => {
      button.classList.remove('downloading');
      icon.className = 'fa-solid fa-download';
      textSpan.innerText = STATE.currentLanguage === 'en' ? 'Download' : 'تحميل';
    }, 2000);
  }, 1500);
}

// UI State Toggles
function showLoading() {
  loadingState.style.display = 'flex';
  analysisProgress.style.width = '0%';
  downloadBtn.setAttribute('disabled', 'true');
  downloadBtn.style.opacity = '0.7';
}

function hideLoading() {
  loadingState.style.display = 'none';
  downloadBtn.removeAttribute('disabled');
  downloadBtn.style.opacity = '1';
  STATE.isAnalyzing = false;
}

function hideResult() {
  resultCard.style.display = 'none';
  STATE.lastResultData = null;
}

// Error state display
function showError(message) {
  errorState.style.display = 'flex';
  errorMsg.innerText = message;
}

function hideError() {
  errorState.style.display = 'none';
}

// Language toggle helper
function toggleLanguage() {
  STATE.currentLanguage = STATE.currentLanguage === 'ar' ? 'en' : 'ar';
  translateUI(STATE.currentLanguage);
}

// Translate full UI text elements based on language
function translateUI(lang) {
  // Update HTML tag
  const htmlTag = document.documentElement;
  htmlTag.setAttribute('lang', lang);
  htmlTag.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

  // Update Page Title
  document.title = STATE.translations[lang].title;

  // Toggle Language button text
  const langLabel = document.getElementById('lang-label');
  langLabel.innerText = lang === 'ar' ? 'English' : 'العربية';

  // Translate all tags with data-ar and data-en
  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${lang}`);
    if (txt) el.innerText = txt;
  });

  // Translate placeholders
  const placeholder = urlInput.getAttribute(`data-placeholder-${lang}`);
  if (placeholder) urlInput.placeholder = placeholder;

  // Translate clear and paste actions tooltips
  const pasteTitle = pasteBtn.getAttribute(`data-title-${lang}`);
  if (pasteTitle) pasteBtn.title = pasteTitle;
  
  const pasteLabelText = pasteBtn.querySelector('.btn-text');
  if (pasteLabelText) pasteLabelText.innerText = STATE.translations[lang].btnPaste;

  // Update error message context if currently showing
  if (errorState.style.display === 'flex') {
    // If the error message is one of standard messages, translate it
    const prevMsg = errorMsg.innerText;
    const oppositeLang = lang === 'ar' ? 'en' : 'ar';
    
    for (const [key, val] of Object.entries(STATE.translations[oppositeLang])) {
      if (val === prevMsg && STATE.translations[lang][key]) {
        errorMsg.innerText = STATE.translations[lang][key];
        break;
      }
    }
  }

  // Update download options labels and button texts if results are shown
  if (resultCard.style.display === 'block' && STATE.lastResultData) {
    renderDownloadOptions(STATE.lastResultData.downloads);
  }
}

// Gating & Monetization (Ad Gating)
function showDownloadAdModal(onComplete) {
  const modal = document.getElementById('ad-modal');
  const timerEl = document.getElementById('ad-timer');
  const unlockBtn = document.getElementById('ad-unlock-btn');
  const unlockBtnText = document.getElementById('ad-unlock-btn-text');

  modal.style.display = 'flex';
  unlockBtn.disabled = true;

  // Open the Adsterra Smartlink in a new tab/window
  try {
    window.open('https://www.effectivecpmnetwork.com/ksw7tnygi?key=87a01910f49719dddf156a8a718d5891', '_blank');
  } catch (e) {
    console.warn('Popup blocked by browser, continuing countdown.');
  }

  let seconds = 10;
  timerEl.innerText = seconds;

  // Set initial button text based on language
  if (STATE.currentLanguage === 'ar') {
    unlockBtnText.innerText = `يرجى الانتظار (${seconds} ث)...`;
  } else {
    unlockBtnText.innerText = `Please Wait (${seconds}s)...`;
  }

  const interval = setInterval(() => {
    seconds--;
    timerEl.innerText = seconds;
    
    if (STATE.currentLanguage === 'ar') {
      unlockBtnText.innerText = `يرجى الانتظار (${seconds} ث)...`;
    } else {
      unlockBtnText.innerText = `Please Wait (${seconds}s)...`;
    }

    if (seconds <= 0) {
      clearInterval(interval);
      unlockBtn.disabled = false;
      
      if (STATE.currentLanguage === 'ar') {
        unlockBtnText.innerText = 'تحميل الملف الآن';
      } else {
        unlockBtnText.innerText = 'Download File Now';
      }
      
      // Auto-download or click to download
      const completeAction = () => {
        modal.style.display = 'none';
        onComplete();
      };
      
      unlockBtn.onclick = completeAction;
      
      // Auto-trigger download after 800ms of finishing countdown for smooth UX
      setTimeout(completeAction, 800);
    }
  }, 1000);
}
