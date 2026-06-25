import re

files = [
    'h:/Crawler/xiaohongshu/sdt_source_init.js',
    'h:/Crawler/xiaohongshu/ds_loader.js',
    'h:/Crawler/xiaohongshu/v1_f218.js',
]

patterns = [
    'mnsv2', 'mns0201', 'mns0301',
    '_AUuXfEG', '_BHjFmfUME',
    'typeof window', 'typeof global',
    r'window\[', r'glb\[',
    'defineProperty',
]

for fp in files:
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    print(f'\n=== {fp.split("/")[-1]} ({len(content)} chars) ===')
    for pat in patterns:
        matches = list(re.finditer(pat, content))
        if matches:
            print(f'  [{pat}] ({len(matches)} matches)')
            for m in matches[:3]:
                start = max(0, m.start() - 40)
                end = min(len(content), m.end() + 40)
                snippet = content[start:end]
                snippet = snippet.replace('\n', ' ').replace('\r', ' ')
                print(f'    ...{snippet}...')
