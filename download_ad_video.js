const https = require('https');
const fs = require('fs');
const path = require('path');

const fileUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
const outputPath = path.join(__dirname, 'public', 'ad.mp4');

console.log('Downloading test video ad from:', fileUrl);
console.log('Saving to:', outputPath);

const file = fs.createWriteStream(outputPath);

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

https.get(fileUrl, options, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download, status code: ${response.statusCode}`);
    return;
  }
  
  response.pipe(file);
  
  file.on('finish', () => {
    file.close(() => {
      console.log('Download completed successfully! File size:', fs.statSync(outputPath).size, 'bytes');
      process.exit(0);
    });
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {});
  console.error('Error downloading file:', err.message);
  process.exit(1);
});
