/**
 * VMP EXECUTOR v3 — State machine simulator driven by browser trace
 *
 * Builds a self-contained JS function that:
 *   - Takes (seed, ts) as input
 *   - Iterates through browser-trace p values
 *   - Executes operations for each CER
 *   - Returns the token
 */
var fs = require('fs');

var mapData = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8'));
var stateMap = mapData.map;
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

var seen = {};
var pToCode = {};

trace.forEach(function(p) {
    if (seen[p]) return;
    seen[p] = true;
    var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;
    var entry = stateMap[key];
    if (!entry) return;
    var code = entry.code, nextP = nextMap[p];
    var ops = code.replace(/,\s*p\s*=\s*(\d+)\s*$/, '').replace(/^p\s*=\s*(\d+)\s*$/, '').replace(/^p\s*=\s*(\d+)\s*,\s*/, '').replace(/,?\s*p\s*=\s*void\s+0\s*$/, '');
    var condMatch = ops.match(/^p\s*=\s*(\w+)\s*\?\s*(\d+)\s*:\s*(\d+)$/);
    if (condMatch) ops = '// [' + condMatch[1] + '] browser→' + nextP;
    if (ops.includes('return l.apply(')) ops = ops.replace(/return l\.apply\(/g, '/*return*/ l.apply(');
    ops = ops.trim() || ('/* p=' + p + '→' + nextP + ' */');
    pToCode[p] = { ops: ops, next: nextP };
});

// Generate function
var lines = [];
lines.push('(function(seed,ts){"use strict";');
var allVars = 'p,a,_,c,e,t,y,o,v,r,n,i,s,d,h,u,m,g,f,S,b,C,E,R,T,A,M,D,L,G,x,N,P,V,w,I,B,O,k,W,j,F,z,H,U,J,Z,K,X,Q,q,Y,$,' +
    'pl,al,_l,cl,el,tl,yl,ol,vl,rl,nl,il,sl,dl,hl,ul,ml,gl,fl,Sl,bl,Cl,El,Rl,Tl,Al,Ml,Dl,Ll,Gl,xl,Nl,Pl,Vl,wl,Il,Bl,Ol,kl,Wl,jl,Fl,zl,Hl,Ul,Jl,Zl,Kl,Xl,Ql,ql,Yl,$l,' +
    'lp,pp,ap,_p,cp,ep,tp,yp,op,vp,np,ip,sp,dp,hp,up,mp,gp,fp,Sp,bp,Cp,Ep,Rp,Tp,Ap,Mp,Dp,Lp,Gp,xp,Np,Pp,Vp,wp,Ip,Bp,Op,kp,Wp,jp,Fp,zp,Hp,Up,Jp,Zp,Kp,Xp,Qp,qp,Yp,$p,' +
    'la,pa,aa,_a,ca,ea,ta,ya,oa,va,ra,na,ia,sa,da,ha,ua,ma,ga,fa,Sa,ba,Ca,Ea,Ra,Ta,Aa,Ma,Da,La,Ga,xa,Na,Pa,Va,wa,Ia,Ba,Oa,ka,Wa,ja,Fa,za,Ha,Ua,Ja,Za,Ka,Xa,Qa,qa,Ya,$a';
lines.push('var ' + allVars + ';');
lines.push('p=' + trace[0] + ';for(;p!==void 0;){switch(p){');

Object.keys(pToCode).sort(function(a,b){return a-b}).forEach(function(pVal){
    var info = pToCode[pVal];
    lines.push('case ' + pVal + ':');
    if (info.ops && info.ops !== '' && !info.ops.startsWith('//')) lines.push(info.ops + ';');
    else if (info.ops) lines.push(info.ops + ';');
    lines.push('p=' + (info.next != null ? info.next : 'void 0') + ';break;');
});

lines.push('default:p=void 0;break;}}return pp||"";})');

var vmpCode = lines.join('');
fs.writeFileSync(__dirname + '/vmp_executor_gen.js', vmpCode);
console.log('Generated:', vmpCode.length, 'chars,', Object.keys(pToCode).length, 'states');

// Test
var fn = eval(vmpCode);
var token = fn('testXYZ', 1700000000000);
console.log('Token:', token ? token.length : 'null', token ? token.substring(0, 20) : '');
