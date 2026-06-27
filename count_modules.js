const fs = require('fs');
const code = fs.readFileSync('QQ音乐/vendor.chunk.js', 'utf-8');

const pushIdx = code.indexOf('.push(');
var pd = 1, end = pushIdx + 6, inS = false;
for (var i = end; i < code.length; i++) {
  var ch = code[i];
  if (ch === '"' && code[i-1] !== '\\') inS = !inS;
  if (!inS) {
    if (ch === '(') pd++;
    if (ch === ')') { pd--; if (pd === 0) { end = i; break; } }
  }
}
var fullArg = code.substring(pushIdx + 6, end);

console.log('fullArg first 100:', fullArg.substring(0, 100));

// Split by commas at depth 1
var depthParts = [];
var d = 0, s = false;
var pstart = 0;
for (var j = 0; j < fullArg.length; j++) {
  var c = fullArg[j];
  if (c === '"' && fullArg[j-1] !== '\\') s = !s;
  if (!s) {
    if (c === '[' || c === '{') d++;
    if (c === ']' || c === '}') d--;
    if (c === ',' && d === 1) {
      depthParts.push(fullArg.substring(pstart, j));
      pstart = j + 1;
    }
  }
}
// Add last part, stripping the outer ]
var outerEnd = fullArg.length - 1;
while (outerEnd >= 0 && fullArg[outerEnd] !== ']') outerEnd--;
depthParts.push(fullArg.substring(pstart, outerEnd));

console.log('Parts at depth 1:', depthParts.length);
var partsPreview = depthParts.map(function(p, idx) {
  return 'Part ' + idx + ': len=' + p.trim().length + ' starts="' + p.trim().substring(0, 60) + '"';
});
partsPreview.forEach(function(s) { console.log(s); });

// Part 1 = modules array
if (depthParts.length >= 2) {
  var modArr = depthParts[1].trim();
  if (modArr[0] === '[') modArr = modArr.substring(1);
  if (modArr[modArr.length - 1] === ']') modArr = modArr.substring(0, modArr.length - 1);

  // Count entries
  var md = 0, ms3 = false;
  var cpos = [];
  for (var k = 0; k < modArr.length; k++) {
    var c2 = modArr[k];
    if (c2 === '"' && modArr[k-1] !== '\\') ms3 = !ms3;
    if (!ms3) {
      if (c2 === '[' || c2 === '{') md++;
      if (c2 === ']' || c2 === '}') md--;
      if (c2 === ',' && md === 0) cpos.push(k);
    }
  }
  console.log('\n=== MODULES ===');
  console.log('Comma count:', cpos.length);
  console.log('Module count:', cpos.length + 1);

  function showModule(idx) {
    var s = idx === 0 ? 0 : cpos[idx - 1] + 1;
    var e = idx < cpos.length ? cpos[idx] : modArr.length;
    var entry = modArr.substring(s, e).trim();
    console.log('Module ' + idx + ' (' + s + '..' + e + '): ' + entry.substring(0, 100));
  }

  if (cpos.length >= 130) {
    for (var m = 124; m <= 128; m++) showModule(m);
  } else {
    console.log('Total modules:', cpos.length + 1);
    for (var n = 0; n < Math.min(5, cpos.length + 1); n++) showModule(n);
    console.log('...');
    for (var p = Math.max(0, cpos.length - 2); p <= cpos.length; p++) showModule(p);
  }
}
