/**
 * BUILD FLAT VMP — Keep for-loop, eliminate ALL branches
 *
 * For each (Cbl, Ebl, Rbl) in the browser trace:
 *   1. Look up the operation code
 *   2. Replace p = N with p = <browser_next_p>
 *   3. Replace p = X ? A : B with p = <browser_chosen_p>
 *   4. Emit as a case in a switch(p){} structure
 *
 * Output: flat VMP that follows browser path exactly
 */
var fs = require('fs');
var map = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8')).map;
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

// Extract ops per p-value
var pToOps = {};
var pToNext = {};

trace.forEach(function(p) {
    if (pToOps[p]) return; // already processed

    var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;
    var entry = map[key];
    if (!entry) return;

    var code = entry.code;
    // Extract business ops, resolve p value
    var ops = code;

    // Replace: "..., p = N" → "..." , and record N
    var nextP = null;
    var pm = ops.match(/,?\s*p\s*=\s*(\d+)\s*$/);
    if (pm) {
        nextP = parseInt(pm[1]);
        ops = ops.substring(0, ops.length - pm[0].length);
    }

    // Handle "p = N" (no business ops)
    var directP = ops.match(/^p\s*=\s*(\d+)\s*$/);
    if (directP) {
        nextP = parseInt(directP[1]);
        ops = '';
    }

    // Handle "p = X ? A : B"
    var condP = ops.match(/p\s*=\s*(\w+)\s*\?\s*(\d+)\s*:\s*(\d+)/);
    if (condP) {
        nextP = nextMap[p]; // browser-chosen
        ops = ops.replace(/p\s*=\s*\w+\s*\?\s*\d+\s*:\s*\d+/, '// branch resolved');
    }

    // Handle "p = void 0" (loop exit)
    if (ops.match(/p\s*=\s*void\s+0/)) {
        nextP = null; // exit loop
        ops = ops.replace(/,?\s*p\s*=\s*void\s+0/, '');
    }

    // Force browser next-p
    var forcedNext = nextMap[p];
    if (forcedNext !== undefined && nextP !== forcedNext) {
        // Override with browser's actual next
        nextP = forcedNext;
    }

    ops = ops.replace(/,\s*$/, '').trim();

    // Fix: if ops contains bare "return", wrap in IIFE
    // These come from function bodies that are .apply()'d
    if (/\breturn\b/.test(ops) && !ops.startsWith('return [pp]')) {
        ops = '(function(){' + ops + '}).apply(this, arguments)';
    }

    pToOps[p] = ops;
    pToNext[p] = nextP;
});

console.log('Processed', Object.keys(pToOps).length, 'unique p-values');

// === Generate switch-based flat VMP ===
var lines = [];
lines.push('// Flat VMP — follows browser trace exactly');
lines.push('// ' + Object.keys(pToOps).length + ' states, ' + trace.length + ' trace steps');
lines.push('');
lines.push('function generateToken(seed, ts) {');
lines.push('  // All VMP variables');
lines.push('  var p,a,_,c,e,t,y,o,v,r,n,i,s,d,h,u,m,g,f,S,b,C,E,R,T,A,M,D,L,G,x,N,P,V,w,I,B,O,k,W,j,F,z,H,U,J,Z,K,X,Q,q,Y,$;');
lines.push('  var pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,bl,Cl,El,Rl,Tl,Al,Ml,Dl,Ll,Gl,xl,Nl,Pl,Vl,wl,Il,Bl,Ol,kl,Wl,jl,Fl,zl,Hl,Ul,Jl,Zl,Kl,Xl,Ql,ql,Yl,$l;');
lines.push('  var lp,pp,ap,_p,cp,ep,tp,yp,op,vp,np,ip,sp,dp,hp,up,mp,gp,fp,Sp,bp,Cp,Ep,Rp,Tp,Ap,Mp,Dp,Lp,Gp,xp,Np,Pp,Vp,wp,Ip,Bp,Op,kp,Wp,jp,Fp,zp,Hp,Up,Jp,Zp,Kp,Xp,Qp,qp,Yp,$p;');
lines.push('  var la,pa,aa,_a,ca,ea,ta,ya,oa,va,ra,na,ia,sa,da,ha,ua,ma,ga,fa,Sa,ba,Ca,Ea,Ra,Ta,Aa,Ma,Da,La,Ga,xa,Na,Pa,Va,wa,Ia,Ba,Oa,ka,Wa,ja,Fa,za,Ha,Ua,Ja,Za,Ka,Xa,Qa,qa,Ya,$a;');
lines.push('');

