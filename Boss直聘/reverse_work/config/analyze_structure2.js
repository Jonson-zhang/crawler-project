/**
 * Analyze security-11f5a2fc.js structure v2
 * The whole file is !function(){...}() IIFE
 */
var fs = require('fs');
var s = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

console.log('Total size:', s.length, 'chars');
console.log('Starts with:', s.substring(0, 100));
console.log('Ends with:', s.substring(s.length - 100));

// The file is: !function(){try{...}catch(l){}}();
// Let's find the try block body
var tryIdx = s.indexOf('try{');
console.log('try{ at:', tryIdx);

// Find matching catch
var catchIdx = s.indexOf('}catch(');
console.log('}catch( at:', catchIdx);

// The body between try{ and }catch(
var body = s.substring(tryIdx + 4, catchIdx);
console.log('\nBody length:', body.length);

// First 2000 chars of body
console.log('\n=== Body first 2000 ===');
console.log(body.substring(0, 2000));

// Last 1000 chars of body
console.log('\n=== Body last 1000 ===');
console.log(body.substring(body.length - 1000));

// Find all var declarations in body (top-level inside try)
var varDecls = [];
var i = 0;
while (i < body.length) {
    var m = body.substring(i).match(/^var\s+(\w+)\s*=\s*/);
    if (!m) break;
    varDecls.push({name: m[1], pos: i});
    i += m[0].length;
    // Skip to next var or semicolon
    var nextVar = body.indexOf('var ', i);
    if (nextVar < 0) break;
    i = nextVar;
}
console.log('\n=== Var declarations at start ===');
varDecls.forEach(function(v) {
    var excerpt = body.substring(v.pos, v.pos + 80).replace(/\n/g, '\\n');
    console.log('  var ' + v.name + ': ' + excerpt);
});

// Look for key patterns in the body
console.log('\n=== Key patterns ===');
var patterns = [
    'switch(wp)', 'switch(dp)', 'switch(hp)',
    'function l(', 'function N(', 'function ABC',
    'class ABC', 'ABC.z', 'new ABC',
    'for(;p!==', 'for (; p !==',
];
patterns.forEach(function(pat) {
    var idx = body.indexOf(pat);
    if (idx >= 0) console.log('  FOUND: "' + pat + '" at pos ' + idx);
    else console.log('  NOT FOUND: "' + pat + '"');
});

// Type of first array elements
// Find the first large array literal
var firstArr = body.match(/=\[([\s\S]+?)\];/);
if (firstArr) {
    console.log('\n=== First array literal (first 400 chars) ===');
    console.log(firstArr[1].substring(0, 400));
    console.log('\n=== First array literal (last 400 chars) ===');
    console.log(firstArr[1].substring(firstArr[1].length - 400));
}
