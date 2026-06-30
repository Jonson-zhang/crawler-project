"""Decode OB string table from app.js"""
import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('config/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# The string table variable is defined at end of file
# a4_0x5d42=function(){return _0x1f98dd;}
# where _0x1f98dd is the array

# Search for the array
arr_pattern = re.compile(r'_0x1f98dd=\[(.*?)\];a4_0x5d42=function', re.DOTALL)
arr_match = arr_pattern.search(content)
if arr_match:
    array_text = arr_match.group(1)
    strings = re.findall(r"'([^']*)'|\"([^\"]*)\"", array_text)
    flat = [s[0] or s[1] for s in strings]
    print(f'Found {len(flat)} strings')

    # Show crypto-related strings
    for i, s in enumerate(flat):
        slow = s.lower()
        if any(kw in slow for kw in ['sm4','sm2','sm3','encrypt','decrypt','sign','key','create','cipher','aes','hash','hmac']):
            print(f'  [{i}] {s}')

    # Show possible key material (pure hex strings 32+ chars)
    print('\nPossible key strings (hex 32+ chars):')
    for i, s in enumerate(flat):
        if len(s) >= 32 and all(c in '0123456789abcdefABCDEF' for c in s):
            print(f'  [{i}] {s}')
else:
    print('String array not found with _0x1f98dd')
    # Try alternative variable names
    for name in ['_0x1f98dd', '_0x5d42', '_0x30c81a']:
        idx = content.rfind(f'{name}=[')
        if idx >= 0:
            end_idx = content.find('];', idx)
            if end_idx > 0:
                arr = content[idx+len(name)+2:end_idx]
                print(f'Found {name} at {idx}, length={len(arr)}')
                sub = arr[:200]
                print(f'  Preview: {sub}')
