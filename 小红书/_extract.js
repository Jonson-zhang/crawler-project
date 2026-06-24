// Direct extraction of eval code from vendor.js signV2Init
const fs = require('fs');
const vendor = fs.readFileSync('data/vendor.js', 'utf-8');

// Find signV2Init module (68274)
const modIdx = vendor.indexOf('68274:function');
const modEnd = vendor.indexOf(',', modIdx); // rough - first comma after module

// Find String.raw(templateObject... in the module
const rawIdx = vendor.indexOf('String.raw(', modIdx);
if (rawIdx < 0) { console.log('String.raw not found'); process.exit(1); }

// The template is: String.raw(templateObject_1||(templateObject_1=__makeTemplateObject(["<CODE>",...]))
// Find __makeTemplateObject([
const mtIdx = vendor.indexOf('__makeTemplateObject([', rawIdx);
if (mtIdx < 0) { console.log('makeTemplateObject not found'); process.exit(1); }

// First [ after mt — this is the raw strings array
const arrOpen = vendor.indexOf('[', mtIdx);
// First " after arrOpen — start of first raw string
const strStart = vendor.indexOf('"', arrOpen);
console.log('Array open:', arrOpen, 'String start:', strStart);

// Parse the JS string (handle escape sequences)
let i = strStart + 1;
let code = '';
let esc = false;
while (i < vendor.length) {
  if (esc) { code += vendor[i]; esc = false; i++; continue; }
  if (vendor[i] === '\\') { esc = true; i++; continue; }
  if (vendor[i] === '"') {
    // Check if this is the end of the raw string (followed by , or ])
    const rest = vendor.slice(i + 1, i + 20).trim();
    if (rest[0] === ',' || rest[0] === ']') break;
  }
  code += vendor[i];
  i++;
}

console.log('Raw code length:', code.length);

// Now parse the JS escape sequences to get actual code
let result = '';
let j = 0;
while (j < code.length) {
  if (code[j] === '\\') {
    const n = code[j + 1];
    if (n === '"') { result += '"'; j += 2; continue; }
    if (n === '\\') { result += '\\'; j += 2; continue; }
    if (n === 'n') { result += '\n'; j += 2; continue; }
    if (n === 'r') { result += '\r'; j += 2; continue; }
    if (n === 't') { result += '\t'; j += 2; continue; }
    if (n === 'x') {
      result += String.fromCharCode(parseInt(code.slice(j+2, j+4), 16));
      j += 4; continue;
    }
    if (n === '\'') { result += '\''; j += 2; continue; }
    result += code[j]; j += 2; continue;
  }
  result += code[j];
  j++;
}

fs.writeFileSync('_eval_code.js', result);
console.log('Eval code saved:', result.length, 'chars');

// Count various patterns
console.log('_0x390b16:', (result.match(/_0x390b16/g)||[]).length, 'occurrences');
console.log('_0x30754b:', (result.match(/_0x30754b/g)||[]).length, 'occurrences');
console.log('__$c:', (result.match(/__\$c/g)||[]).length, 'occurrences');

// Search for S-box — find ALL numeric arrays with lots of elements
let depth = 0, start = -1, inStr = false, esc = false;
let found = [];
for (let i = 0; i < result.length; i++) {
  if (esc) { esc = false; continue; }
  if (result[i] === '\\') { esc = true; continue; }
  if (result[i] === '\'' || result[i] === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (result[i] === '[') { if (depth === 0) start = i; depth++; continue; }
  if (result[i] === ']') { depth--; if (depth === 0 && start >= 0) {
    const arr = result.slice(start, i+1);
    if (/^\[[\d,\s]+\]$/.test(arr)) {
      try {
        const nums = arr.slice(1,-1).split(',').map(Number).filter(n => !isNaN(n));
        if (nums.length >= 128 && nums.length <= 512 && nums.every(n => n >= 0 && n <= 255)) {
          found.push({ len: nums.length, pos: start, unique: new Set(nums).size, first10: nums.slice(0,10), nums });
        }
      } catch(e) {}
    }
    start = -1;
  }}
}

console.log('\n=== Numeric arrays (128-512 elements, all 0-255) ===');
console.log('Found:', found.length);
for (const f of found) {
  const perfect = f.len === 256 && f.unique === 256;
  console.log((perfect ? '*** PERFECT SBOX *** ' : '') + 'len=' + f.len + ' unique=' + f.unique + ' at=' + f.pos);
  console.log('  First 10: [' + f.first10.join(',') + ']');
  if (perfect) {
    const expected = [108,71,200,252,102,41,228,110,198,188,243,68];
    console.log('  Expected: [' + expected.join(',') + ']');
    console.log('  Match:', f.first10.slice(0,12).every((v,i) => v === expected[i]));
    fs.writeFileSync('_sbox.json', JSON.stringify(f.nums));
    console.log('  SAVED to _sbox.json');
  }
}

// Also search bytecode
const bcIdx = result.indexOf('var __$c');
if (bcIdx >= 0) {
  const qStart = result.indexOf('\'', bcIdx) + 1;
  const qEnd = result.indexOf('\'', qStart);
  const bcHex = result.slice(qStart, qEnd);
  console.log('\nBytecode hex length:', bcHex.length);
  const bytes = [];
  for (let i = 0; i < bcHex.length; i += 2) bytes.push(parseInt(bcHex.slice(i, i+2), 16));
  const pat = [108,71,200,252,102,41,228,110,198,188,243,68];
  for (let i = 0; i < bytes.length - 12; i++) {
    if (bytes.slice(i, i+12).every((b, j) => b === pat[j])) {
      console.log('SBOX in bytecode at offset', i);
      fs.writeFileSync('_sbox_from_bc.json', JSON.stringify(bytes.slice(i, i+256)));
    }
  }
}
