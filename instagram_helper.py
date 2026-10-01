#!/usr/bin/env python3
import sys
import json
import re
import urllib.request
import urllib.parse
import os
import http.cookiejar
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

def decode_shortcode(shortcode):
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    num = 0
    for char in shortcode:
        if char in alphabet:
            num = num * 64 + alphabet.index(char)
    return str(num)

def get_cookies_path():
    for p in ['/var/www/onetapdownload/cookies.txt', 'cookies.txt']:
        if os.path.exists(p):
            return p
    return None

def extract_story_ytdlp(url):
    story_match = re.search(r'(?:instagram\.com|instagr\.am)/stories/([a-zA-Z0-9._]+)', url, re.IGNORECASE)
    if not story_match:
        return []
    username = story_match.group(1)
    target_url = f"https://www.instagram.com/stories/{username}/"
    
    cookies_path = get_cookies_path()
    cmd = ['yt-dlp', '--no-warnings', '-j']
    if cookies_path:
        cmd.extend(['--cookies', cookies_path])
    cmd.append(target_url)
    
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        stdout = proc.stdout.strip()
        if not stdout:
            return []
        
        items = []
        lines = stdout.split('\n')
        for idx, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                thumb = data.get('thumbnail') or ''
                dur_secs = data.get('duration') or 0
                dur_str = "ستوري"
                if dur_secs:
                    m = int(dur_secs // 60)
                    s = int(dur_secs % 60)
                    dur_str = f"{m}:{s:02d}"
                
                v_url = data.get('url')
                if not v_url and data.get('formats'):
                    best_f = data['formats'][-1]
                    v_url = best_f.get('url')
                
                if v_url:
                    sz = probe_size(v_url)
                    clean_title = f"ستوري {idx+1} - @{username}"
                    items.append({
                        "platform": "instagram",
                        "platformName": "Instagram",
                        "title": clean_title,
                        "author": f"@{username}",
                        "thumbnail": thumb or v_url,
                        "duration": dur_str,
                        "downloads": [{
                            "labelAr": "تحميل الستوري (MP4)",
                            "labelEn": "Download Story (MP4)",
                            "quality": f"{data.get('height', 1080)}p",
                            "size": sz,
                            "url": f"/api/download?url={urllib.parse.quote(v_url)}&filename={urllib.parse.quote(username)}_story_{idx+1}.mp4",
                            "type": "video"
                        }]
                    })
            except Exception:
                pass
        return items
    except Exception:
        return []

def extract_ytdlp_fallback(url):
    cookies_path = get_cookies_path()
    cmd = ['yt-dlp', '--no-warnings', '-j']
    if cookies_path:
        cmd.extend(['--cookies', cookies_path])
    cmd.append(url)
    
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        stdout = proc.stdout.strip()
        if not stdout:
            return []
        
        items = []
        lines = stdout.split('\n')
        for idx, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                title = data.get('title') or data.get('description') or f"Instagram Media {idx+1}"
                clean_title = title.replace("\n", " ").strip()[:60] if title else f"Instagram Media {idx+1}"
                author = f"@{data.get('uploader')}" if data.get('uploader') else "@instagram_creator"
                thumb = data.get('thumbnail') or ''
                
                dur_secs = data.get('duration') or 0
                dur_str = "فيديو HD"
                if dur_secs:
                    m = int(dur_secs // 60)
                    s = int(dur_secs % 60)
                    dur_str = f"{m}:{s:02d}"
                
                v_url = data.get('url')
                if not v_url and data.get('formats'):
                    best_f = data['formats'][-1]
                    v_url = best_f.get('url')
                
                if v_url:
                    sz = probe_size(v_url)
                    items.append({
                        "platform": "instagram",
                        "platformName": "Instagram",
                        "title": clean_title,
                        "author": author,
                        "thumbnail": thumb or v_url,
                        "duration": dur_str,
                        "downloads": [{
                            "labelAr": "تحميل الفيديو (MP4)",
                            "labelEn": "Download Video (MP4)",
                            "quality": f"{data.get('height', 720)}p",
                            "size": sz,
                            "url": f"/api/download?url={urllib.parse.quote(v_url)}&filename={urllib.parse.quote(clean_title)}.mp4",
                            "type": "video"
                        }]
                    })
            except Exception:
                pass
        return items
    except Exception:
        return []

def extract_instagram(url):
    # Check if URL is a Story
    if '/stories/' in url.lower():
        story_items = extract_story_ytdlp(url)
        if story_items:
            return story_items

    post_match = re.search(r'(?:instagram\.com|instagr\.am)/(?:p|reel|reels|tv)/([a-zA-Z0-9_-]+)', url, re.IGNORECASE)
    if not post_match:
        return extract_ytdlp_fallback(url)

    shortcode = post_match.group(1)
    mid = decode_shortcode(shortcode)

    # Load session cookies
    cookie_str = ""
    cookies_path = get_cookies_path()
    if cookies_path:
        try:
            cj = http.cookiejar.MozillaCookieJar(cookies_path)
            cj.load(ignore_discard=True, ignore_expires=True)
            cookie_str = "; ".join([f"{c.name}={c.value}" for c in cj if 'instagram.com' in c.domain])
        except Exception:
            pass

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'Accept': '*/*',
        'Referer': 'https://www.instagram.com/'
    }
    if cookie_str:
        headers['Cookie'] = cookie_str

    api_url = f"https://www.instagram.com/api/v1/media/{mid}/info/"
    items = []

    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and data.get('items'):
                raw_item = data['items'][0]
                caption = raw_item.get('caption', {}).get('text', '') if raw_item.get('caption') else ''
                clean_title = caption.replace("\n", " ").strip()[:60] if caption else f"Instagram Post {shortcode}"
                
                user = raw_item.get('user', {})
                author = f"@{user.get('username')}" if user.get('username') else "@instagram_creator"
                
                carousel = raw_item.get('carousel_media', [])
                
                if carousel:
                    # Multi-image/video album
                    for idx, c in enumerate(carousel):
                        is_vid = (c.get('media_type') == 2)
                        if is_vid and c.get('video_versions'):
                            best_vid = c['video_versions'][0]
                            v_url = best_vid['url']
                            thumb = c.get('image_versions2', {}).get('candidates', [{}])[0].get('url', '')
                            size_label = probe_size(v_url)
                            
                            items.append({
                                "platform": "instagram",
                                "platformName": "Instagram",
                                "title": f"{clean_title} ({idx+1}/{len(carousel)})",
                                "author": author,
                                "thumbnail": thumb or v_url,
                                "duration": "فيديو HD",
                                "downloads": [{
                                    "labelAr": "تحميل الفيديو (MP4)",
                                    "labelEn": "Download Video (MP4)",
                                    "quality": f"{best_vid.get('height', 720)}p",
                                    "size": size_label,
                                    "url": f"/api/download?url={urllib.parse.quote(v_url)}&filename={urllib.parse.quote(clean_title)}_{idx+1}.mp4",
                                    "type": "video"
                                }]
                            })
                        else:
                            imgs = c.get('image_versions2', {}).get('candidates', [])
                            if imgs:
                                best_img = imgs[0]
                                img_url = best_img['url']
                                size_label = probe_size(img_url)
                                
                                items.append({
                                    "platform": "instagram",
                                    "platformName": "Instagram",
                                    "title": f"{clean_title} ({idx+1}/{len(carousel)})",
                                    "author": author,
                                    "thumbnail": img_url,
                                    "duration": "صورة",
                                    "downloads": [{
                                        "labelAr": "تحميل الصورة الأصلية (HD JPG)",
                                        "labelEn": "Download Original Photo (HD JPG)",
                                        "quality": "Full HD",
                                        "size": size_label,
                                        "url": f"/api/download?url={urllib.parse.quote(img_url)}&filename={urllib.parse.quote(clean_title)}_{idx+1}.jpg",
                                        "type": "image"
                                    }]
                                })
                else:
                    # Single photo or single video
                    is_vid = (raw_item.get('media_type') == 2) or bool(raw_item.get('video_versions'))
                    if is_vid and raw_item.get('video_versions'):
                        best_vid = raw_item['video_versions'][0]
                        v_url = best_vid['url']
                        thumb = raw_item.get('image_versions2', {}).get('candidates', [{}])[0].get('url', '')
                        size_label = probe_size(v_url)
                        
                        dur = raw_item.get('video_duration', 0)
                        dur_str = "فيديو HD"
                        if dur:
                            mins = int(dur // 60)
                            secs = int(dur % 60)
                            dur_str = f"{mins}:{secs:02d}"
                        
                        items.append({
                            "platform": "instagram",
                            "platformName": "Instagram",
                            "title": clean_title,
                            "author": author,
                            "thumbnail": thumb or v_url,
                            "duration": dur_str,
                            "downloads": [{
                                "labelAr": "تحميل الفيديو (MP4)",
                                "labelEn": "Download Video (MP4)",
                                "quality": f"{best_vid.get('height', 720)}p",
                                "size": size_label,
                                "url": f"/api/download?url={urllib.parse.quote(v_url)}&filename={urllib.parse.quote(clean_title)}.mp4",
                                "type": "video"
                            }]
                        })
                    else:
                        imgs = raw_item.get('image_versions2', {}).get('candidates', [])
                        if imgs:
                            best_img = imgs[0]
                            img_url = best_img['url']
                            size_label = probe_size(img_url)
                            
                            items.append({
                                "platform": "instagram",
                                "platformName": "Instagram",
                                "title": clean_title,
                                "author": author,
                                "thumbnail": img_url,
                                "duration": "صورة",
                                "downloads": [{
                                    "labelAr": "تحميل الصورة الأصلية (HD JPG)",
                                    "labelEn": "Download Original Photo (HD JPG)",
                                    "quality": "Full HD",
                                    "size": size_label,
                                    "url": f"/api/download?url={urllib.parse.quote(img_url)}&filename={urllib.parse.quote(clean_title)}.jpg",
                                    "type": "image"
                                }]
                            })
    except Exception:
        pass

    if not items:
        # Try yt-dlp fallback
        items = extract_ytdlp_fallback(url)

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
