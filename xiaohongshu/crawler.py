"""
小红书笔记爬虫
策略：
  1. SSR HTML 解析获取首页笔记（无需签名）
  2. Cookie 引导获取 web_session
  3. API 翻页获取后续笔记
"""
import json
import json5
import re
import time
import uuid
import struct
import hashlib
import random
import string
import requests
from typing import Optional

# ============================================================
# Session 配置
# ============================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.8",
}

# ============================================================
# Step 1: 生成 a1 / webId
# ============================================================

def _js_crc32(s: str) -> int:
    """JavaScript 风格 CRC32"""
    tbl = [0] * 256
    for i in range(256):
        c = i
        for _ in range(8):
            c = 0xEDB88320 ^ (c >> 1) if c & 1 else c >> 1
        tbl[i] = c
    c = 0xFFFFFFFF
    for b in s.encode("utf-8"):
        c = tbl[(c ^ b) & 0xFF] ^ (c >> 8)
    r = 0xFFFFFFFF ^ c
    return r - 0x100000000 if r >= 0x80000000 else r


def generate_a1_webid() -> tuple[str, str]:
    """生成 a1 (52位) 和 webId (MD5)"""
    ms_ts = int(time.time() * 1000)
    hex_ts = hex(ms_ts)[2:]
    random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=30))
    a1 = f"{hex_ts}{random_part}50"  # 5=平台码, 0="", 000=CRC32 占位
    # CRC32 of the first 3 parts
    crc_part = hex_ts + random_part + "5" + "0" + "000"
    crc = _js_crc32(crc_part)
    crc_str = hex(crc & 0xFFFFFFFF)[2:].zfill(8)
    a1 = f"{hex_ts}{random_part}5{crc_str}"
    web_id = hashlib.md5(a1.encode()).hexdigest()
    return a1, web_id


# ============================================================
# SSR HTML 解析
# ============================================================

def fetch_explore_ssr(session: requests.Session) -> list[dict]:
    """从 explore 页面 SSR 中提取笔记"""
    url = "https://www.xiaohongshu.com/explore"
    resp = session.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.text

    # 提取 __INITIAL_STATE__
    match = re.search(r'window\.__INITIAL_STATE__\s*=\s*', html)
    if not match:
        print("[WARN] __INITIAL_STATE__ not found")
        return []

    start = match.end()
    # 找到对应的 </script> 标签
    depth = 0
    end = start
    in_string = False
    string_char = None
    for i in range(start, len(html)):
        ch = html[i]
        if in_string:
            if ch == '\\':
                i += 1  # skip escaped char
                continue
            if ch == string_char:
                in_string = False
            continue
        if ch in ('"', "'"):
            in_string = True
            string_char = ch
            continue
        if ch in ('{', '['):
            depth += 1
        elif ch in ('}', ']'):
            depth -= 1
            if depth <= 0:
                end = i + 1
                break

    state_str = html[start:end]
    # Fix JS-specific values that break JSON parsers
    state_str = state_str.replace(':undefined', ':null')
    state_str = state_str.replace(':void 0', ':null')
    state_str = state_str.replace('undefined,', 'null,')
    try:
        state = json5.loads(state_str)
    except Exception:
        print(f"[WARN] INITIAL_STATE JSON parse failed (len={len(state_str)})")
        print(f"       First 100 chars: {state_str[:100]}")
        return []

    # 提取笔记数据
    notes = []
    # explore 页面的 note 数据通常在 state.explore.feeds 或 note 相关字段
    for key in state:
        if 'note' in key.lower() or 'feed' in key.lower():
            val = state[key]
            if isinstance(val, dict):
                # 递归查找 noteList / items
                _extract_notes(val, notes)
            elif isinstance(val, list):
                for item in val:
                    if isinstance(item, dict):
                        _extract_notes(item, notes)

    # 如果 json5 失败，用备用方案：正则提取 + DOM 解析
    if not notes:
        notes = _extract_from_state_regex(state_str)
    if not notes:
        notes = _extract_from_html(html)

    return notes


def _extract_notes(obj: dict, notes: list):
    """递归提取笔记数据"""
    if 'noteId' in obj or 'note_id' in obj:
        notes.append(_normalize_note(obj))
    for key in ('items', 'notes', 'noteList', 'feeds', 'note_details', 'data'):
        if key in obj and isinstance(obj[key], list):
            for item in obj[key]:
                if isinstance(item, dict):
                    _extract_notes(item, notes)


