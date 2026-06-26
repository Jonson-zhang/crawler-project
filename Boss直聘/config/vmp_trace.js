/**
 * VMP Trace & Extract — Boss直聘 security-7c91433f.js
 *
 * Traces the p-state machine from ABC.z() entry to return,
 * extracts only the actually-executed code path.
 *
 * Usage: node config/vmp_trace.js <seed> <ts>
 */

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// ===== Step 1: Extract all switch/case maps from the VMP =====
// The VMP dispatcher pattern: while(p!==void 0){var W=31&p,j=31&p>>5,F=31&p>>10;switch(W){case N:...}}

// Extract the p-state machine table
// Each case body ends with: p = <value> or p = condition ? A : B
// We need to build: stateMap[p] = { code, next: [possible next p values] }

var pAssignRegex = /p=(\d+)/g;
var pCondRegex = /p=([^;]*)\?(\d+):(\d+)/g;

// Find all p-value assignments to build the state space
var allPValues = new Set();
var match;
while ((match = pAssignRegex.exec(code)) !== null) {
    allPValues.add(parseInt(match[1]));
}
while ((match = pCondRegex.exec(code)) !== null) {
    allPValues.add(parseInt(match[2]));
    allPValues.add(parseInt(match[3]));
}
console.error('Unique p-values in VMP:', allPValues.size);
console.error('Range:', Math.min(...allPValues), 'to', Math.max(...allPValues));

// ===== Step 2: Find the ABC entry points =====
// From our earlier analysis, ABC.z() calls l.apply(this, [seed, ts])
// The entry p-values are hardcoded in the VMP as wrappers
// e.g. Kl='yzABC' -> some p-value -> ...

// Let's find where ABC is defined by searching for the constructor wrappers
// ABC is defined as: E = function p() { return l.apply(this, [1219].concat(...)) }
// The p=1219 is the entry for ABC constructor

// Find all p=NUM closure wrappers
var entryWrappers = [];
var wrapperRegex = /(?:(\w+)=)?function\s+\w*\s*\(\s*\)\s*\{\s*return\s+l\.apply\s*\(\s*this\s*,\s*\[(\d+)\]\s*\.concat\s*\(\s*Array\.prototype\.slice\.call\s*\(\s*arguments\s*\)\s*\)\s*\)\s*\}/g;
while ((match = wrapperRegex.exec(code)) !== null) {
    entryWrappers.push({ name: match[1] || 'anon', entry: parseInt(match[2]) });
}
console.error('Entry wrappers found:', entryWrappers.length);
entryWrappers.slice(0, 20).forEach(function(w) {
    console.error('  ', w.name, '-> p=' + w.entry);
});

// ===== Step 3: Build the full state transition graph =====
// We need to parse the code to extract: for each p value, what code executes and what p comes next

// The VMP structure is:
// switch(W=31&p) {
//   case 0: var zSl = function() {
//     switch(j=31&p>>5) {
//       case 0: var a = function() {
//         if (F=31&p>>10 === 0) { ... ; p = X }
//         else if (F === 1) { ... ; p = Y }
//         ...
//       }.apply(this, arguments); if (a) return a; break;
//       case 1: ...
//     }
//   }.apply(this, arguments); if (zSl) return zSl[0]; break;
//   case 1: ...
// }

// For each p, decode: W = p&31, j = (p>>5)&31, F = (p>>10)&31

function decodeState(p) {
    return { W: p & 31, j: (p >> 5) & 31, F: (p >> 10) & 31 };
}

// Step 4: Execute the VMP in "symbolic" mode in Node.js
// Actually run the VMP with hooks to trace exactly which p values are visited
var vm = require('vm');

var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math, RegExp, Error,
    parseInt, parseFloat, JSON, Promise, Symbol,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined,
    console: { log: function(){}, error: function(){}, warn: function(){} },
    crypto: { getRandomValues: function(a) { for (var i = 0; i < a.length; i++) a[i] = i % 256; return a; } },
    btoa: function(s) { return Buffer.from(s).toString('base64'); },
    atob: function(s) { return Buffer.from(s, 'base64').toString(); },
    navigator: { userAgent: 'x', webdriver: false, hardwareConcurrency: 8, language: 'en-US', languages: ['en-US', 'en'] },
    document: { cookie: '', createElement: function() { return {}; } },
    location: { href: '' }, screen: {}, history: {}, localStorage: {}, sessionStorage: {},
    performance: { now: function() { return 1; }, memory: {} },
    XMLHttpRequest: function(){}, Image: function(){}, MutationObserver: function(){}, Event: function(){},
};
sandbox.window = sandbox; sandbox.self = sandbox;

// Inject trace into the VMP to log every p-assignment
// Replace: p=N with p=__t(N) and p=cond?A:B with p=__tc(cond,A,B)
var _traceLog = [];
var _traceSet = new Set();
var injectedCode = code;

// Simple regex: capture all p=NUMBER patterns
injectedCode = injectedCode.replace(/([^a-zA-Z_$.])p=(\d+)([;}])/g, function(m, prefix, num, suffix) {
    return prefix + 'p=__t(' + num + ')' + suffix;
});

// Conditional: p=cond?A:B
injectedCode = injectedCode.replace(/p=([^;]*?)\?(\d+):(\d+)([;}])/g, function(m, cond, a, b, suffix) {
    return 'p=__tc(' + cond + ',' + a + ',' + b + ')' + suffix;
});

// Also catch: p = void N ? A : B  (used for else-branches)
injectedCode = injectedCode.replace(/p=void (\d+)\?(\d+):(\d+)/g, function(m, voidVal, a, b) {
    return 'p=__tc(void ' + voidVal + ',' + a + ',' + b + ')';
});

sandbox.__t = function(v) {
    if (!_traceSet.has(v)) {
        _traceLog.push({ p: v, W: v & 31, j: (v>>5)&31, F: (v>>10)&31 });
        _traceSet.add(v);
    }
    return v;
};
sandbox.__tc = function(cond, a, b) {
    var v = cond ? a : b;
    if (!_traceSet.has(v)) {
        _traceLog.push({ p: v, W: v & 31, j: (v>>5)&31, F: (v>>10)&31, cond: true });
        _traceSet.add(v);
    }
    return v;
};

// Run
var ctx = vm.createContext(sandbox);
new vm.Script(injectedCode).runInContext(ctx);

console.error('Running ABC.z() with trace...');
var seed = process.argv[2] || 'VsbTBCOID71h+OzSxBLPKa6ThkqrBFYaqfGa+QWt9qQ=';
var ts = parseInt(process.argv[3]) || 1782478485106;
var token = new sandbox.ABC().z(seed, ts);

console.error('Token len:', token.length);

// Output trace
console.error('Total unique p-states visited:', _traceLog.length);
_traceLog.forEach(function(s) {
    console.log(JSON.stringify(s));
});

// Output token separately
process.stderr.write('TOKEN:' + token + '\n');
