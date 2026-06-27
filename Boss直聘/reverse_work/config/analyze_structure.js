/**
 * Analyze security-11f5a2fc.js structure
 */
var fs = require('fs');
var s = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

console.log('Total size:', s.length, 'chars');

// Find var t array
var tIdx = s.indexOf('var t=[');
console.log('var t=[ at:', tIdx);

// Find end of var t by bracket matching
function findArrayEnd(str, startIdx) {
    // startIdx is position of '['
    var depth = 0;
    var inString = false;
    var stringChar = '';
    for (var i = startIdx; i < str.length; i++) {
        var ch = str[i];
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === stringChar) inString = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
        if (ch === '[') depth++;
        if (ch === ']') {
            if (depth === 0) return i;
            depth--;
        }
    }
    return -1;
}

var tArrStart = tIdx + 'var t=['.length - 1; // position of first '['
var tArrEnd = findArrayEnd(s, tArrStart);
console.log('var t array ends at:', tArrEnd, 'total length:', tArrEnd - tIdx + 1);

// Extract first elements
var tContent = s.substring(tArrStart + 1, tArrEnd);
// Split by commas (rough - but good enough for first elements)
var firstFew = tContent.substring(0, 500);
console.log('\n=== var t first 500 chars ===');
console.log(firstFew);

// Middle section
console.log('\n=== var t middle 200 chars ===');
var mid = Math.floor(tContent.length / 2);
console.log(tContent.substring(mid - 100, mid + 100));

// Last 500 chars
console.log('\n=== var t last 500 chars ===');
console.log(tContent.substring(tContent.length - 500));

// Check: does it contain base64 strings or function code?
var hasBase64 = /[A-Za-z0-9+\/=]{40,}/.test(tContent);
var hasFunction = /function/.test(tContent);
console.log('\nHas base64 strings:', hasBase64);
console.log('Has function keyword:', hasFunction);

// Now var n
var nIdx = s.indexOf('var n=[', tArrEnd);
console.log('\nvar n=[ at:', nIdx);
var nArrStart = nIdx + 'var n=['.length - 1;
var nArrEnd = findArrayEnd(s, nArrStart);
console.log('var n array ends at:', nArrEnd, 'total length:', nArrEnd - nIdx + 1);

// What's between var t and var n?
console.log('\n=== Between var t end and var n ===');
console.log(s.substring(tArrEnd + 1, nIdx).substring(0, 200));

// After var n
console.log('\n=== After var n ===');
console.log(s.substring(nArrEnd + 1, nArrEnd + 200));

// Find ABC definition area
var abcIdx = s.indexOf('"ABC"');
if (abcIdx > 0) {
    console.log('\n=== Around "ABC" at', abcIdx, '===');
    console.log(s.substring(abcIdx - 200, abcIdx + 200));
}

// Find end of file structure
console.log('\n=== Last 500 chars ===');
console.log(s.substring(s.length - 500));
