"""Find the real API endpoint for search results."""
import re
import requests
from pathlib import Path

# Read saved search page
text = Path(__file__).parent / "search_page.html"
text = text.read_text(encoding="utf-8")

# 1. AJAX API URLs
ajax_patterns = [
    'src="(.*?\\.js[^"]*)"',
    '/api/([^"\'\\s]+)',
    'ebus/([^"\'\\s]+)',
    'gateway/([^"\'\\s]+)',
    'path:\\s*"(/[^"]+)"',
    'url:\\s*"(/[^"]*search[^"]*)"',
]
for pat in ajax_patterns:
    matches = re.findall(pat, text)
    if matches:
        print("Pattern: " + pat)
        for m in matches[:15]:
            print("  " + m)

# 2. Webpack chunk URLs - these contain the API logic
js_urls = re.findall(r'src="(/[^"]+\.js[^"]*)"', text)
print("\n=== JS bundles ===")
for u in js_urls:
    print("  " + u)

# 3. Check if there are XHR requests coded in the HTML
xhr_urls = re.findall(r'/steel/search/([^"\'\\s]+)', text)
print("\n=== Search sub-paths ===")
for u in set(xhr_urls):
    print("  /steel/search/" + u)

# 4. Look for the actual product data patterns
# Sometimes data is in window.__NUXT__ or window.__INITIAL_STATE__
window_vars = re.findall(r'window\.(\w+)\s*=', text)
print("\n=== Window variables ===")
for v in set(window_vars):
    print("  window." + v)
