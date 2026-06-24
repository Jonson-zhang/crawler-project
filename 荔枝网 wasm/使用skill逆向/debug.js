#!/usr/bin/env node
'use strict';
const { jsdomFromUrl } = require('sdenv');
const vm = require('vm');

async function main() {
  const dom = await jsdomFromUrl('https://www.gdtv.cn/', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    consoleConfig: { error: () => {} },
  });
  const ctx = dom.getInternalVMContext();

  await new Promise(r => setTimeout(r, 12000));

  const info = vm.runInContext(`
    (function() {
      var info = {};

      // Check DOM
      info.bodyHTML = document.body ? document.body.innerHTML.substring(0, 500) : 'no body';
      info.title = document.title || 'no title';
      info.allDivs = document.querySelectorAll('div').length;
      info.allIds = [];
      document.querySelectorAll('[id]').forEach(function(el) {
        info.allIds.push(el.id);
      });
      info.allIds = info.allIds.slice(0, 30);

      // Check for Vue apps
      info.vueApps = [];
      var allEls = document.querySelectorAll('*');
      for (var i = 0; i < allEls.length; i++) {
        var el = allEls[i];
        if (el.__vue__) { info.vueApps.push('Vue2 at #' + (el.id || 'no-id')); }
        if (el.__vue_app__) { info.vueApps.push('Vue3 at #' + (el.id || 'no-id')); }
        if (el._vnode && el._vnode.appContext) { info.vueApps.push('Vue3_vnode at #' + (el.id || 'no-id')); }
      }

      // Check scripts that loaded
      info.scripts = [];
      document.querySelectorAll('script').forEach(function(s) {
        if (s.src) info.scripts.push(s.src.substring(s.src.lastIndexOf('/')+1));
      });

      // Check localStorage
      info.localStorageKeys = [];
      try {
        for (var k in localStorage) {
          if (typeof localStorage[k] === 'string') info.localStorageKeys.push(k);
        }
      } catch(e) {}

      return info;
    })()
  `, ctx);

  console.log(JSON.stringify(info, null, 2));
  try { dom.window.close(); } catch(e) {}
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
