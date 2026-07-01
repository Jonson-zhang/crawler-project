"""Find the real search API endpoint for ouyeel.com."""
import re
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
session = requests.Session()
session.headers.update({"User-Agent": UA})

# Get search page
r = session.get("https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=0&pageSize=50")
# Note: this will get RS6 challenge page, but let's see the main page first
# Actually we need the search page HTML after passing RS6

# Let's check the first steel page for API endpoints
r = session.get("https://www.ouyeel.com/steel")
html = r.text

# Find all JS URLs
js_urls = re.findall(r'src="(/[^"]+\.js[^"]*)"', html)
print("JS URLs in page:")
for u in js_urls[:10]:
    print("  " + u)
print()

# Find API-like URLs
api_urls = re.findall(r'(/api/[^"'\''\s]+)', html)
print("API-like URLs:")
for u in api_urls[:10]:
    print("  " + u)
print()

# Search for fetch/ajax calls in inline scripts
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, s in enumerate(scripts):
    fetch_matches = re.findall(r'["'\'']([^"'\''\s]*(?:api|search|query|list|fetch|ajax)[^"'\''\s]*)["'\''\s]', s)
    if fetch_matches:
        print("Script %d fetches:" % i)
        for m in fetch_matches[:10]:
            print("  " + m)
        print()
