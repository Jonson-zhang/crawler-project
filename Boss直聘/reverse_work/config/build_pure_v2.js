/**
 * BUILD PURE ALGORITHM v2 — Direct trace-based compilation
 *
 * For each state the browser visited:
 *   1. Find the operation in the source code
 *   2. For conditionals (p = X ? A : B), check which p the browser actually went to
 *   3. Emit resolved operations
 *   4. Skip pure p=N transitions (no business logic)
 *
 * Uses CPP (Constant Propagation + Path resolution)
 */
var fs = require('fs');
var s = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

// Load browser trace
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build p → next_p (first occurrence)
var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

// Extract code for EACH unique p value from the source
// Strategy: for each p in trace, find the code at the dispatch point

// === Find all p=N assignments in source code ===
// regex: match patterns like: ..., p = 12345)
var pAssignRegex = /(,?\s*)([a-zA-Z_$][\w$.]*\s*=\s*[^,;]+?,\s*)?p\s*=\s*(\d+|void 0)(?:\s*[;,)]|$)/g;
// Simpler: find all "p = <number>" patterns
var allPAssigns = [];
var re = /p\s*=\s*(\d+)/g;
var m;
while ((m = re.exec(s)) !== null) {
    var pVal = parseInt(m[1]);
    // Extract surrounding context (the operation part before p=)
    var ctxStart = Math.max(0, m.index - 200);
    var ctx = s.substring(ctxStart, m.index + m[0].length);

    // Find the START of this operation (beginning of expression or after previous ;)
    // Go backwards to find the start of the expression containing this p=
    var exprStart = m.index;
    var depth = 0;
    for (var j = m.index - 1; j >= Math.max(0, m.index - 300); j--) {
        if (s[j] === ')' || s[j] === ']') depth++;
        else if (s[j] === '(' || s[j] === '[') depth--;
        else if (s[j] === '?' || s[j] === ':') { /* in ternary */ }
        else if (depth === 0 && (s[j] === ';' || s[j] === '{' || s[j] === '}' || s.substring(j-5, j+1) === 'break;')) {
            exprStart = j + 1;
            break;
        }
    }

    var opCode = s.substring(exprStart, m.index + m[0].length).trim();
    // Clean up
    opCode = opCode.replace(/^[;,]\s*/, '').replace(/\s+$/, '');

    allPAssigns.push({ p: pVal, ops: opCode, pos: m.index });
}

console.log('Found', allPAssigns.length, 'p=N assignments in source');

// === Build p → operations mapping ===
var pToOps = {};
allPAssigns.forEach(function(a) {
    // Extract business operations (everything before p=N)
    var ops = a.ops;
    // Remove trailing "p = N" to get business logic
    ops = ops.replace(/,?\s*p\s*=\s*\d+\s*$/, '');
    if (ops.trim() === '' || ops.trim() === 'p = ' + a.p) return;

    // Deduplicate: use shortest version
    if (!pToOps[a.p] || ops.length < pToOps[a.p].length) {
        pToOps[a.p] = ops;
    }
});

// Also search for CONDITIONAL p assignments: p = X ? A : B
var condPAssigns = [];
var condRe = /p\s*=\s*(\w[\w.]*(?:\s*[!=><]+\s*\w[\w.]*)?)\s*\?\s*(\d+)\s*:\s*(\d+)/g;
while ((m = condRe.exec(s)) !== null) {
    condPAssigns.push({ condition: m[1], pTrue: parseInt(m[2]), pFalse: parseInt(m[3]), pos: m.index });
}
console.log('Found', condPAssigns.length, 'conditional p assignments');

// === Walk the browser trace and generate operations ===
var emitted = [];
var seen = {};
var lastOps = '';

trace.forEach(function(p, idx) {
    var ops = pToOps[p];
    if (!ops || ops === lastOps) return;
    lastOps = ops;

    // Check if this is a conditional (p = X ? A : B)
    // We need to resolve which branch was actually taken
    var nextP = nextMap[p];
    if (!nextP) return;

    // Replace conditional p assignments with the actual browser choice
    var resolvedOps = ops;
    condPAssigns.forEach(function(c) {
        if (ops.indexOf('p = ' + c.condition + ' ?') >= 0 ||
            ops.indexOf('p = ' + c.condition + '?') >= 0) {
            // Browser chose pTrue or pFalse?
            if (nextP === c.pTrue) {
                resolvedOps = ops.replace(/p\s*=\s*\w[\w.]*\s*\?\s*\d+\s*:\s*\d+/, '// COND: chose ' + c.pTrue);
            } else if (nextP === c.pFalse) {
                resolvedOps = ops.replace(/p\s*=\s*\w[\w.]*\s*\?\s*\d+\s*:\s*\d+/, '// COND: chose ' + c.pFalse);
            }
        }
    });

    emitted.push(resolvedOps);
    seen[p] = true;
});

console.log('Emitted', emitted.length, 'unique operations');

// === Generate clean JS ===
var lines = [];
lines.push('// Pure algorithm extracted from browser VMP trace');
lines.push('// ' + emitted.length + ' operations, trace length ' + trace.length);
lines.push('');
lines.push('function generateToken(seed, ts) {');
lines.push('  // VMP interpreter variables');
lines.push('  var p, a, _, c, e, t, y, o, v, r, n, i, s, d, h, u, m, g, f, S, b, C, E, R, T, A, M, D, L, G, x, N, P, V, w, I, B, O, k, W, j, F, z, H, U, J, Z, K, X, Q, q, Y, $;');
lines.push('  // All VMP two-letter variables (comprehensive)');
lines.push('  var pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,bl,Cl,El,Rl,Tl,Al,Ml,Dl,Ll,Gl,xl,Nl,Pl,Vl,wl,Il,Bl,Ol,kl,Wl,jl,Fl,zl,Hl,Ul,Jl,Zl,Kl,Xl,Ql,ql,Yl,$l;');
lines.push('');

emitted.forEach(function(ops) {
    if (!ops || ops.trim() === '') return;
    lines.push('  ' + ops + ';');
});

lines.push('');
lines.push('  return pp || "";');
lines.push('}');
lines.push('');
lines.push('module.exports = { generateToken: generateToken };');

fs.writeFileSync(__dirname + '/pure_algo_v2.js', lines.join('\n'));
console.log('Saved pure_algo_v2.js (' + lines.length + ' lines)');

// Stats
console.log('\n=== Operation type breakdown ===');
var stats = { str: 0, num: 0, math: 0, cond: 0, fn: 0, other: 0 };
emitted.forEach(function(o) {
    if (!o) return;
    if (/=\s*"[^"]*"/.test(o)) stats.str++;
    else if (/=\s*\d+\s*$/.test(o)) stats.num++;
    else if (/[&|^~+\-*/]/.test(o)) stats.math++;
    else if (/p\s*=\s*\w+\s*\?/.test(o)) stats.cond++;
    else if (/function/.test(o)) stats.fn++;
    else stats.other++;
});
console.log(stats);
