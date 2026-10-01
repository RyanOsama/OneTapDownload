#!/usr/bin/env python3
import sys
import json
import re
import urllib.request
import urllib.parse
import os
import subprocess

def format_size(bytes_num):
    if not bytes_num or bytes_num <= 0:
        return "HD"
    if bytes_num >= 1024 * 1024 * 1024:
        return f"{bytes_num / (1024 * 1024 * 1024):.1f} GB"
    if bytes_num >= 1024 * 1024:
        return f"{bytes_num / (1024 * 1024):.1f} MB"
    if bytes_num >= 1024:
        return f"{bytes_num / 1024:.1f} KB"
    return f"{bytes_num} B"

def probe_size(url):
    if not url or not url.startswith('http'):
        return "HD"
    try:
        req = urllib.request.Request(url, method='HEAD', headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0'
        })
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            length = resp.headers.get('content-length')
            if length and length.isdigit():
                return format_size(int(length))
    except Exception:
        pass
    return "HD"

def get_cookies_path():
    for p in ['/var/www/onetapdownload/cookies.txt', 'cookies.txt']:
        if os.path.exists(p):
            return p
    return None

def extract_instagram(url):
    cookies_path = get_cookies_path()
    
    # Normalize stories URL
    target_url = url
    is_story = '/stories/' in url.lower()
    if is_story:
        story_match = re.search(r'(?:instagram\.com|instagr\.am)/stories/([a-zA-Z0-9._]+)', url, re.IGNORECASE)
        if story_match and story_match.group(1) != 'highlights':
            username = story_match.group(1)
            target_url = f"https://www.instagram.com/stories/{username}/"
    
    cmd = ['yt-dlp', '--no-warnings', '-j']
    if cookies_path:
        cmd.extend(['--cookies', cookies_path])
    cmd.append(target_url)

    items = []
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        stdout = proc.stdout.strip()
        if not stdout:
            return []

        lines = stdout.split('\n')
        total_count = len(lines)

        for idx, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                uploader = data.get('uploader') or data.get('uploader_id') or 'instagram_creator'
                author = f"@{uploader}" if not uploader.startswith('@') else uploader
                
                # Check if Photo or Video
                media_type = data.get('media_type')
                is_image = (media_type == 'image') or (data.get('vcodec') == 'none') or (data.get('ext') in ['jpg', 'png', 'webp'])
                
                # Determine download URL
                download_url = data.get('url')
                if not download_url and data.get('formats'):
                    best_f = data['formats'][-1]
                    download_url = best_f.get('url')
                
                thumb = data.get('thumbnail') or download_url
                size_label = probe_size(download_url)
                
                if is_story:
                    item_type_str = "صورة ستوري" if is_image else "فيديو ستوري"
                    title = f"ستوري ({idx+1}/{total_count}) - {author}"
                else:
                    item_title = data.get('title') or data.get('description') or f"Instagram Media {idx+1}"
                    clean_title = item_title.replace("\n", " ").strip()[:60]
                    title = f"{clean_title} ({idx+1}/{total_count})" if total_count > 1 else clean_title

                if is_image:
                    # PHOTO ITEM
                    items.append({
                        "platform": "instagram",
                        "platformName": "Instagram",
                        "title": title,
                        "author": author,
                        "thumbnail": thumb,
                        "duration": "صورة",
                        "downloads": [{
                            "labelAr": "تحميل الصورة الأصلية (HD JPG)",
                            "labelEn": "Download Original Photo (HD JPG)",
                            "quality": "Full HD",
                            "size": size_label,
                            "url": f"/api/download?url={urllib.parse.quote(download_url)}&filename={urllib.parse.quote(uploader)}_photo_{idx+1}.jpg",
                            "type": "image"
                        }]
                    })
                else:
                    # VIDEO ITEM
                    dur_secs = data.get('duration') or 0
                    dur_str = "فيديو HD"
                    if dur_secs:
                        m = int(dur_secs // 60)
                        s = int(dur_secs % 60)
                        dur_str = f"{m}:{s:02d}"

                    height = data.get('height') or 1080
                    quality_label = f"{height}p"

                    items.append({
                        "platform": "instagram",
                        "platformName": "Instagram",
                        "title": title,
                        "author": author,
                        "thumbnail": thumb,
                        "duration": dur_str,
                        "downloads": [{
                            "labelAr": "تحميل الفيديو (MP4)",
                            "labelEn": "Download Video (MP4)",
                            "quality": quality_label,
                            "size": size_label,
                            "url": f"/api/download?url={urllib.parse.quote(download_url)}&filename={urllib.parse.quote(uploader)}_video_{idx+1}.mp4",
                            "type": "video"
                        }]
                    })
            except Exception:
                pass

    except Exception:
        pass

    return items

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)
    
    target_url = sys.argv[1]
    res_items = extract_instagram(target_url)
    if res_items:
        print(json.dumps({"items": res_items}, ensure_ascii=False))
    else:
        print(json.dumps({"error": "Not found"}, ensure_ascii=False))
