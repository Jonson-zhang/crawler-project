/**
 * Build LINEAR VMP: replace the complex VMP l() with a simple switch
 * containing only browser-visited states.
 *
 * Each case: case STATE: (ops); p = NEXT; break;
 *
 * Uses original var declarations to avoid scope issues.
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Build the linear VMP
var newL = [];
newL.push('function l(){try{');
newL.push('var p=arguments[0],a,_,c,e,t,y,o,v,r,n,i,s,d,h,u,m,g,f,S,E,b,C,R,M,T,A,x,D,N,L,G,w,P,V,O,k,B,I,W,j,F,z,H,U,J,K,X,Z,Q,q,Y,$,pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,El,bl,Cl,Rl,Ml,Tl,Al,xl,Dl,Nl,Ll,Gl,wl,Pl,Vl,Ol,kl,Bl,Il,Wl,jl,Fl,zl,Hl,Ul,Jl,Kl,Xl,Zl,Ql,ql,Yl,$l,pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,El,bl,Cl,Rl,Ml,Tl,Al;');
newL.push('for(;p!==void 0;){');
newL.push('switch(p){');

// Add cases for ALL unique browser states
var visited = new Set([
    14887,11814,4399,21867,3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,16974,10689,2164,3218,2273,15635,2273,14473,
    3218,2273,15635,2273,14371,3218,2273,15635,2273,7762,3218,1481,1219,2096,
    6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,2273,22017,2273,22017,
    2273,22017,2273,15635,2273,16420,2273,15878,12497,3218,14635,2273,15635,
    2273,10287,3218,1481,2273,15635,2273,14704,15635,2273,5285,3218,15635,2273,
    1709,15635,2273,397,15635,2273,6735,2273,15635,2273,16420,2273,15635,2273,
    13760,2051,3218,2273,15635,2273,18928,15635,2273,14406,15635,2273,7178,
    3218,2273,15635,2273,7279,7299,2273,20906,3208,2273,20843,2273,3208,2273,
    20843,2273,15635,2273,15635,2273,15635,2273,7279,7299,10734,3218,2273,
    20492,3216,3655,20754,3463
]);

// Also include all CHAIN states (intermediate states the browser walks through)
// Walk from each browser state through the chain
function expandChain(s, expanded, maxDepth) {
    if (maxDepth <= 0 || !s || expanded.has(s)) return;
    expanded.add(s);
    var e = stateMap[s];
    if (!e) return;
    var next = (e.next || []);
    for (var i = 0; i < next.length; i++) {
        if (typeof next[i] === 'number' && !expanded.has(next[i])) {
            expandChain(next[i], expanded, maxDepth - 1);
        }
    }
}

var allStates = new Set(visited);
visited.forEach(function(s) { expandChain(s, allStates, 20); });
console.log('Total states (including chain): ' + allStates.size);

// For each state, emit: case STATE: ops; p=next; break;
allStates.forEach(function(s) {
    var e = stateMap[s];
    if (!e) return;

    var body = '';
    // Filter out l.apply (subroutine) operations
    if (e.ops && e.ops.length > 0) {
        var realOps = e.ops.filter(function(o) { return o.right.indexOf('l.apply') < 0; });
        if (realOps.length > 0) {
            body = realOps.map(function(o) { return o.left + '=' + o.right; }).join(',');
        }
    }

    var next = (e.next || []);
    var chosen = null;
    for (var i = 0; i < next.length; i++) {
        if (typeof next[i] === 'number') { chosen = next[i]; break; }
    }
    var nextStr = 'p=' + (chosen !== null ? chosen : 'void 0');

    if (body) {
        newL.push('case ' + s + ':' + body + ',' + nextStr + ';break;');
    } else {
        newL.push('case ' + s + ':' + nextStr + ';break;');
    }
});

newL.push('}}}catch(l){}}');

var newLStr = newL.join('');

// Find l() in the original and replace it
var lStart = code.indexOf('function l(){');
var lEndMarker = '}catch(l){}}()';
var lEnd = code.lastIndexOf(lEndMarker);
var innerLContent = code.substring(lStart, lEnd + lEndMarker.length);

// Replace: everything between 'function(){function l(){' and inner IIFE closing
var secondIIFE = code.substring(code.indexOf(',function(){function l(){') + ',function(){'.length);
var secondIIFEClose = secondIIFE.lastIndexOf('}()');
var beforeSecondIIFE = code.substring(0, code.indexOf(',function(){function l(){') + ',function(){'.length);
var afterSecondIIFE = code.substring(code.indexOf(',function(){function l(){') + ',function(){'.length + secondIIFEClose + 3);

// Inject our new l() inside the second IIFE
var patched = beforeSecondIIFE + newLStr + '}()' + afterSecondIIFE;

fs.writeFileSync(__dirname + '/security-linear.js', patched);
console.log('Saved security-linear.js (' + patched.length + ' bytes, was ' + code.length + ')');
console.log('States included: ' + allStates.size);
