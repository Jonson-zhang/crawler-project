/**
 * BUILD PURE ALGORITHM v3 — State-map-based extraction
 *
 * Uses vmp_complete_map.json (CER → specific operation)
 * For each browser-trace p value:
 *   1. CER = (p&31, (p>>5)&31, (p>>10)&31)
 *   2. Look up: map[Cbl_Ebl_Rbl] → {code, next}
 *   3. Extract business ops (remove "p = N" suffix)
 *   4. For conditionals, consult browser trace for actual next-p
 */
var fs = require('fs');
var map = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8')).map;

var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build p → next_p
var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

// === Extract business ops for each trace step ===
function extractOps(code) {
    if (!code) return null;
    // Remove "p = N" or ", p = N" suffix
    var cleaned = code.replace(/,?\s*p\s*=\s*\d+(?:\s*[,;)]?\s*$|$)/, '');
    // Also handle conditional: p = X ? A : B
    cleaned = cleaned.replace(/p\s*=\s*\w+\s*\?\s*\d+\s*:\s*\d+/, '');
    // Handle "p = void 0"
    cleaned = cleaned.replace(/,?\s*p\s*=\s*void\s+0/, '');
    // Remove leading "p = N," patterns
    cleaned = cleaned.replace(/^p\s*=\s*\d+\s*,\s*/, '');
    // Remove standalone p=N
    if (/^p\s*=\s*\d+$/.test(cleaned.trim())) return null;

    cleaned = cleaned.trim();
    if (!cleaned || cleaned === 'undefined') return null;
    return cleaned;
}

var ops = [];
var seen = {};
var lastOps = '';
var stats = { found: 0, notFound: 0, pureP: 0, conditional: 0 };

trace.forEach(function(p, idx) {
    var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;

    var entry = map[key];
    if (!entry) { stats.notFound++; return; }

    var code = entry.code;
    var opsCode = extractOps(code);
    if (!opsCode) { stats.pureP++; return; }
    if (opsCode === lastOps) return; // dedup

    // Check if this is a conditional: p = X ? A : B
    var condMatch = opsCode.match(/^p\s*=\s*(\w+)\s*\?\s*(\d+)\s*:\s*(\d+)$/);
    if (condMatch) {
        var condVar = condMatch[1];
        var pTrue = parseInt(condMatch[2]);
        var pFalse = parseInt(condMatch[3]);
        var actualNext = nextMap[p];

        // Resolve: which branch did the browser take?
        if (actualNext === pTrue) {
            opsCode = '// [' + condVar + '] → true branch';
        } else if (actualNext === pFalse) {
            opsCode = '// [' + condVar + '] → false branch';
        } else {
            opsCode = '// [' + condVar + '] → p=' + actualNext + ' (neither ' + pTrue + ' nor ' + pFalse + ')';
        }
        stats.conditional++;
    }

    lastOps = opsCode;
    ops.push({ idx: idx, p: p, cer: key, ops: opsCode });
    stats.found++;
});

console.log('Stats:', stats);
console.log('Operations:', ops.length);

// === Generate clean JS ===
var lines = [];
lines.push('// Pure algorithm v3 — extracted from browser VMP trace');
lines.push('// ' + ops.length + ' unique operations');
lines.push('');
lines.push('var _seed, _ts;  // inputs');
lines.push('');
lines.push('function generateToken(seed, ts) {');
lines.push('  _seed = seed; _ts = ts;');
lines.push('');

// VMP variables
lines.push('  var p,a,_,c,e,t,y,o,v,r,n,i,s,d,h,u,m,g,f,S,b,C,E,R,T,A,M,D,L,G,x,N,P,V,w,I,B,O,k,W,j,F,z,H,U,J,Z,K,X,Q,q,Y,$;');
lines.push('  var pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,bl,Cl,El,Rl,Tl,Al,Ml,Dl,Ll,Gl,xl,Nl,Pl,Vl,wl,Il,Bl,Ol,kl,Wl,jl,Fl,zl,Hl,Ul,Jl,Zl,Kl,Xl,Ql,ql,Yl,$l;');
lines.push('  var lp,pp,ap,_p,cp,ep,tp,yp,op,vp,np,ip,sp,dp,hp,up,mp,gp,fp,Sp,bp,Cp,Ep,Rp,Tp,Ap,Mp,Dp,Lp,Gp,xp,Np,Pp,Vp,wp,Ip,Bp,Op,kp,Wp,jp,Fp,zp,Hp,Up,Jp,Zp,Kp,Xp,Qp,qp,Yp,$p;');
lines.push('  var la,pa,aa,_a,ca,ea,ta,ya,oa,va,ra,na,ia,sa,da,ha,ua,ma,ga,fa,Sa,ba,Ca,Ea,Ra,Ta,Aa,Ma,Da,La,Ga,xa,Na,Pa,Va,wa,Ia,Ba,Oa,ka,Wa,ja,Fa,za,Ha,Ua,Ja,Za,Ka,Xa,Qa,qa,Ya,$a;');
lines.push('');

ops.forEach(function(op) {
    if (!op.ops || op.ops.trim() === '') return;
    if (op.ops.startsWith('// [')) {
        lines.push('  ' + op.ops);
    } else {
        lines.push('  ' + op.ops + ';');
    }
});

lines.push('');
lines.push('  return pp || "";');
lines.push('}');
lines.push('');
lines.push('if (typeof module !== "undefined") module.exports = { generateToken: generateToken };');

fs.writeFileSync(__dirname + '/pure_algo_v3.js', lines.join('\n'));
console.log('Saved pure_algo_v3.js (' + lines.length + ' lines)');

// Show first/last ops
console.log('\n=== First 10 ops ===');
ops.slice(0, 10).forEach(function(o) { console.log('  ' + o.ops); });
console.log('\n=== Last 10 ops ===');
ops.slice(-10).forEach(function(o) { console.log('  ' + o.ops); });

// Count by type
var cats = {};
ops.forEach(function(o) {
    var op = o.ops;
    if (op.startsWith('//')) cats.comment = (cats.comment||0)+1;
    else if (/=\s*"[^"]*"/.test(op)) cats.string = (cats.string||0)+1;
    else if (/=\s*-?\d+\s*[;,]?\s*$/.test(op)) cats.number = (cats.number||0)+1;
    else if (/[+\-*/&|^~]/.test(op)) cats.math = (cats.math||0)+1;
    else if (/typeof|\.call\(|\.apply\(|function/.test(op)) cats.call = (cats.call||0)+1;
    else cats.other = (cats.other||0)+1;
});
console.log('\nCategories:', cats);
