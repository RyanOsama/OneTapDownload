const fs = require('fs');
const path = require('path');
const https = require('https');

if (process.platform === 'win32') {
  console.log('Windows detected. Using bundled yt-dlp.exe.');
  process.exit(0);
}

console.log('Non-Windows platform detected. Downloading yt-dlp for Linux...');

const targetPath = path.join(__dirname, 'yt-dlp');
const downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

const file = fs.createWriteStream(targetPath);

function download(url) {
  https.get(url, (response) => {
    // Handle redirect
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      return download(response.headers.location);
    }

    if (response.statusCode !== 200) {
      console.error(`Failed to download yt-dlp. Status code: ${response.statusCode}`);
      process.exit(1);
    }

    response.pipe(file);

    file.on('finish', () => {
      file.close(() => {
        console.log('yt-dlp downloaded successfully.');
        try {
          fs.chmodSync(targetPath, '755');
          console.log('Set yt-dlp permissions to executable (755).');
        } catch (err) {
          console.error('Failed to set permissions:', err.message);
        }
        process.exit(0);
      });
    });
  }).on('error', (err) => {
    fs.unlink(targetPath, () => {});
    console.error('Download error:', err.message);
    process.exit(1);
  });
}

download(downloadUrl);
