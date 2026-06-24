/**
 * 从 vendor.js 中提取 RC4 S-box
 * 策略: 获取 signV2Init 源码，解析出 eval 代码中的 256 元素数组
 */
"use strict";
const fs = require('fs'), vm = require('vm'), dom = require('./env.dom');

const s = {
  window:{}, self:{}, global:{}, globalThis:{},
  document:dom.document, navigator:dom.navigator, screen:dom.screen, performance:dom.performance,
  console:{log:()=>{}, error:()=>{}}, setTimeout:fn=>{fn();return 0},
  TextEncoder,TextDecoder,URL,URLSearchParams, crypto:require('crypto').webcrypto,
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,
  Uint8Array,Promise,Proxy,Reflect,Symbol,Error,TypeError,ReferenceError,
  JSON,eval,process:{env:{},platform:'win32'},
};
s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location=s.location;
const ctx = vm.createContext(s);

// Replace eval in the VM context to capture the code
s.__EVAL_LOG__ = [];
s.eval = function(code) {
  process.stderr.write('[eval captured] ' + code.length + ' chars\n');
  s.__EVAL_LOG__.push(code);
  // Execute using Function constructor which bypasses eval replacement
  try {
    return (new Function('"use strict"; return eval(' + JSON.stringify(code) + ')'))();
  } catch(e) {
    // If Function constructor approach fails, try direct
    return Function(code)();
  }
};

const rt = fs.readFileSync('sign.js','utf-8').match(/const WEBPACK_RUNTIME = `([\s\S]*?)`;/)[1];
const _oe = console.error; console.error = () => {};

vm.runInContext(rt, ctx, {filename:'rt'});
vm.runInContext(fs.readFileSync('data/vendor.js','utf-8'), ctx, {filename:'vendor'});

// If eval wasn't called during vendor load, manually call signV2Init
if (s.__EVAL_LOG__.length === 0) {
  process.stderr.write('No eval captured during vendor load, calling signV2Init...\n');
  try {
    vm.runInContext('__webpack_require__(68274).a()', ctx);
  } catch(e) {
    process.stderr.write('signV2Init error: ' + e.message.slice(0,200) + '\n');
  }
}

console.error = _oe;

if (s.__EVAL_LOG__.length > 0) {
  const code = s.__EVAL_LOG__[0];
  fs.writeFileSync('_eval_dump.js', code);
  process.stderr.write('Saved eval code: ' + code.length + ' chars\n');

  // Now search for S-box
  extractSbox(code);
} else {
  // Fallback: extract from signV2Init source
  process.stderr.write('Eval not captured, extracting from source...\n');
  const src = vm.runInContext('__webpack_require__(68274).a.toString()', ctx);
  fs.writeFileSync('_signV2Init.js', src);
  process.stderr.write('signV2Init source: ' + src.length + ' chars\n');

  // Extract eval code from template literal
  const tplStart = src.indexOf('String.raw(templateObject_1||(templateObject_1=__makeTemplateObject([');
  if (tplStart >= 0) {
    const codeStart = src.indexOf('"', tplStart + 70) + 1;
    // Find matching unescaped "
    const remaining = src.slice(codeStart);
    const parts = [];
    let i = 0;
    let esc = false;
    while (i < remaining.length) {
      if (esc) { parts.push(remaining[i]); esc = false; i++; continue; }
      if (remaining[i] === '\\') { esc = true; i++; continue; }
      if (remaining[i] === '"') break;
      parts.push(remaining[i]);
      i++;
    }
    const evalCode = parts.join('');
    fs.writeFileSync('_eval_dump.js', evalCode);
    process.stderr.write('Extracted eval code: ' + evalCode.length + ' chars\n');
    extractSbox(evalCode);
  }
}

function extractSbox(code) {
  // Find all array literals
  const arrays = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < code.length; i++) {
    if (esc) { esc = false; continue; }
    if (code[i] === '\\') { esc = true; continue; }
    if (code[i] === '"' || code[i] === "'") { inStr = !inStr; continue; }
    if (inStr) continue;
    if (code[i] === '[') { if (depth === 0) start = i; depth++; continue; }
    if (code[i] === ']') { depth--; if (depth === 0 && start >= 0) { arrays.push({str: code.slice(start, i+1), pos: start}); start = -1; } continue; }
  }

  let found = false;
  for (const {str, pos} of arrays) {
    if (!/^\[[\s\d,]+\]$/.test(str)) continue;
    try {
      const nums = str.slice(1,-1).split(',').map(s => parseInt(s.trim()));
      if (nums.length === 256 && new Set(nums).size === 256) {
        console.log('\n=== PERFECT S-BOX at position ' + pos + ' ===');
        console.log('First 30:', nums.slice(0,30).join(','));
        console.log('Last 10:', nums.slice(-10).join(','));
        console.log('All values 0-255: ' + nums.every(n => n >= 0 && n <= 255));
        fs.writeFileSync('_sbox.json', JSON.stringify(nums));
        fs.writeFileSync('_sbox.bin', Buffer.from(nums));

        // Show context around the S-box
        const ctx = code.slice(Math.max(0, pos - 100), pos + str.length + 100);
        console.log('\nContext:\n' + ctx.slice(0, 500));
        found = true;
      } else if (nums.length >= 200 && nums.length <= 300) {
        console.log('\n--- Candidate array at ' + pos + ' (' + nums.length + ' elements) ---');
        console.log('First 20:', nums.slice(0,20).join(','));
        console.log('Unique values:', new Set(nums).size);
        // Save first candidate
        if (!fs.existsSync('_sbox.json')) {
          fs.writeFileSync('_sbox_' + nums.length + '.json', JSON.stringify(nums));
        }
      }
    } catch(e) {}
  }

  if (!found) {
    console.log('\nNo 256-element S-box found. Saving _eval_dump.js for manual analysis.');
    console.log('File size: ' + code.length + ' chars');
    // Try regex search for different number array patterns
    const matches = code.match(/\[([\d,\s]{400,3000})\]/g);
    if (matches) {
      console.log('\nFound ' + matches.length + ' potential large arrays');
      for (let i = 0; i < Math.min(matches.length, 5); i++) {
        console.log('\nArray #' + i + ' (' + matches[i].length + ' chars):');
        console.log(matches[i].slice(0, 200));
      }
    }
  }
}
