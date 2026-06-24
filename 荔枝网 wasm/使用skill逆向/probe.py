"""一次性探明 gdtv.cn 的前端架构"""
from cloakbrowser import launch
import json

b = launch(headless=True)
page = b.new_page()

page.goto("https://www.gdtv.cn/", wait_until="networkidle")
page.wait_for_timeout(6000)

info = page.evaluate("""
(() => {
  const r = {};
  const root = document.querySelector('#root');

  // Framework detection
  r.rootChildren = root ? root.children.length : 0;
  r.rootInnerHTML = root ? root.innerHTML.substring(0, 300) : 'no root';

  // React fiber
  const reactKey = root ? Object.keys(root).find(k => k.startsWith('__reactFiber')) : null;
  r.react = !!reactKey;
  if (reactKey) {
    let fiber = root[reactKey];
    let depth = 0;
    while (fiber && depth < 20) {
      fiber = fiber.return || fiber._return;
      depth++;
    }
    r.reactDepth = depth;
  }

  // Vue check
  r.vue2 = !!(root && root.__vue__);
  r.vue3 = !!(root && root.__vue_app__);

  // Dva/Umi (Alibaba React framework, common at Alibaba/Umi-based sites)
  r.dva = !!(window.g_app);

  // Check Redux store on window
  r.windowKeys = Object.getOwnPropertyNames(window).filter(k =>
    typeof window[k] === 'object' && k.length < 30 &&
    (k.toLowerCase().includes('store') || k.toLowerCase().includes('redux') || k.toLowerCase().includes('model'))
  ).slice(0, 10);

  // Check global exposed APIs
  r.windowApi = Object.keys(window).filter(k =>
    k.includes('api') || k.includes('request') || k.includes('fetch')
  ).slice(0, 10);

  // Check webpackJsonp
  r.hasWebpackJsonp = !!(window.webpackJsonp);

  // Check for axios
  r.hasAxios = typeof window.axios !== 'undefined';

  // Check request interception (XHR monkey patching)
  const origOpen = XMLHttpRequest.prototype.open.toString();
  r.xhrOpenIsNative = origOpen.includes('[native code]');
  r.xhrOpenPreview = origOpen.substring(0, 80);

  // Network activity - any API calls in flight?
  r.documentReadyState = document.readyState;

  return r;
})()
""")

print(json.dumps(info, ensure_ascii=False, indent=2))

# Also try to intercept ongoing API requests
page.wait_for_timeout(3000)

b.close()
