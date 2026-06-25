import requests, re, json5, json, sys

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'})
resp = s.get('https://www.xiaohongshu.com/explore', timeout=30)
html = resp.text

match = re.search(r'window\.__INITIAL_STATE__\s*=\s*', html)
start = match.end()
depth = 0
end = start
in_str = False
sc = None
for i in range(start, len(html)):
    ch = html[i]
    if in_str:
        if ch == '\\':
            i += 1
            continue
        if ch == sc:
            in_str = False
        continue
    if ch in ('"', "'"):
        in_str = True
        sc = ch
        continue
    if ch in ('{', '['):
        depth += 1
    elif ch in ('}', ']'):
        depth -= 1
        if depth <= 0:
            end = i + 1
            break

state_str = html[start:end]
print(f"Extracted: {len(state_str)} chars")

# Show position around 3955
print(f"Around pos 3950-3980: {repr(state_str[3950:3980])}")

# Try to identify the problematic character
for pos in [3955, 3954, 3953, 3956]:
    print(f"  char at {pos}: {repr(state_str[pos])} (ord={ord(state_str[pos])})")

# Try json5 again with more info
try:
    state = json5.loads(state_str)
    top_keys = list(state.keys())
    print(f"json5 OK! Keys: {top_keys}")
    # Dump first 2 levels
    for k in top_keys:
        v = state[k]
        if isinstance(v, dict):
            print(f"  {k}: dict with keys {list(v.keys())[:10]}")
        elif isinstance(v, list):
            print(f"  {k}: list[{len(v)}]")
        else:
            print(f"  {k}: {type(v).__name__}")
except Exception as e:
    print(f"json5 error: {e}")
    # Try to narrow down
    for cutoff in range(3000, min(len(state_str), 5000), 500):
        try:
            json5.loads(state_str[:cutoff] + '}')
        except:
            print(f"  breaks before {cutoff}")
            break

# Also try to directly regex-extract note data
note_ids = re.findall(r'"noteId"\s*:\s*"([^"]+)"', state_str)
note_titles = re.findall(r'"displayTitle"\s*:\s*"([^"]*)"', state_str)
print(f"\nRegex approach: {len(note_ids)} noteIds, {len(note_titles)} titles found")
if note_ids:
    print(f"  First 3 IDs: {note_ids[:3]}")
if note_titles:
    print(f"  First 3 titles: {note_titles[:3]}")
