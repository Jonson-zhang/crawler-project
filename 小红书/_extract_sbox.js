/**
 * 从 signV2Init 的 eval 代码中提取 RC4 S-box (256字节置换表)
 * 和 RC4 加密实现
 */
"use strict";
const fs = require('fs'), vm = require('vm'), dom = require('./env.dom');

// 最小沙箱
const s = {
  window:{}, self:{}, global:{}, globalThis:{},
  document:dom.document, navigator:dom.navigator, screen:dom.screen, performance:dom.performance,
  console:{log:()=>{}, error:()=>{}}, setTimeout:fn=>{fn();return 0;},
  TextEncoder,TextDecoder,URL,URLSearchParams, crypto:require('crypto').webcrypto,
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,
  Uint8Array,Promise,Proxy,Reflect,Symbol,Error,TypeError,ReferenceError,
  JSON,eval,process:{env:{},platform:'win32'},
};
s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location=s.location;
const ctx = vm.createContext(s);

// Intercept eval to capture the code
let evalCount = 0;
const origEval = s.eval;
s.eval = function(code) {
  evalCount++;
  if (evalCount === 1) {
    // Save the full eval code
    fs.writeFileSync('_eval_dump.js', code);
    process.stderr.write('Captured eval code: ' + code.length + ' chars\n');
  }
  return origEval(code);
};

// Load vendor
const rt = fs.readFileSync('sign.js','utf-8').match(/const WEBPACK_RUNTIME = `([\s\S]*?)`;/)[1];

global.document = s.document; global.top = s; global.screen = s.screen;
Object.defineProperty(global, 'navigator', {value: s.navigator, configurable: true, writable: true});
const _oe = console.error; console.error = () => {};

vm.runInContext(rt, ctx, {filename:'rt'});
vm.runInContext(fs.readFileSync('data/vendor.js','utf-8'), ctx, {filename:'vendor'});

console.error = _oe;

// Now search _eval_dump.js for S-box and RC4 patterns
const code = fs.readFileSync('_eval_dump.js', 'utf-8');
process.stderr.write('Searching eval code for S-box...\n');

// Strategy 1: Find large numeric arrays (256 elements, values 0-255)
// Use Node.js to parse the JS and export arrays
const arrays = [];
// Find all [...] literals
let depth = 0, start = -1;
let inStr = false, esc = false;
for (let i = 0; i < code.length; i++) {
  if (esc) { esc = false; continue; }
  if (code[i] === '\\') { esc = true; continue; }
  if (code[i] === '"' || code[i] === "'") { inStr = !inStr; continue; }
  if (inStr) continue;
  if (code[i] === '[') { if (depth === 0) start = i; depth++; continue; }
  if (code[i] === ']') { depth--; if (depth === 0 && start >= 0) { arrays.push(code.slice(start, i+1)); start = -1; } continue; }
}

let sboxCandidate = null;
let sboxIndex = -1;
for (let ai = 0; ai < arrays.length; ai++) {
  const arr = arrays[ai];
  // Only process arrays with comma-separated numbers
  if (!/^\[[\s\d,]+\]$/.test(arr)) continue;
  try {
    const nums = arr.slice(1,-1).split(',').map(s => parseInt(s.trim()));
    if (nums.length >= 200 && nums.length <= 300 && nums.every(n => n >= 0 && n <= 255)) {
      process.stderr.write(`Array #${ai}: ${nums.length} elements, range [${Math.min(...nums)},${Math.max(...nums)}]\n`);
      // Check if it's a valid S-box (all values 0-255 appear exactly once = permutation)
      const seen = new Set(nums);
      if (nums.length === 256 && seen.size === 256) {
        process.stderr.write('  *** PERFECT S-BOX: 256 unique values!\n');
        sboxCandidate = nums;
        sboxIndex = ai;
      } else {
        process.stderr.write('  Not a perfect permutation\n');
        process.stderr.write(`  First 30: ${nums.slice(0,30).join(',')}\n`);
        // Save anyway for analysis
        if (!sboxCandidate) {
          sboxCandidate = nums;
          sboxIndex = ai;
        }
      }
      // Also show surrounding context
      const ctx = code.slice(Math.max(0, code.indexOf(arr) - 50), code.indexOf(arr) + arr.length + 50);
      process.stderr.write(`  Context: ...${ctx.slice(0,200)}...\n`);
    }
  } catch(e) {}
}

if (sboxCandidate) {
  fs.writeFileSync('_sbox.json', JSON.stringify(sboxCandidate));
  process.stderr.write(`\nS-box saved to _sbox.json (${sboxCandidate.length} bytes)\n`);

  // Also save as raw bytes for Python
  fs.writeFileSync('_sbox.bin', Buffer.from(sboxCandidate));
  process.stderr.write('S-box saved as _sbox.bin\n');
} else {
  process.stderr.write('\nNo S-box found. Trying alternative search methods...\n');

  // Strategy 2: Search for String.fromCharCode patterns (used to build S-box)
  const fromCodeIdx = code.indexOf('String.fromCharCode');
  if (fromCodeIdx >= 0) {
    process.stderr.write('String.fromCharCode at ' + fromCodeIdx + ':\n');
    process.stderr.write(code.slice(fromCodeIdx, fromCodeIdx + 400) + '\n');
  }

  // Strategy 3: Search for RC4 implementation patterns
  const rc4Patterns = ['var i=0','var j=0','swap','sbox','S-box','rc4','RC4'];
  for (const p of rc4Patterns) {
    const idx = code.indexOf(p);
    if (idx >= 0) process.stderr.write(`Pattern "${p}" at ${idx}\n`);
  }

  // Strategy 4: Look at the mnsv2 return value logic
  // Find function that builds the final string
  const fn30ce = code.indexOf('function _0x30ce91');
  if (fn30ce >= 0) {
    process.stderr.write('\n--- _0x30ce91 (mnsv2 wrapper) ---\n');
    process.stderr.write(code.slice(fn30ce, fn30ce + 600) + '\n');
  }

  // Strategy 5: Search for the XXTEA key
  const keyIdx = code.indexOf('e6483ca2');
  if (keyIdx >= 0) {
    process.stderr.write('\nXXTEA key found at ' + keyIdx + ':\n');
    process.stderr.write(code.slice(keyIdx - 50, keyIdx + 100) + '\n');
  }
}

// Also search for the 135-byte payload construction
process.stderr.write('\n=== Searching for payload construction patterns ===\n');
for (const p of ['135','89','payload','xh\\\\','0x78']) {
  const idx = code.indexOf(p);
  if (idx >= 0) process.stderr.write(`"${p}" at ${idx}: ${code.slice(idx-20,idx+60).replace(/\n/g,' ')}\n`);
}
