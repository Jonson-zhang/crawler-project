const fs = require('fs');
const code = fs.readFileSync('QQ音乐/vendor.chunk.js', 'utf-8');

const pushIdx = code.indexOf('.push(');
let pd = 1, end = pushIdx + 6, inS = false;
for (let i = end; i < code.length; i++) {
  const ch = code[i];
  if (ch === '"' && code[i-1] !== '\\') inS = !inS;
  if (!inS) {
    if (ch === '(') pd++;
    if (ch === ')') { pd--; if (pd === 0) { end = i; break; } }
  }
}
const fullArg = code.substring(pushIdx + 6, end);

// Parse top-level array elements (at depth 1 inside outer array)
// fullArg = [[0], [modules...]]
// Depth 0: start. Depth 1: inside outer array. We track when depth goes 1->2 for sub-arrays.
let td = 0, ts = false;
let curStart = null;
let elements = [];
for (let i = 0; i < fullArg.length; i++) {
  const ch = fullArg[i];
  if (ch === '"' && fullArg[i-1] !== '\\') ts = !ts;
  if (!ts) {
    if (ch === '[' || ch === '{') {
      if (td === 0) curStart = i; // start of outer array
      td++;
    }
    if (ch === ']' || ch === '}') {
      td--;
      if (td === 0 && curStart !== null) {
        // end of outer array
        elements.push({
          start: curStart, end: i,
          preview: fullArg.substring(curStart, Math.min(curStart + 60, i + 1)),
          isArray: ch === ']',
        });
        curStart = null;
      }
    }
    if (ch === ',' && td === 1) {
      // top-level comma in outer array - split elements
    }
  }
}

// Actually let me just split by finding commas at depth 1
console.log('fullArg first 100:', fullArg.substring(0, 100));

let d1parts = [];
let d = 0, s = false;
let pstart_idx = 0;
for (let i = 0; i < fullArg.length; i++) {
  const ch = fullArg[i];
  if (ch === '"' && fullArg[i-1] !== '\\') s = !s;
  if (!s) {
    if (ch === '[' || ch === '{') d++;
    if (ch === ']' || ch === '}') d--;
    if (ch === ',' && d === 1) {
      d1parts.push(fullArg.substring(pstart_idx, i));
      pstart_idx = i + 1;
    }
  }
}
// Last part (after last comma, up to outer ])
if (fullArg.length > 0) {
  // The outer array ends with ]. Let me find the last ]
  let lastD = 0, lastS = false;
  for (let i = fullArg.length - 1; i >= 0; i--) {
    const ch = fullArg[i];
    if (ch === '"' && fullArg[i-1] !== '\\') lastS = !lastS;
    if (!lastS) {
      if (ch === ']') lastD++;
      if (ch === '[') lastD--;
      if (lastD < 0) { /* end of outer array */ break; }
    }
  }
  d1parts.push(fullArg.substring(pstart_idx, fullArg.length - 1));
}

console.log('Parts at depth 1:', d1parts.length);
d1parts.forEach((p, i) => {
  console.log(`Part ${i}: length=${p.length}, starts: "${p.trim().substring(0, 80)}"`);
  console.log(`  ends: "${p.trim().substring(Math.max(0, p.trim().length - 40))}"`);
});

// Now part 1 should be the modules array
if (d1parts.length >= 2) {
  let modArr = d1parts[1].trim();
  // Remove outer [ ]
  if (modArr.startsWith('[')) modArr = modArr.substring(1);
  if (modArr.endsWith(']')) modArr = modArr.substring(0, modArr.length - 1);

  // Count top-level entries
  let md = 0, ms3 = false;
  let comma_pos = [];
  for (let i = 0; i < modArr.length; i++) {
    const ch = modArr[i];
    if (ch === '"' && modArr[i-1] !== '\\') ms3 = !ms3;
    if (!ms3) {
      if (ch === '[' || ch === '{') md++;
      if (ch === ']' || ch === '}') md--;
      if (ch === ',' && md === 0) comma_pos.push(i);
    }
  }
  console.log('\n=== MODULES ===');
  console.log('Comma count:', comma_pos.length);
  console.log('Module count:', comma_pos.length + 1);

  // Show entries around 125-128
  if (comma_pos.length >= 130) {
    for (let m of [124, 125, 126, 127, 128]) {
      const start = m === 0 ? 0 : comma_pos[m - 1] + 1;
      const end = m < comma_pos.length ? comma_pos[m] : modArr.length;
      const entry = modArr.substring(start, end + 1).trim();
      var preview = entry.substring(0, 100);
      console.log('Module ' + m + ': ' + preview);
    }
  } else {
    console.log('Less than 130 modules. First 5 entries:');
    for (let m = 0; m < 5 && m <= comma_pos.length; m++) {
      const start = m === 0 ? 0 : comma_pos[m - 1] + 1;
      const end = m < comma_pos.length ? comma_pos[m] : modArr.length;
      const entry = modArr.substring(start, end + 1).trim();
      console.log(`Module ${m}: starts with "${entry.substring(0, 80)}"`);
    }
    console.log('Last 3 entries:');
    for (let m = Math.max(0, comma_pos.length - 2); m <= comma_pos.length; m++) {
      const start = m === 0 ? 0 : comma_pos[m - 1] + 1;
      const end = m < comma_pos.length ? comma_pos[m] : modArr.length;
      const entry = modArr.substring(start, end + 1).trim();
      console.log(`Module ${m}: starts with "${entry.substring(0, 80)}"`);
    }
  }
}
