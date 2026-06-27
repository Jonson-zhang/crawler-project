/**
 * Generate FORCED-PATH VMP — replaces ALL p=N with browser trace values
 *
 * Key difference from earlier attempts:
 * - For p = X ? A : B: replace with p = <browser_chosen_value>
 * - For p = N: keep as-is, will be overridden by browser trace
 * - For nested l.apply(): use browser trace to resolve sub-call's return value
 */
var fs = require('fs');

// Load trace
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build next-p mapping
var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

// Load source
var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

// Strategy: inject a lookup table and override function
// At the TOP of the VMP code, add:
//   var __NP = new Map([[17862,19459],[19459,13575],...]);
// Then replace every p=N with p=__NP.get(p)??N

// Simplify: add a helper function
var preamble = `
var __TRACE=[${trace.join(',')}];
var __IDX=0;
var __CALLS=0;
function __next(){
    if (__IDX>=__TRACE.length) return void 0;
    if (++__CALLS>20000) throw new Error('__next() called >20000 times, possible infinite loop');
    return __TRACE[__IDX++];
}
`;

// Replace ALL p = N (including p = void 0) with p = __next()
// Also replace p = X ? A : B → p = __next() (ignore the conditional)
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(n) { return generator(n).code; }

var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
var traverse = require('@babel/traverse').default;
var count = 0;

traverse(ast, {
    AssignmentExpression: function(path) {
        var node = path.node;
        if (!t.isIdentifier(node.left) || node.left.name !== 'p') return;

        // Must be inside l()
        var anc = path.parentPath;
        var insideL = false;
        while (anc) {
            if (anc.node && anc.node.type === 'FunctionDeclaration' &&
                anc.node.id && anc.node.id.name === 'l') { insideL = true; break; }
            anc = anc.parentPath;
        }
        if (!insideL) return;

        // Replace with p = __next() (skip if already done)
        var rhs = node.right;
        if (t.isCallExpression(rhs) && t.isIdentifier(rhs.callee) && rhs.callee.name === '__next') return;
        path.replaceWith(
            t.assignmentExpression('=', t.identifier('p'),
                t.callExpression(t.identifier('__next'), []))
        );
        count++;
    }
});

var output = gen(ast);

// Insert preamble BEFORE function l() — global scope
// After AST generation, the function might have different formatting
var lStart = output.indexOf('function l(');
if (lStart < 0) lStart = output.indexOf('function l (');
if (lStart < 0) lStart = output.indexOf('l(){try{');
if (lStart > 0) lStart = output.lastIndexOf('function', lStart);
// The preamble needs to be in the outer IIFE scope (second IIFE)
// Find the second comma-function pattern: }(),function(){
var iife2start = output.indexOf('}(),function');
if (iife2start > 0) {
    // Insert after the opening of the second IIFE
    var insertPos = output.indexOf('{', iife2start) + 1;
    output = output.substring(0, insertPos) + preamble + output.substring(insertPos);
} else if (lStart > 0) {
    output = output.substring(0, lStart) + preamble + output.substring(lStart);
} else {
    output = preamble + output;
}
console.error('Preamble inserted at position:', output.indexOf('var __TRACE='));

fs.writeFileSync(__dirname + '/security-forced-v2.js', output);
console.log('Replaced', count, 'p-assignments with __next()');
console.log('Trace length:', trace.length);
console.log('Output:', output.length, 'bytes');

// Test
console.log('\nTesting with minimal env...');
Function.prototype.toString = function(){return ''};
global.location = { hostname:'127.0.0.1', href:'http://127.0.0.1:8899/test_browser.html' };
global.document = { cookie:'', createElement:function(){ return { getContext:function(){return null} } }, body:{}, head:{}, hidden:false, visibilityState:'visible', readyState:'complete', characterSet:'UTF-8', all:undefined };
global.navigator = { cookieEnabled:true, userAgent:'Mozilla/5.0', platform:'Win32', plugins:{length:5}, mimeTypes:{length:2}, webdriver:false };
global.screen = { width:1280, height:720, colorDepth:24, pixelDepth:24 };
global.window=global; global.self=global;
global.localStorage = { setItem:function(){}, getItem:function(){return null}, length:0 };
global.performance = { now:function(){return Date.now()}, memory:{}, navigation:{type:0}, timing:{navigationStart:Date.now()} };
global.crypto = { getRandomValues:function(a){for(var i=0;i<a.length;i++)a[i]=0;return a} };
global.btoa = function(s){return Buffer.from(s).toString('base64')};
global.atob = function(s){return Buffer.from(s,'base64').toString()};
// Don't kill our own console - the VMP doesn't use console much
// global.console = { log:function(){}, error:function(){} };
var _elog = process.stderr.write.bind(process.stderr);
// Pass through all console.xxx to stderr
global.console = { log: _elog, error: _elog, warn: _elog, info: _elog, debug: _elog };
global.OfflineAudioContext = function(){return{ destination:{}, startRendering:function(){return{then:function(f){f('')}}}, sampleRate:44100 }};
global.MutationObserver = function(){this.observe=function(){}};
global.eval = eval;

console.error('Eval start...', output.length, 'bytes');
try { eval(output); } catch(e) { console.error('Eval error:', e.message, e.stack ? e.stack.substring(0,100) : ''); process.exit(1); }
console.error('Eval done, ABC:', typeof ABC);
var t0 = Date.now();
console.error('ABC type:', typeof ABC);
try {
    var token = new ABC().z('testXYZ', 1700000000000);
    var t1 = Date.now();
    console.error('ABC.z() returned:', typeof token, 'in', (t1-t0), 'ms');
    console.error('Token:', token ? token.length : 'UNDEF', token ? token.substring(0,20) : 'UNDEF');
    if (token) process.stdout.write(token);
    else process.exit(1);
} catch(e) {
    console.error('ABC.z() threw:', e.message);
    process.exit(1);
}
process.stdout.write(token);
