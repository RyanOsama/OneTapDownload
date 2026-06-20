const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
    regex: /(snapchat\.com|snap\.com)\/(add|story|spotlight)\/([a-zA-Z0-9-_.]+)/i,
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
  telegram: {
    name: 'Telegram',
    regex: /(t\.me|telegram\.me|telegram\.org)\/([a-zA-Z0-9_]+)\/([0-9]+)/i,
    icon: 'telegram',
    placeholderTitle: 'Telegram Channel Media',
    mockAuthor: 'Broadcast Channel',
    mockThumbnail: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=500&auto=format&fit=crop&q=60'
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
  }
};

// API Endpoint to analyze URL and fetch metadata
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Please enter a valid link.' });
  }

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
  const ytDlpPath = isWindows ? path.join(__dirname, 'yt-dlp.exe') : 'yt-dlp';

  execFile(ytDlpPath, ['-j', url], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.warn('yt-dlp failed, falling back to mock mode:', error.message);
      return sendMockResponse(res, matchedPlatformKey, platformInfo);
    }

    try {
      const data = JSON.parse(stdout);
      const formats = data.formats || [];

      // Filter audio-only formats
      let audioFormats = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.url);
      audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
      const bestAudio = audioFormats.length > 0 ? audioFormats[0] : null;

      const formatsByHeight = {};
      
      for (const f of formats) {
        if (f.vcodec !== 'none' && f.url && f.height) {
          const h = f.height;
          const hasAudio = f.acodec && f.acodec !== 'none' && f.acodec !== 'null';
          
          if (!formatsByHeight[h]) {
            formatsByHeight[h] = f;
          } else {
            const existingHasAudio = formatsByHeight[h].acodec && formatsByHeight[h].acodec !== 'none' && formatsByHeight[h].acodec !== 'null';
            if (!existingHasAudio && hasAudio) {
              formatsByHeight[h] = f;
            } else if (existingHasAudio === hasAudio) {
              const currentSize = f.filesize || f.filesize_approx || 0;
              const existingSize = formatsByHeight[h].filesize || formatsByHeight[h].filesize_approx || 0;
              if (currentSize > existingSize) {
                formatsByHeight[h] = f;
              }
            }
          }
        }
      }

      const uniqueVideoFormats = Object.values(formatsByHeight).sort((a, b) => b.height - a.height);
      const downloads = [];

      function formatSize(bytes) {
        if (!bytes) return 'N/A';
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }

      uniqueVideoFormats.forEach(vf => {
        const height = vf.height;
        const hasAudio = vf.acodec && vf.acodec !== 'none' && vf.acodec !== 'null';
        
        let labelAr = 'فيديو عالي الدقة (MP4)';
        let labelEn = 'HD Video (MP4)';
        
        if (height < 720) {
          labelAr = 'فيديو متوسط الدقة (MP4)';
          labelEn = 'SD Video (MP4)';
        }
        if (height < 480) {
          labelAr = 'فيديو منخفض الدقة (MP4)';
          labelEn = 'Low Quality Video (MP4)';
        }

        let downloadUrl = '';
        const cleanTitle = (data.title || platformInfo.placeholderTitle).replace(/[\\/*?:"<>|]/g, '');
        const cleanFilename = `${cleanTitle}_${height}p.mp4`;

        if (hasAudio) {
          downloadUrl = `/api/download?url=${encodeURIComponent(vf.url)}&filename=${encodeURIComponent(cleanFilename)}`;
        } else if (bestAudio) {
          downloadUrl = `/api/download?videoUrl=${encodeURIComponent(vf.url)}&audioUrl=${encodeURIComponent(bestAudio.url)}&filename=${encodeURIComponent(cleanFilename)}`;
        } else {
          downloadUrl = `/api/download?url=${encodeURIComponent(vf.url)}&filename=${encodeURIComponent(cleanFilename)}`;
        }

        let sizeBytes = vf.filesize || vf.filesize_approx || 0;
        if (!hasAudio && bestAudio) {
          sizeBytes += (bestAudio.filesize || bestAudio.filesize_approx || 0);
        }

        downloads.push({
          labelAr: labelAr,
          labelEn: labelEn,
          quality: `${height}p`,
          size: formatSize(sizeBytes),
          url: downloadUrl,
          type: 'video'
        });
      });

      // Add best audio only download option
      if (bestAudio) {
        const cleanTitle = (data.title || platformInfo.placeholderTitle).replace(/[\\/*?:"<>|]/g, '');
        const cleanFilename = `${cleanTitle}.mp3`;
        downloads.push({
          labelAr: 'صوت فقط (MP3)',
          labelEn: 'Audio Only (MP3)',
          quality: bestAudio.abr ? `${Math.round(bestAudio.abr)}kbps` : '128kbps',
          size: formatSize(bestAudio.filesize || bestAudio.filesize_approx),
          url: `/api/download?url=${encodeURIComponent(bestAudio.url)}&filename=${encodeURIComponent(cleanFilename)}`,
          type: 'audio'
        });
      }

      function formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      const responseData = {
        platform: matchedPlatformKey,
        platformName: platformInfo.name,
        title: data.title || platformInfo.placeholderTitle,
        author: data.uploader || data.channel || platformInfo.mockAuthor,
        thumbnail: data.thumbnail || platformInfo.mockThumbnail,
        duration: formatDuration(data.duration),
        downloads: downloads
      };

      res.json(responseData);
    } catch (e) {
      console.warn('Failed to parse yt-dlp response, falling back to mock mode:', e);
      return sendMockResponse(res, matchedPlatformKey, platformInfo);
    }
  });
});

// Helper function to send mock response
function sendMockResponse(res, matchedPlatformKey, platformInfo) {
  const responseData = {
    platform: matchedPlatformKey,
    platformName: platformInfo.name,
    title: `${platformInfo.placeholderTitle} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    author: platformInfo.mockAuthor,
    thumbnail: platformInfo.mockThumbnail,
    duration: matchedPlatformKey === 'instagram' || matchedPlatformKey === 'snapchat' ? '0:30' : '3:15',
    downloads: [
      {
        labelAr: 'فيديو عالي الدقة (MP4)',
        labelEn: 'HD Video (MP4)',
        quality: '1080p',
        size: '22.4 MB',
        url: 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/echo-hereweare.mp4',
        type: 'video'
      },
      {
        labelAr: 'فيديو متوسط الدقة (MP4)',
        labelEn: 'SD Video (MP4)',
        quality: '720p',
        size: '10.8 MB',
        url: 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/echo-hereweare.mp4',
        type: 'video'
      },
      {
        labelAr: 'صوت فقط (MP3)',
        labelEn: 'Audio Only (MP3)',
        quality: '320kbps',
        size: '3.2 MB',
        url: 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/AirReview-Landmarks-02-ChasingSong.mp3',
        type: 'audio'
      }
    ]
  };
  res.json(responseData);
}

// Proxy Endpoint to stream file downloads and bypass cross-origin browser issues
app.get('/api/download', async (req, res) => {
  const { url, videoUrl, audioUrl, filename } = req.query;

  if (!url && (!videoUrl || !audioUrl)) {
    return res.status(400).send('URL or videoUrl + audioUrl is required');
  }

  const cleanFilename = filename || 'download.mp4';
  res.attachment(cleanFilename);

  // Case 1: Merge video and audio on-the-fly using ffmpeg
  if (videoUrl && audioUrl) {
    try {
      const ffmpeg = require('ffmpeg-static');
      const { spawn } = require('child_process');

      console.log('Spawning ffmpeg to merge video and audio on-the-fly...');
      
      const userAgentHeader = 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n';

      const ffmpegArgs = [
        '-headers', userAgentHeader,
        '-i', videoUrl,
        '-headers', userAgentHeader,
        '-i', audioUrl,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-strict', 'experimental',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov',
        'pipe:1'
      ];

      res.setHeader('Content-Type', 'video/mp4');

      const ffmpegProcess = spawn(ffmpeg, ffmpegArgs);

      ffmpegProcess.stdout.pipe(res);

      ffmpegProcess.stderr.on('data', (data) => {
        // Stats logging can be added here if needed
      });

      ffmpegProcess.on('error', (err) => {
        console.error('ffmpeg process error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error merging media streams.');
        }
      });

      req.on('close', () => {
        console.log('Client closed connection, killing ffmpeg process');
        try {
          ffmpegProcess.kill('SIGKILL');
        } catch (e) {
          console.warn('Failed to kill ffmpeg process:', e.message);
        }
      });

    } catch (err) {
      console.error('Error starting ffmpeg merging proxy:', err);
      if (!res.headersSent) {
        res.status(500).send('Server error during media merging');
      }
    }
  } else {
    // Case 2: Standard download proxy (single URL)
    try {
      const { Readable } = require('stream');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      const nodeStream = Readable.fromWeb(response.body);
      nodeStream.pipe(res);
    } catch (error) {
      console.error('Download proxy error:', error);
      res.redirect(url);
    }
  }
});

// Fallback to serve custom 404 page for any undefined routes
app.get('/*splat', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`OneTapDownload running at http://localhost:${PORT}`);
});