// Use the first trace entry as initial p
lines.push('  p = ' + trace[0] + ';');
lines.push('  for (; p !== void 0; ) {');
lines.push('    switch (p) {');

Object.keys(pToOps).sort(function(a,b){return parseInt(a)-parseInt(b)}).forEach(function(pVal) {
    var ops = pToOps[pVal];
    var next = pToNext[pVal];

    lines.push('      case ' + pVal + ':');
    if (ops && ops.trim()) {
        lines.push('        ' + ops + ';');
    }
    if (next !== null && next !== undefined) {
        lines.push('        p = ' + next + ';');
    } else {
        lines.push('        p = void 0;');
    }
    lines.push('        break;');
});

lines.push('      default:');
lines.push('        p = void 0;');
lines.push('        break;');
lines.push('    }');
lines.push('  }');
lines.push('');
lines.push('  return pp || "";');
lines.push('}');
lines.push('');
lines.push('if (typeof module !== "undefined") module.exports = { generateToken: generateToken };');

fs.writeFileSync(__dirname + '/flat_vmp.js', lines.join('\n'));
console.log('Saved flat_vmp.js (' + lines.length + ' lines)');

// === Also generate a "compressed" version (switch as object literal) ===
var compressed = [];
compressed.push('// Compressed Flat VMP');
compressed.push('function generateToken(seed,ts){');
compressed.push('var p,a,_,c,e,t,y,o,v,r,n,i,s,d,h,u,m,g,f,S,b,C,E,R,T,A,M,D,L,G,x,N,P,V,w,I,B,O,k,W,j,F,z,H,U,J,Z,K,X,Q,q,Y,$;');
compressed.push('var pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,bl,Cl,El,Rl,Tl,Al,Ml,Dl,Ll,Gl,xl,Nl,Pl,Vl,wl,Il,Bl,Ol,kl,Wl,jl,Fl,zl,Hl,Ul,Jl,Zl,Kl,Xl,Ql,ql,Yl,$l;');
compressed.push('var lp,pp,ap,_p,cp,ep,tp,yp,op,vp;');
compressed.push('var la,pa,aa,_a,ca,ea,ta,ya,oa,va,ra,na,ia,sa,da,ha,ua,ma,ga,fa,Sa,ba,Ca,Ea,Ra,Ta,Aa,Ma,Da,La,Ga;');
compressed.push('p=' + trace[0] + ';');
compressed.push('for(;p!==void 0;){');
compressed.push('switch(p){');

var sortedKeys = Object.keys(pToOps).sort(function(a,b){return parseInt(a)-parseInt(b)});
sortedKeys.forEach(function(pVal) {
    var ops = pToOps[pVal];
    var next = pToNext[pVal];
    compressed.push('case ' + pVal + ':');
    if (ops && ops.trim()) compressed.push(ops + ';');
    compressed.push('p=' + (next !== null && next !== undefined ? next : 'void 0') + ';break;');
});

compressed.push('default:p=void 0;break;}}');
compressed.push('return pp||"";}');
compressed.push('if(typeof module!=="undefined")module.exports={generateToken:generateToken};');

fs.writeFileSync(__dirname + '/flat_vmp_compressed.js', compressed.join(''));
console.log('Saved flat_vmp_compressed.js (' + compressed.join('').length + ' chars)');
