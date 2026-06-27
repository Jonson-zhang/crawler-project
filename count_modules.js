const fs = require('fs');
const code = fs.readFileSync('QQ音乐/vendor.chunk.js', 'utf-8');

// 1. Find .push(
const pushIdx = code.indexOf('.push(');
console.log('pushIdx:', pushIdx);

// 2. Find the matching )
// After .push( ... )
let pd = 1; // depth of the (
let end = pushIdx + 6; // start after .push(
let inS = false;
for (let i = end; i < code.length; i++) {
  const ch = code[i];
  if (ch === '"' && code[i-1] !== '\\') inS = !inS;
  if (!inS) {
    if (ch === '(') pd++;
    if (ch === ')') { pd--; if (pd === 0) { end = i; break; } }
  }
}
console.log('argEnd:', end);
console.log('Debug around push:', code.substring(pushIdx, pushIdx + 20));
console.log('Debug around end:', code.substring(end - 5, end + 5));

const fullArg = code.substring(pushIdx + 6, end);
console.log('fullArg length:', fullArg.length);
console.log('fullArg[0..3]:', fullArg.substring(0, 5));

// Parse top-level elements of the outer array [[...], [...], ...?]
let td = 0, ts = false;
let curStart = null;
let elements = [];
for (let i = 0; i < fullArg.length; i++) {
  const ch = fullArg[i];
  if (ch === '"' && fullArg[i-1] !== '\\') ts = !ts;
  if (!ts) {
    if (ch === '[' || ch === '{') {
      if (td === 0) curStart = i;
      td++;
    }
    if (ch === ']' || ch === '}') {
      td--;
      if (td === 0 && curStart !== null) {
        elements.push({
          start: curStart,
          end: i,
          len: i - curStart + 1,
          preview: fullArg.substring(curStart, Math.min(curStart + 60, i + 1)),
          isArray: ch === ']',
        });
        curStart = null;
      }
    }
  }
}

console.log('Number of elements:', elements.length);
elements.forEach((el, idx) => {
  console.log(`Element ${idx}: start=${el.start}, end=${el.end}, len=${el.len}, isArray=${el.isArray}`);
  console.log(`  preview: ${el.preview}`);
});

// If we found the modules array (element 1), analyze it
if (elements.length >= 2 && elements[1].isArray) {
  const modArr = fullArg.substring(elements[1].start, elements[1].end + 1);
  console.log('\n=== MODULES ARRAY ANALYSIS ===');
  console.log('Length:', modArr.length);
  console.log('Starts:', modArr.substring(0, 100));
  console.log('Ends:', modArr.substring(modArr.length - 100));

  // Count entries by finding top-level commas inside the array
  let md = 0, ms2 = false;
  let commas = [];
  for (let i = 1; i < modArr.length - 1; i++) {
    const ch = modArr[i];
    if (ch === '"' && modArr[i-1] !== '\\') ms2 = !ms2;
    if (!ms2) {
      if (ch === '[' || ch === '{') md++;
      if (ch === ']' || ch === '}') md--;
      if (ch === ',' && md === 0) commas.push(i);
    }
  }
  console.log('Commas at depth 0:', commas.length);
  console.log('Module count:', commas.length + 1);
  console.log('First 5 commas:', commas.slice(0, 5).map(c => modArr.substring(c-10, c+10)));
  console.log('Last 5 commas:', commas.slice(-5).map(c => modArr.substring(c-10, c+10)));

  // Check entries around 125-128
  if (commas.length >= 130) {
    console.log('\n=== MODULE 125-128 ===');
    for (let m of [124, 125, 126, 127]) {
      const cs = commas[m] + 1;
      const ce = m + 1 < commas.length ? commas[m + 1] : modArr.length - 1;
      const entry = modArr.substring(cs, ce).trim();
      console.log(`Module ${m + 1} (${cs}..${ce}):`, entry.substring(0, 120));
    }
  }
}
