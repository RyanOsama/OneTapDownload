const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');
const { execFile } = require('child_process');

const url = 'https://youtu.be/9oenZVLRZXc?si=TtlgaJPwE3-sGh48';
const ytDlpPath = path.join(__dirname, '..', 'yt-dlp.exe');

console.log('Running yt-dlp to extract URLs...');
execFile(ytDlpPath, ['-j', '--js-runtimes', 'node', url], (err, stdout, stderr) => {
  if (err) {
    console.error('yt-dlp error:', err);
    return;
  }
  
  const data = JSON.parse(stdout);
  const formats = data.formats || [];
  
  // Find highest video only format
  const videoFormats = formats.filter(f => f.vcodec !== 'none' && f.acodec === 'none' && f.url && f.height);
  videoFormats.sort((a, b) => b.height - a.height);
  const bestVideo = videoFormats[0];
  
  // Find best audio format
  const audioFormats = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.url);
  audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
  const bestAudio = audioFormats[0];
  
  if (!bestVideo || !bestAudio) {
    console.log('Could not find both video and audio streams.');
    return;
  }
  
  console.log(`Best Video: ${bestVideo.height}p, URL: ${bestVideo.url.substring(0, 80)}...`);
  console.log(`Best Audio: ${bestAudio.abr}kbps, URL: ${bestAudio.url.substring(0, 80)}...`);
  
  const userAgentHeader = 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n';
  const ffmpegArgs = [
    '-headers', userAgentHeader,
    '-i', bestVideo.url,
    '-headers', userAgentHeader,
    '-i', bestAudio.url,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-strict', 'experimental',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov',
    'pipe:1'
  ];
  
  console.log('Spawning ffmpeg...');
  const proc = spawn(ffmpeg, ffmpegArgs);
  
  let gotData = false;
  proc.stdout.on('data', (chunk) => {
    if (!gotData) {
      console.log(`Received first chunk of size ${chunk.length} bytes`);
      gotData = true;
    }
  });
  
  proc.stderr.on('data', (chunk) => {
    console.log('FFMPEG STDERR:', chunk.toString());
  });
  
  proc.on('close', (code) => {
    console.log('FFMPEG exited with code:', code);
  });
});