def _normalize_note(obj: dict) -> dict:
    """标准化笔记字段"""
    return {
        'noteId': obj.get('noteId') or obj.get('note_id') or obj.get('id', ''),
        'title': obj.get('title') or obj.get('displayTitle') or obj.get('display_title', ''),
        'desc': obj.get('desc') or obj.get('description', ''),
        'author': obj.get('user', {}).get('nickname', '') if isinstance(obj.get('user'), dict) else '',
        'authorId': obj.get('user', {}).get('userId', '') if isinstance(obj.get('user'), dict) else '',
        'likes': obj.get('likes') or obj.get('likedCount') or obj.get('interact_info', {}).get('likedCount', 0) if isinstance(obj.get('interact_info'), dict) else 0,
        'cover': obj.get('cover', {}).get('url', '') if isinstance(obj.get('cover'), dict) else '',
        'type': obj.get('type', 'normal'),
        'url': f"https://www.xiaohongshu.com/explore/{obj.get('noteId', '')}" if obj.get('noteId') else '',
    }


def _extract_from_state_regex(state_str: str) -> list[dict]:
    """从 INITIAL_STATE 用正则提取笔记（备用）"""
    notes = []
    # Find note objects by matching noteId pattern
    note_pattern = re.compile(
        r'\{(?:[^{}]|\{[^{}]*\})*?"noteId"\s*:\s*"(\w+)"(?:[^{}]|\{[^{}]*\})*?\}'
    )
    for match in note_pattern.finditer(state_str):
        obj_str = match.group()
        note_id = re.search(r'"noteId"\s*:\s*"(\w+)"', obj_str)
        title = re.search(r'"displayTitle"\s*:\s*"([^"]*)"', obj_str)
        desc = re.search(r'"desc"\s*:\s*"([^"]*)"', obj_str)

        if note_id:
            nid = note_id.group(1)
            notes.append({
                'noteId': nid,
                'title': title.group(1) if title else '',
                'desc': desc.group(1) if desc else '',
                'url': f'https://www.xiaohongshu.com/explore/{nid}',
            })

    if not notes:
        # Try simpler: just extract noteId + displayTitle pairs
        note_ids = re.findall(r'"noteId"\s*:\s*"(\w+)"', state_str)
        titles = re.findall(r'"displayTitle"\s*:\s*"([^"]*)"', state_str)
        for i, nid in enumerate(note_ids):
            notes.append({
                'noteId': nid,
                'title': titles[i] if i < len(titles) else '',
                'desc': '',
                'url': f'https://www.xiaohongshu.com/explore/{nid}',
            })

    return notes


def _extract_from_html(html: str) -> list[dict]:
    """从 HTML DOM 中提取笔记（备用方案）"""
    notes = []
    # 简单的正则匹配 note-item 链接
    pattern = re.compile(
        r'<a[^>]*href="(/explore/(\w+))"[^>]*>.*?'
        r'<img[^>]*src="([^"]+)"',
        re.DOTALL
    )
    matches = pattern.findall(html)
    for href, note_id, img in matches[:60]:
        notes.append({
            'noteId': note_id,
            'title': '',
            'desc': '',
            'url': f'https://www.xiaohongshu.com{href}',
            'cover': img.split('!')[0] if '!' in img else img,
        })
    return notes


# ============================================================
# 主流程
# ============================================================

def main():
    session = requests.Session()

    # Step 1: 生成基础 Cookie
    a1, web_id = generate_a1_webid()
    web_build = "6.25.1"
    loadts = str(int(time.time() * 1000))
    ab_request_id = str(uuid.uuid4())

    # 设置基础 Cookie
    cookies = {
        'a1': a1,
        'webId': web_id,
        'webBuild': web_build,
        'xsecappid': 'xhs-pc-web',
        'loadts': loadts,
        'abRequestId': ab_request_id,
    }
    for k, v in cookies.items():
        session.cookies.set(k, v, domain='.xiaohongshu.com')

    print(f"[Cookies] a1={a1} ({len(a1)} chars), webId={web_id}, webBuild={web_build}")

    # Step 2: Get SSR notes
    print("[SSR] Fetching explore page...")
    notes = fetch_explore_ssr(session)
    print(f"[SSR] Got {len(notes)} notes")

    # Output results
    for i, note in enumerate(notes):
        print(f"  [{i+1}] {note.get('title', '(no title)')[:60]}")
        print(f"       Author: {note.get('author', '?')} | Likes: {note.get('likes', '?')}")
        print(f"       URL: {note.get('url', '')}")

    # Save to JSON
    output = {
        'fetched_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'total': len(notes),
        'notes': notes,
    }
    output_path = 'h:/Crawler/xiaohongshu/notes_page1.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"[Saved] {output_path}")

    return notes


if __name__ == '__main__':
    main()
