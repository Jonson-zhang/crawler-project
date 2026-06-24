/**
 * Extract eval code from signV2Init source and search for RC4/XXTEA patterns
 */
"use strict";
const fs = require('fs');
const src = fs.readFileSync('signV2Init_src.txt', 'utf-8');

// Find the __makeTemplateObject call - the eval code is the first element
// Pattern: __makeTemplateObject(["<code>", ...], [...])
const mkIdx = src.indexOf('__makeTemplateObject([');
if (mkIdx < 0) { console.log('makeTemplateObject not found'); process.exit(1); }

// Find the opening bracket of the raw strings array
const arrOpen = mkIdx + '__makeTemplateObject(['.length;
// Find matching closing bracket by counting
let depth = 1;
let lastRawEnd = -1;
let inString = false;
let i = arrOpen;

// The first element is a double-quoted string
// We need to parse it as JavaScript string literal
// Find the first " character after arrOpen
const strStart = src.indexOf('"', arrOpen);
if (strStart < 0) { console.log('string start not found'); process.exit(1); }

// Now find the matching " (not escaped)
let strContent = '';
i = strStart + 1;
while (i < src.length) {
  if (src[i] === '\\') {
    // Handle escape sequences
    const next = src[i+1];
    if (next === '"') { strContent += '"'; i += 2; continue; }
    if (next === '\\') { strContent += '\\\\'; i += 2; continue; }
    if (next === 'n') { strContent += '\n'; i += 2; continue; }
    if (next === 'r') { strContent += '\r'; i += 2; continue; }
    if (next === 't') { strContent += '\t'; i += 2; continue; }
    if (next === 'x') {
      const hex = src.slice(i+2, i+4);
      strContent += String.fromCharCode(parseInt(hex, 16));
      i += 4; continue;
    }
    if (next === 'u') {
      strContent += '\\\\u'; // preserve unicode escapes
      i += 2; continue;
    }
    strContent += '\\\\' + next;
    i += 2; continue;
  }
  if (src[i] === '"') {
    // End of string (but check if followed by comma or bracket)
    const after = src.slice(i+1, i+10).trim();
    if (after.startsWith(',') || after.startsWith(']')) {
      break;
    }
  }
  strContent += src[i];
  i++;
}

console.log('Extracted eval code length:', strContent.length);
fs.writeFileSync('eval_code.txt', strContent);
console.log('Saved to eval_code.txt');

// Now search for patterns
console.log('\n=== Pattern Search ===');
const patterns = [
  ['XXTEA delta', /0x3C6EF373/],
  ['XXTEA key', /e6483ca2/],
  ['S-box start decimal', /108\s*,\s*71\s*,\s*200\s*,\s*252/],
  ['S-box start hex', /0x6C\s*,\s*0x47\s*,\s*0xC8\s*,\s*0xFC/],
  ['String.fromCharCode S-box', /String\[.*fromCharCode.*\]\(/],
  ['mns0201 prefix', /mns0201/],
  ['mns0301 prefix', /mns0301/],
  ['_0x30ce91 function', /function _0x30ce91/],
  ['return mns', /return.*mns0/],
];

for (const [name, re] of patterns) {
  const m = strContent.match(re);
  console.log(name + ':', m ? 'FOUND (' + m.length + ' matches) at ' + m.index : 'NOT FOUND');
  if (m) {
    const ctx = strContent.slice(Math.max(0,m.index-30), m.index+100);
    console.log('  ' + ctx.replace(/\n/g, ' '));
  }
}

// Also search for the S-box pattern in the eval code using a more flexible approach
// S-box: 256-byte array used for RC4 substitution
// Look for large array literals with 256 elements
const arrays = strContent.match(/\[[\d,\s]{500,}\]/g);
console.log('\nLarge numeric arrays (>500 chars):', arrays ? arrays.length : 0);
if (arrays) {
  for (const arr of arrays.slice(0, 3)) {
    console.log('  [' + arr.slice(1, 100) + '...] (' + arr.length + ' chars)');
  }
}

// Find the function that constructs the final output string
const fn30ce91 = strContent.indexOf('function _0x30ce91');
if (fn30ce91 >= 0) {
  console.log('\n=== _0x30ce91 (mnsv2 wrapper) ===');
  console.log(strContent.slice(fn30ce91, fn30ce91 + 400));
}
