const { execFile } = require('child_process');
const path = require('path');

const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const ytDlpPath = path.join(__dirname, '..', 'yt-dlp.exe');

execFile(ytDlpPath, ['-j', url], (error, stdout) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  const data = JSON.parse(stdout);
  const formats = data.formats || [];
  
  console.log('--- ALL FORMATS ---');
  formats.forEach(f => {
    console.log(`Format: ${f.format_id} | Resolution: ${f.resolution || (f.width + 'x' + f.height)} | Height: ${f.height}p | Vcodec: ${f.vcodec} | Acodec: ${f.acodec} | HasAudio: ${f.acodec !== 'none' && f.acodec !== null}`);
  });
});
