/**
 * Force Browser Path in VMP
 *
 * Strategy: for each (W,j) combination, the browser took a specific F value.
 * We patch the VMP code to hardcode F to the browser's choice at every branch.
 *
 * This eliminates all environment-dependent branching.
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// Browser trace — extract (W,j) → browser's F choice
var browserTrace = [
    14887,11814,4399,21867,
    3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,
    2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,
    // 16974 × 602
    ...Array(602).fill(16974),
    ...Array(36).fill([10689,16974]).flat(),
    ...Array(392).fill(2164),
    3218,2273,15635,2273,14473,3218,2273,15635,2273,14371,
    3218,2273,15635,2273,7762,3218,
    ...Array(6).fill(1481),
    1219,2096,6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,
    2273,22017,2273,22017,2273,22017,2273,15635,2273,16420,
    2273,15878,12497,3218,14635,2273,15635,2273,10287,3218,
    ...Array(3).fill(1481),
    ...Array(7).fill(2273),
    15635,2273,14704,15635,2273,5285,3218,15635,2273,1709,
    15635,2273,397,15635,2273,6735,2273,15635,2273,16420,
    2273,15635,2273,13760,2051,3218,
    ...Array(8).fill(2273),
    15635,2273,18928,15635,2273,14406,15635,2273,7178,
    3218,2273,15635,2273,7279,7299,2273,20906,3208,
    2273,20843,2273,3208,2273,20843,2273,
    15635,2273,15635,2273,15635,2273,7279,7299,10734,
    3218,2273,20492,3216,3655,20754,3463
];

// Decode each browser state to (W,j,F)
var browserPath = {}; // key: "W,j" → preferred F
browserTrace.forEach(function(s) {
    var w = s & 31, j = (s >> 5) & 31, f = (s >> 10) & 31;
    var key = w + ',' + j;
    // Only store first occurrence (that's the browser's path)
    if (!(key in browserPath)) {
        browserPath[key] = f;
    }
});

console.log('Browser path entries: ' + Object.keys(browserPath).length);

// Now patch the original security JS
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Strategy: at every FSl ternary chain, find the browser's desired F,
// and replace the ternary with: (ops_for_browser_F, p=browser_next)
// This is done by pre-computing the replacement for each W/j

// For each W/j combination, find the state entry and get the browser state
// stateKey = (F << 10) | (j << 5) | W
// From browserPath we know W and j and preferred F
// So browser state = (browserF << 10) | (j << 5) | W

// Build a map: stateKey → replacement code string
var replacements = {};
Object.keys(browserPath).forEach(function(key) {
    var parts = key.split(','), w = parseInt(parts[0]), j = parseInt(parts[1]);
    var browserF = browserPath[key];
    var browserState = (browserF << 10) | (j << 5) | w;
    var entry = stateMap[browserState];
    if (!entry) return;

    // Build replacement: the operations followed by p=newNext
    var repl = '';
    if (entry.ops && entry.ops.length > 0) {
        var opParts = entry.ops.map(function(o) { return '(' + o.left + '=' + o.right + ')'; });
        repl = opParts.join(',') + ',';
    }
    if (entry.next && entry.next.length > 0) {
        var nextVal = entry.next[0];
        if (typeof nextVal !== 'number') {
            // find first numeric
            for (var i = 0; i < entry.next.length; i++) {
                if (typeof entry.next[i] === 'number') { nextVal = entry.next[i]; break; }
            }
        }
        if (typeof nextVal === 'number') {
            repl += 'p=' + nextVal;
        }
    }
    replacements[browserState] = repl || '(p=' + browserState + ')';
});

console.log('Replacements built: ' + Object.keys(replacements).length);

// Now patch: find all ternary chains and replace them with the forced path
// Pattern in the code: F===N ? (op, p=next) : (rest)
// For each (W,j):
//   - Find which F the browser chose
//   - Replace the ENTIRE ternary chain with just: (browser_ops, p=browser_next)

// This is complex to do via regex. Let's use a different approach:
// Build a NEW VMP l() function from scratch, using ONLY the browser path states.
// Walk the browser trace and emit linear code for each step.

var lines = [];
lines.push('function l(){try{');
lines.push('var p=arguments[0],a,_,c,e,t,y,o,v,r,n,i,s,d,h,u,m,g,f,S,E,b,C,R,M,T,A,x,D,N,L,G,w,P,V,O,k,B,I,W,j,F,z,H,U,J,K,X,Z,Q,q,Y,$,pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,El,bl,Cl,Rl,Ml,Tl,Al,xl,Dl,Nl,Ll,Gl,wl,Pl,Vl,Ol,kl,Bl,Il,Wl,jl,Fl,zl,Hl,Ul,Jl,Kl,Xl,Zl,Ql,ql,Yl,$l,pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,El,bl,Cl,Rl,Ml,Tl,Al;');
lines.push('for(;p!==void 0;){');
lines.push('switch(p){');

// For each browser state, emit: case STATE: (ops); p = NEXT; break;
var browserUnique = [...new Set(browserTrace)];
browserUnique.forEach(function(s) {
    var entry = stateMap[s];
    if (!entry) return;
    var ops = entry.ops || [];
    var next = (entry.next || [])[0];
    if (typeof next !== 'number') {
        for (var i = 0; i < (entry.next||[]).length; i++) {
            if (typeof entry.next[i] === 'number') { next = entry.next[i]; break; }
        }
    }
    var body = ops.length > 0 ? ops.map(function(o) { return o.left + '=' + o.right; }).join(',') + ',' : '';
    body += 'p=' + (typeof next === 'number' ? next : 'void 0');
    lines.push('case ' + s + ':' + body + ';break;');
});

lines.push('}}}catch(l){}}');

var newL = lines.join('');

// Replace l() in the original code
// The original l() is the second IIFE body (after the MD5 module)
var parts = code.split(/}catch\(l\)\{\}\}\(\)/);
// parts[0] = all code up to and including the MD5 IIFE closing
// parts[1] = comma + second IIFE body + closing semicolon

if (parts.length >= 2) {
    // parts[1] starts with comma and the second IIFE
    var beforeL = parts[1].substring(0, parts[1].indexOf('function l(){') + ' function l(){'.length);
    // Remove the function keyword — we already include it
    newL = parts[0] + '}catch(l){}}()' + parts[1].substring(0, parts[1].indexOf('function l(){')) + newL + '}();';
}

fs.writeFileSync(__dirname + '/security-forced.js', newL);
console.log('Forced security JS: ' + newL.length + ' bytes (was ' + code.length + ')');
console.log('States included: ' + browserUnique.length);
