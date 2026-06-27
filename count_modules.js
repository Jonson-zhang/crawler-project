const fs = require('fs');
const code = fs.readFileSync('QQ音乐/vendor.chunk.js', 'utf-8');

// The push format is: push([[0], [modules...]])
// Find the push argument
const pushStart = code.indexOf('.push(');
// Trace parenthesis to find argument end
let parenDepth = 0, pInStr = false;
let argEnd = pushStart + 6;
for (let i = argEnd; i < code.length; i++) {
  const ch = code[i];
  if (ch === '"' && code[i-1] !== '\\') pInStr = !pInStr;
  if (!pInStr) {
    if (ch === '(') parenDepth++;
    if (ch === ')') { parenDepth--; if (parenDepth < 0) { argEnd = i; break; } }
  }
}
const fullArg = code.substring(pushStart + 6, argEnd);

// Now parse the top-level array structure
// fullArg = [[chunkIds], [modules], [maybeAsync?]]
// Find top-level commas (at depth 0 of the outer array)
let tld = 0, tls = false;
let parts = [];
let pstart = 1; // skip first [
for (let i = 1; i < fullArg.length; i++) {
  const ch = fullArg[i];
  if (ch === '"' && fullArg[i-1] !== '\\') tls = !tls;
  if (!tls) {
    if (ch === '[' || ch === '{') tld++;
    if (ch === ']' || ch === '}') tld--;
    if (ch === ',' && tld === 0) {
      parts.push(fullArg.substring(pstart, i).trim());
      pstart = i + 1;
    }
    if (ch === ']' && tld === -1) {
      parts.push(fullArg.substring(pstart, i).trim());
      break;
    }
  }
}

console.log('Parts count:', parts.length);
console.log('Part 0 (chunkIds):', parts[0].substring(0, 80));
if (parts.length >= 2) {
  const modArr = parts[1];
  console.log('Part 1 (modules) length:', modArr.length);
  console.log('Part 1 starts:', modArr.substring(0, 100));
  console.log('Part 1 ends:', modArr.substring(modArr.length - 100));

  // Count top-level entries in the modules array
  // Each module entry is separated by comma at depth 0
  let md = 0, ms = false;
  let entryStarts = [];
  for (let i = 0; i < modArr.length; i++) {
    const ch = modArr[i];
    if (ch === '"' && modArr[i-1] !== '\\') ms = !ms;
    if (!ms) {
      if (ch === '[' || ch === '{') md++;
      if (ch === ']' || ch === '}') md--;
      if (ch === ',' && md === 0) {
        entryStarts.push(i);
      }
    }
  }
  console.log('Comma count (top-level entries - 1):', entryStarts.length);
  console.log('Total modules:', entryStarts.length + 1);
  console.log('Comma positions first 5:', entryStarts.slice(0, 5));
  console.log('Comma positions last 5:', entryStarts.slice(-5));

  // Show entries around position 126
  if (entryStarts.length >= 130) {
    console.log('Entry 125 start:', entryStarts[124]);
    console.log('Entry 126 start:', entryStarts[125]);
    console.log('Entry 127 start:', entryStarts[126]);
    // Show content
    const e125 = modArr.substring(entryStarts[124] + 1, entryStarts[125]).trim().substring(0, 80);
    const e126 = modArr.substring(entryStarts[125] + 1, entryStarts[126]).trim().substring(0, 80);
    const e127 = modArr.substring(entryStarts[126] + 1, entryStarts.length).trim().substring(0, 80);
    console.log('Entry 125:', e125);
    console.log('Entry 126:', e126);
    console.log('Entry 127:', e127);
  }
}

if (parts.length >= 3) {
  console.log('Part 2 (async):', parts[2].substring(0, 100));
}
