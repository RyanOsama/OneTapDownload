const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const COOKIES_FILE = process.env.COOKIES_PATH || path.join(__dirname, 'cookies.txt');

function getCommonYtDlpArgs() {
  const args = ['--no-warnings'];
  if (fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }
  return args;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Regex mappings for supported platforms
const PLATFORMS = {
  instagram: {
    name: 'Instagram',
    regex: /(instagram\.com|instagr\.am)\/(p|reel|tv|stories)\/([a-zA-Z0-9-_]+)/i,
    icon: 'instagram',
    placeholderTitle: 'Instagram Reels Video',
    mockAuthor: '@creative_explorer',
    mockThumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60'
  },
  snapchat: {
    name: 'Snapchat',
    regex: /(snapchat\.com)/i,
    icon: 'snapchat',
    placeholderTitle: 'Snapchat Spotlight Video',
    mockAuthor: '@snap_vibes',
    mockThumbnail: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=500&auto=format&fit=crop&q=60'
  },
  x: {
    name: 'X (Twitter)',
    regex: /(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i,
    icon: 'twitter',
    placeholderTitle: 'X Post Video Update',
    mockAuthor: '@tech_insights',
    mockThumbnail: 'https://images.unsplash.com/photo-1611605698335-8b15d27e03f9?w=500&auto=format&fit=crop&q=60'
  },
  youtube: {
    name: 'YouTube',
    regex: /(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i,
    icon: 'youtube',
    placeholderTitle: 'YouTube Video & Audio Track',
    mockAuthor: 'Prime Creator Studio',
    mockThumbnail: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=500&auto=format&fit=crop&q=60'
  },
  facebook: {
    name: 'Facebook',
    regex: /(facebook\.com|fb\.watch|fb\.com)\/(.*)\/(videos|posts|reels|watch)?/i,
    icon: 'facebook',
    placeholderTitle: 'Facebook Shared Clip',
    mockAuthor: 'Social Network Connect',
    mockThumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&auto=format&fit=crop&q=60'
  },
  tiktok: {
    name: 'TikTok',
    regex: /(tiktok\.com|vm\.tiktok\.com)/i,
    icon: 'tiktok',
    placeholderTitle: 'TikTok Video',
    mockAuthor: '@tiktok_creator',
    mockThumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop&q=60'
  }
};

// Helper to format bytes to readable size
function formatSize(bytes) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return null;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Fast async media probe to get Content-Length / Content-Type
async function probeMediaUrl(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return { size: null, contentType: null };
  let target = mediaUrl;
  if (target.startsWith('/api/download?url=')) {
    try {
      const parsed = new URL('http://localhost' + target);
      target = parsed.searchParams.get('url') || target;
    } catch (e) {}
  }
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    return { size: null, contentType: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    let res = await fetch(target, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    let contentType = res.headers.get('content-type') || '';
    let length = res.headers.get('content-length');

    if (!length || length === '0') {
      const rangeController = new AbortController();
      const rangeTimeout = setTimeout(() => rangeController.abort(), 3000);
      res = await fetch(target, {
        headers: {
          'Range': 'bytes=0-0',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: rangeController.signal
      });
      clearTimeout(rangeTimeout);
      contentType = res.headers.get('content-type') || contentType;
      const contentRange = res.headers.get('content-range');
      if (contentRange) {
        const total = contentRange.split('/')[1];
        if (total && !isNaN(total)) length = total;
      }
    }

    let size = null;
    if (length && !isNaN(length)) {
      size = formatSize(parseInt(length, 10));
    }

    return { size, contentType };
  } catch (e) {
    return { size: null, contentType: null };
  }
}

// API Endpoint to analyze URL and fetch metadata
app.post('/api/extract', async (req, res) => {
  let { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Please enter a valid link.' });
  }

  url = url.trim();

  // Detect matching platform
  let matchedPlatformKey = null;
  let matches = null;

  for (const [key, platform] of Object.entries(PLATFORMS)) {
    const match = url.match(platform.regex);
    if (match) {
      matchedPlatformKey = key;
      matches = match;
      break;
    }
  }

  if (!matchedPlatformKey) {
    return res.status(400).json({
      error: 'Unsupported platform or invalid link. Please verify the URL.'
    });
  }

  const platformInfo = PLATFORMS[matchedPlatformKey];
  const { execFile } = require('child_process');
  const path = require('path');
  const isWindows = process.platform === 'win32';

  // Dedicated high-performance extractor for Instagram (Photos, Multi-photo Carousel, Reels, Stories)
  if (matchedPlatformKey === 'instagram') {
    const pythonExe = isWindows ? 'python' : 'python3';
    const helperScript = path.join(__dirname, 'instagram_helper.py');
    if (fs.existsSync(helperScript)) {
      try {
        const igData = await new Promise((resolve) => {
          execFile(pythonExe, [helperScript, url], { maxBuffer: 15 * 1024 * 1024, timeout: 12000 }, (err, stdout) => {
            if (!err && stdout) {
              try {
                const parsed = JSON.parse(stdout.trim());
                if (parsed.items && parsed.items.length > 0) {
                  return resolve(parsed);
                }
              } catch (e) {}
            }
            resolve(null);
          });
        });

        if (igData && igData.items && igData.items.length > 0) {
          return res.json(igData);
        }
      } catch (igErr) {
        console.warn('Instagram helper error:', igErr.message);
      }
    }
  }

  const ytDlpPath = isWindows ? path.join(__dirname, 'yt-dlp.exe') : (fs.existsSync('/usr/local/bin/yt-dlp') ? '/usr/local/bin/yt-dlp' : (fs.existsSync(path.join(__dirname, 'yt-dlp')) ? path.join(__dirname, 'yt-dlp') : 'yt-dlp'));

  // If Instagram Story URL, extract story username to fetch full story collection
  let isInstagramStory = false;
  let storyUsername = '';
  let targetUrl = url;

  if (matchedPlatformKey === 'instagram') {
    const storyMatch = url.match(/(?:instagram\.com|instagr\.am)\/stories\/([a-zA-Z0-9._]+)/i);
    if (storyMatch) {
      isInstagramStory = true;
      storyUsername = storyMatch[1];
      // Normalize story URL to fetch all user stories
      targetUrl = `https://www.instagram.com/stories/${storyUsername}/`;
    }
  }

  const ytDlpArgs = [
    '-j',
    ...getCommonYtDlpArgs()
  ];
  
  // YouTube requires EJS challenge resolver for signature checks
  if (matchedPlatformKey === 'youtube') {
    ytDlpArgs.push('--remote-components', 'ejs:github');
  }
  
  ytDlpArgs.push(targetUrl);

  execFile(ytDlpPath, ytDlpArgs, { maxBuffer: 15 * 1024 * 1024 }, async (error, stdout, stderr) => {
    if (error) {
      console.warn('yt-dlp failed:', error.message);
      
      // Special case for TikTok using TikWM API for better metadata
      if (matchedPlatformKey === 'tiktok') {
        try {
          const tikRes = await fetch('https://www.tikwm.com/api/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ url: url, hd: 1 })
          });
          const tikData = await tikRes.json();
          if (tikData && tikData.code === 0 && tikData.data) {
            const playUrl = tikData.data.play || tikData.data.wmplay;
            const probe = await probeMediaUrl(playUrl);
            return res.json({
              items: [{
                platform: 'tiktok',
                platformName: platformInfo.name,
                title: tikData.data.title || platformInfo.placeholderTitle,
                author: tikData.data.author?.nickname || platformInfo.mockAuthor,
                thumbnail: tikData.data.cover || platformInfo.mockThumbnail,
                duration: tikData.data.duration ? `${Math.floor(tikData.data.duration / 60)}:${(tikData.data.duration % 60).toString().padStart(2, '0')}` : '0:00',
                downloads: [{
                  labelAr: 'تحميل مباشر (MP4 - متوافق)',
                  labelEn: 'Direct Download (MP4 - Compatible)',
                  quality: 'HD',
                  size: probe.size || '—',
                  url: playUrl,
                  type: 'video'
                },
                {
                  labelAr: 'صوت فقط (MP3)',
                  labelEn: 'Audio Only (MP3)',
                  quality: '128kbps',
                  size: '—',
                  url: tikData.data.music,
                  type: 'audio'
                }]
              }]
            });
          }
        } catch (tikErr) {
          console.error('TikWM API failed:', tikErr);
        }
      }

      // Fallback to Cobalt and public APIs for platforms that block yt-dlp (e.g. Instagram login walls)
      try {
        const cobaltInstances = [
          'https://cobalt.q0.uk/',
          'https://co.eepy.today/',
          'https://api.cobalt.tools/',
          'https://api.vkrdownloader.co.in/api?vkr='
        ];

        for (const instance of cobaltInstances) {
          try {
            if (instance.includes('vkrdownloader')) {
              const vkrRes = await fetch(instance + encodeURIComponent(url));
              const vkrData = await vkrRes.json();
              if (vkrData && vkrData.data && vkrData.data.downloads && vkrData.data.downloads.length > 0) {
                 const downloadUrl = vkrData.data.downloads[0].url;
                 const probe = await probeMediaUrl(downloadUrl);
                 const isImg = probe.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)/i.test(downloadUrl);
                 return res.json({
                   items: [{
                     platform: matchedPlatformKey,
                     platformName: platformInfo.name,
                     title: isInstagramStory ? `ستوري @${storyUsername}` : platformInfo.placeholderTitle,
                     author: storyUsername ? `@${storyUsername}` : platformInfo.mockAuthor,
                     thumbnail: vkrData.data.thumbnail || platformInfo.mockThumbnail,
                     duration: isImg ? 'صورة' : 'فيديو HD',
                     downloads: [{
                       labelAr: isImg ? 'تحميل الصورة (HD)' : 'تحميل مباشر (MP4)',
                       labelEn: isImg ? 'Download Photo (HD)' : 'Direct Download (MP4)',
                       quality: 'HD',
                       size: probe.size || 'HD',
                       url: downloadUrl,
                       type: isImg ? 'image' : 'video'
                     }]
                   }]
                 });
              }
            } else {
              const cobaltRes = await fetch(instance, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Origin': 'https://cobalt.tools',
                  'Referer': 'https://cobalt.tools/'
                },
                body: JSON.stringify({ url: url })
              });
              
              const cobaltText = await cobaltRes.text();
              const cobaltData = JSON.parse(cobaltText);

              // Handle Cobalt Picker (Multiple photos / Carousel / Stories)
              if (cobaltData && cobaltData.picker && Array.isArray(cobaltData.picker)) {
                const multiItems = [];
                for (let i = 0; i < cobaltData.picker.length; i++) {
                  const p = cobaltData.picker[i];
                  const isPhoto = p.type === 'photo';
                  const pUrl = p.url;
                  const probe = await probeMediaUrl(pUrl);
                  
                  multiItems.push({
                    platform: matchedPlatformKey,
                    platformName: platformInfo.name,
                    title: isInstagramStory ? `ستوري @${storyUsername} (${i + 1}/${cobaltData.picker.length})` : `${platformInfo.placeholderTitle} (${i + 1})`,
                    author: storyUsername ? `@${storyUsername}` : platformInfo.mockAuthor,
                    thumbnail: p.thumb || pUrl,
                    duration: isPhoto ? 'صورة' : 'فيديو HD',
                    downloads: [{
                      labelAr: isPhoto ? 'تحميل الصورة الأصلية (HD)' : 'تحميل الفيديو (MP4)',
                      labelEn: isPhoto ? 'Download Original Photo (HD)' : 'Download Video (MP4)',
                      quality: 'HD',
                      size: probe.size || 'HD',
                      url: pUrl,
                      type: isPhoto ? 'image' : 'video'
                    }]
                  });
                }
                if (multiItems.length > 0) {
                  return res.json({ items: multiItems });
                }
              }

              // Handle Cobalt single item
              const downloadUrl = cobaltData.url || (cobaltData.status === 'redirect' ? cobaltData.url : null);
              if (downloadUrl) {
                const probe = await probeMediaUrl(downloadUrl);
                const isImg = probe.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)/i.test(downloadUrl);
                return res.json({
                  items: [{
                    platform: matchedPlatformKey,
                    platformName: platformInfo.name,
                    title: isInstagramStory ? `ستوري @${storyUsername}` : platformInfo.placeholderTitle,
                    author: storyUsername ? `@${storyUsername}` : platformInfo.mockAuthor,
                    thumbnail: platformInfo.mockThumbnail,
                    duration: isImg ? 'صورة' : 'فيديو HD',
                    downloads: [{
                      labelAr: isImg ? 'تحميل الصورة الأصلية (HD)' : 'تحميل مباشر (MP4)',
                      labelEn: isImg ? 'Download Original Photo (HD)' : 'Direct Download (MP4)',
                      quality: 'HD',
                      size: probe.size || 'HD',
                      url: downloadUrl,
                      type: isImg ? 'image' : 'video'
                    }]
                  }]
                });
              }
            }
          } catch (reqErr) {
            console.error(`Fallback API ${instance} failed:`, reqErr.message);
          }
        }
      } catch (fallbackError) {
        console.error('Fallback system failed:', fallbackError);
      }

      const errMsg = stderr ? stderr.toString().slice(0, 300) : error.message;
      // Detect common error types and give a helpful Arabic/English message
      let friendlyError = 'تعذّر استخراج المحتوى. تأكد من أن الرابط صحيح وأن المنشور أو الستوري متاح للعامة.';
      if (/rate-limit|rate limit|login required|checkpoint/i.test(errMsg)) {
        friendlyError = 'إنستغرام يفرض قيوداً مؤقتة على الوصول (Rate Limit). يرجى المحاولة بعد قليل أو التأكد من توفر المحتوى.';
      } else if (/Private|private|sign in|empty media response/i.test(errMsg)) {
        friendlyError = 'هذا المحتوى خاص أو يتطلب تسجيل دخول. يرجى التحقق من إعدادات الخصوصية.';
      } else if (/not available|unavailable|removed|deleted/i.test(errMsg)) {
        friendlyError = 'المحتوى غير متاح أو تم حذفه أو انتهت صلاحية الستوري (24 ساعة).';
      } else if (/unsupported/i.test(errMsg)) {
        friendlyError = 'هذا النوع من الروابط غير مدعوم حالياً.';
      }
      return res.status(422).json({ error: friendlyError });
    }

    try {
      const lines = stdout.trim().split('\n');
      const items = [];
      
      function formatDuration(seconds, isImage = false) {
        if (isImage) return 'صورة';
        if (!seconds || seconds <= 0) return 'فيديو HD';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      for (let itemIdx = 0; itemIdx < lines.length; itemIdx++) {
        const line = lines[itemIdx];
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          const formats = data.formats || [];
          
          // Check if this entry is a pure Image post/slide
          const isPureImage = (data.ext === 'jpg' || data.ext === 'jpeg' || data.ext === 'png' || data.ext === 'webp' || (!data.duration && formats.length > 0 && formats.every(f => f.vcodec === 'none' && f.acodec === 'none')) || (!data.formats && data.thumbnail));

          if (isPureImage) {
            const cleanTitle = (data.title || (isInstagramStory ? `ستوري @${storyUsername} (${itemIdx + 1})` : platformInfo.placeholderTitle)).replace(/[\\/*?:"<>|]/g, '');
            const imgUrl = data.url || data.thumbnail || (formats.length > 0 ? formats[formats.length - 1].url : null);
            
            if (imgUrl) {
              const probe = await probeMediaUrl(imgUrl);
              const cleanFilename = `${cleanTitle}.jpg`;
              const downloadUrl = `/api/download?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
              
              items.push({
                platform: matchedPlatformKey,
                platformName: platformInfo.name,
                title: isInstagramStory ? `ستوري @${storyUsername} (${itemIdx + 1}/${lines.length})` : (data.title || `${platformInfo.placeholderTitle} - صورة`),
                author: data.uploader || data.channel || (storyUsername ? `@${storyUsername}` : platformInfo.mockAuthor),
                thumbnail: imgUrl,
                duration: 'صورة',
                downloads: [{
                  labelAr: 'تحميل الصورة الأصلية (HD JPG)',
                  labelEn: 'Download Original Photo (HD JPG)',
                  quality: 'Full HD',
                  size: probe.size || 'HD',
                  url: downloadUrl,
                  type: 'image'
                }]
              });
            }
            continue;
          }

          // Process Video Formats
          let audioFormats = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.url);
          audioFormats.sort((a, b) => {
            const aIsAac = (a.acodec || '').includes('mp4a') || (a.acodec || '').includes('aac') || a.ext === 'm4a';
            const bIsAac = (b.acodec || '').includes('mp4a') || (b.acodec || '').includes('aac') || b.ext === 'm4a';
            if (aIsAac && !bIsAac) return -1;
            if (!aIsAac && bIsAac) return 1;
            return (b.abr || 0) - (a.abr || 0);
          });
          const bestAudio = audioFormats.length > 0 ? audioFormats[0] : null;

          const formatsByHeight = {};
          let formatsToProcess = data.formats || [];
          if (formatsToProcess.length === 0 && data.url) {
            formatsToProcess = [data];
          }

          for (const f of formatsToProcess) {
            if (f.vcodec !== 'none' && f.url) {
              const h = f.height || f.width || 720;
              const hasAudio = f.acodec && f.acodec !== 'none' && f.acodec !== 'null';
              f.format_id = f.format_id || 'best';
              f.height = h;
              
              if (!formatsByHeight[h]) {
                formatsByHeight[h] = f;
              } else {
                const existing = formatsByHeight[h];
                const isAvc = (f.vcodec || '').toLowerCase().startsWith('avc') || (f.vcodec || '').toLowerCase().startsWith('h264');
                const existingIsAvc = (existing.vcodec || '').toLowerCase().startsWith('avc') || (existing.vcodec || '').toLowerCase().startsWith('h264');
                
                // Prioritize H.264 (avc1) for universal mobile & web playback
                if (isAvc && !existingIsAvc) {
                  formatsByHeight[h] = f;
                } else if (!isAvc && existingIsAvc) {
                  // Keep existing H.264 format
                } else {
                  const existingHasAudio = existing.acodec && existing.acodec !== 'none' && existing.acodec !== 'null';
                  if (hasAudio && !existingHasAudio) {
                    formatsByHeight[h] = f;
                  } else if (hasAudio === existingHasAudio) {
                    const currentSize = f.filesize || f.filesize_approx || 0;
                    const existingSize = existing.filesize || existing.filesize_approx || 0;
                    if (currentSize > existingSize) {
                      formatsByHeight[h] = f;
                    }
                  }
                }
              }
            }
          }

          if (Object.keys(formatsByHeight).length === 0 && data.url) {
            const fallbackHeight = data.height || 720;
            formatsByHeight[fallbackHeight] = { height: fallbackHeight, url: data.url, format_id: data.format_id || 'best', vcodec: data.vcodec || 'unknown', acodec: data.acodec || 'unknown', filesize: data.filesize || data.filesize_approx };
          }

          const videoDuration = data.duration || 0;
          function estimateSize(format, extraAudioFormat) {
            let bytes = format.filesize || format.filesize_approx || 0;
            if (extraAudioFormat) bytes += (extraAudioFormat.filesize || extraAudioFormat.filesize_approx || 0);
            if (bytes > 0) return { size: formatSize(bytes), approx: false };
            if (videoDuration > 0) {
              const vBitrate = format.tbr || format.vbr || 0;
              const aBitrate = extraAudioFormat ? (extraAudioFormat.tbr || extraAudioFormat.abr || 0) : (format.abr || 0);
              const totalKbps = vBitrate + aBitrate;
              if (totalKbps > 0) {
                const estimatedBytes = (totalKbps * 1000 / 8) * videoDuration;
                return { size: `~${formatSize(estimatedBytes)}`, approx: true };
              }
            }
            return { size: null, approx: false };
          }

          const uniqueVideoFormats = Object.values(formatsByHeight).sort((a, b) => b.height - a.height);
          const downloads = [];

          for (const vf of uniqueVideoFormats) {
            const height = vf.height;
            const hasAudio = vf.acodec && vf.acodec !== 'none' && vf.acodec !== 'null';
            let labelAr = height < 480 ? 'فيديو منخفض الدقة (MP4)' : height < 720 ? 'فيديو متوسط الدقة (MP4)' : 'فيديو عالي الدقة (MP4)';
            let labelEn = height < 480 ? 'Low Quality Video (MP4)' : height < 720 ? 'SD Video (MP4)' : 'HD Video (MP4)';
            const cleanTitle = (data.title || (isInstagramStory ? `ستوري @${storyUsername}` : platformInfo.placeholderTitle)).replace(/[\\/*?:"<>|]/g, '');
            const cleanFilename = `${cleanTitle}_${height}p.mp4`;
            
            let downloadUrl;
            const itemUrl = data.webpage_url || url;
            
            if (!hasAudio && bestAudio) {
               const formatId = `${vf.format_id}+${bestAudio.format_id}`;
               downloadUrl = `/api/download_local?url=${encodeURIComponent(itemUrl)}&format_id=${encodeURIComponent(formatId)}&filename=${encodeURIComponent(cleanFilename)}`;
            } else {
               downloadUrl = `/api/download?url=${encodeURIComponent(vf.url)}&filename=${encodeURIComponent(cleanFilename)}`;
            }

            let { size: sizeLabel } = estimateSize(vf, !hasAudio && bestAudio ? bestAudio : null);
            
            // If size is still missing, probe the direct URL asynchronously
            if (!sizeLabel && vf.url) {
              const probe = await probeMediaUrl(vf.url);
              if (probe.size) sizeLabel = probe.size;
            }

            downloads.push({ labelAr, labelEn, quality: `${height}p`, size: sizeLabel || 'HD', url: downloadUrl, type: 'video' });
          }

          if (bestAudio) {
            const cleanTitle = (data.title || (isInstagramStory ? `ستوري @${storyUsername}` : platformInfo.placeholderTitle)).replace(/[\\/*?:"<>|]/g, '');
            const itemUrl = data.webpage_url || url;
            const cleanFilenameAudio = `${cleanTitle}.mp3`;
            let { size: audioSizeLabel } = estimateSize(bestAudio, null);
            if (!audioSizeLabel && bestAudio.url) {
              const probe = await probeMediaUrl(bestAudio.url);
              if (probe.size) audioSizeLabel = probe.size;
            }
            downloads.push({
              labelAr: 'صوت فقط (MP3)', labelEn: 'Audio Only (MP3)',
              quality: bestAudio.abr ? `${Math.round(bestAudio.abr)}kbps` : '128kbps', size: audioSizeLabel || '—',
              url: `/api/download_local?url=${encodeURIComponent(itemUrl)}&format_id=${encodeURIComponent(bestAudio.format_id)}&filename=${encodeURIComponent(cleanFilenameAudio)}&is_audio=true`,
              type: 'audio'
            });
          }

          items.push({
            platform: matchedPlatformKey,
            platformName: platformInfo.name,
            title: isInstagramStory ? `ستوري @${storyUsername} (${itemIdx + 1}/${lines.length})` : (data.title || platformInfo.placeholderTitle),
            author: data.uploader || data.channel || (storyUsername ? `@${storyUsername}` : platformInfo.mockAuthor),
            thumbnail: data.thumbnail || platformInfo.mockThumbnail,
            duration: formatDuration(data.duration, false),
            downloads: downloads
          });
        } catch (e) {
          console.warn('Failed to parse one of the json lines:', e);
        }
      }

      if (items.length === 0) {
         throw new Error('No valid items found');
      }

      res.json({ items });
    } catch (e) {
      console.warn('Failed to parse yt-dlp response:', e);
      return res.status(422).json({ error: 'فشل في قراءة بيانات الوسائط. قد يكون الرابط غير مدعوم أو منتهي الصلاحية.' });
    }
  });
});

app.get('/api/download_local', (req, res) => {
  const { url, format_id, filename, is_audio } = req.query;
  if (!url || !format_id) return res.status(400).send('URL and format_id are required');

  const cleanFilename = filename || 'download.mp4';
  const fs = require('fs');
  const tempDir = path.join(os.tmpdir(), 'onetap_downloads');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempId = Date.now() + '_' + Math.floor(Math.random() * 10000);
  const ext = is_audio === 'true' ? 'mp3' : 'mp4';
  const outputPath = path.join(tempDir, `${tempId}.${ext}`);

  const ffmpegStatic = require('ffmpeg-static');
  
  const ytDlpPath = process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : (fs.existsSync('/usr/local/bin/yt-dlp') ? '/usr/local/bin/yt-dlp' : (fs.existsSync(path.join(__dirname, 'yt-dlp')) ? path.join(__dirname, 'yt-dlp') : 'yt-dlp'));
  
  const ytDlpArgs = [
    ...getCommonYtDlpArgs(),
    '--ffmpeg-location', ffmpegStatic,
    '-f', format_id,
    '-o', outputPath
  ];

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    ytDlpArgs.push('--remote-components', 'ejs:github');
  }

  if (is_audio === 'true') {
    ytDlpArgs.push('-x', '--audio-format', 'mp3');
  } else {
    ytDlpArgs.push('--merge-output-format', 'mp4', '--postprocessor-args', 'ffmpeg:-c:a aac -movflags +faststart');
  }

  ytDlpArgs.push(url);

  const { spawn } = require('child_process');
  console.log('Spawning yt-dlp local download:', ytDlpArgs.join(' '));
  
  const ytProcess = spawn(ytDlpPath, ytDlpArgs);

  let stderrOutput = '';
  ytProcess.stderr.on('data', (data) => {
    stderrOutput += data.toString();
    console.error('yt-dlp stderr:', data.toString());
  });

  ytProcess.on('close', (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      res.download(outputPath, cleanFilename, (err) => {
        // Delete after sending
        try { fs.unlinkSync(outputPath); } catch (e) {}
      });
    } else {
      console.error('yt-dlp local download failed with code', code);
      if (!res.headersSent) {
        res.status(500).send(`Download failed.<br><br>Error details:<br><pre>${stderrOutput}</pre>`);
      }
    }
  });
});

app.get('/api/download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send('URL is required');

  try {
    const fetchFn = globalThis.fetch;
    const response = await fetchFn(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36)',
        'Referer': 'https://www.tiktok.com/' // Sometimes needed for tiktokcdn URLs
      }
    });

    if (!response.ok) {
      return res.status(500).send('Failed to fetch file from remote server');
    }

    const safeFilename = encodeURIComponent(filename || 'download.mp4');
    res.setHeader('Content-Disposition', `attachment; filename="download.mp4"; filename*=UTF-8''${safeFilename}`);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    
    if (response.body) {
      if (response.body.pipe) {
        // Node-fetch stream
        response.body.pipe(res);
      } else {
        // Native web stream (Node 18+)
        const { Readable } = require('stream');
        Readable.fromWeb(response.body).pipe(res);
      }
    } else {
       res.status(500).send('Empty body from server');
    }
  } catch (error) {
    console.error('Proxy download failed:', error);
    res.status(500).send('Proxy download error: ' + error.message);
  }
});

// Fallback to serve custom 404 page for any undefined routes
app.get('/*splat', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OneTapDownload running locally at: http://localhost:${PORT}`);
  
  // Get and print local network IP addresses
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        console.log(`Access on your local network: http://${alias.address}:${PORT}`);
      }
    }
  }
});
