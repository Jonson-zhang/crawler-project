/**
 * Generate PURE ALGORITHM JS from browser VMP trace
 *
 * For each p value in the browser trace:
 *   1. Decode CER
 *   2. Look up the operation code from the JS source
 *   3. Replace conditional p assignments with the browser's actual choice
 *   4. Generate a flat sequence of operations
 *
 * The output is a deterministic JS function that:
 *   - Takes (seed, ts) as input
 *   - Executes the exact browser-path operations
 *   - Returns the token
 *
 * Output: pure_algo_generated.js
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });

// Load browser trace
var browserTraceRaw = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8');
var browserTrace = browserTraceRaw.split('\n')
    .filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build next-p map from trace
var nextPFromTrace = {};
for (var i = 0; i < browserTrace.length - 1; i++) {
    var cur = browserTrace[i];
    var nxt = browserTrace[i + 1];
    // Use first occurrence (deterministic path)
    if (!(cur in nextPFromTrace)) {
        nextPFromTrace[cur] = nxt;
    }
}

console.log('Browser trace:', browserTrace.length, 'states');
console.log('Next-p mapping:', Object.keys(nextPFromTrace).length, 'entries');

// ===== Extract operations per CER from AST =====
function findL(node, d) {
    if (d > 15 || !node) return null;
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'l') {
        var b = node.body.body;
        if (b && b[0] && b[0].type === 'TryStatement') {
            var tb = b[0].block.body;
            if (tb && tb[0] && tb[0].type === 'ForStatement') return node;
        }
    }
    var skip = ['type','start','end','loc','leadingComments','trailingComments','innerComments','extra','raw','rawValue'];
    for (var k in node) {
        if (skip.indexOf(k) >= 0) continue;
        if (node[k] && typeof node[k] === 'object') {
            if (Array.isArray(node[k])) {
                for (var i = 0; i < Math.min(node[k].length, 100); i++) {
                    var r = findL(node[k][i], d + 1); if (r) return r;
                }
            } else {
                var r = findL(node[k], d + 1); if (r) return r;
            }
        }
    }
    return null;
}

var lFunc = findL(ast.program, 0);
if (!lFunc) { console.error('l() not found'); process.exit(1); }

var forBody = lFunc.body.body[0].block.body[0].body.body;
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}

// ===== Build CER → code mapping =====
var cerMap = {}; // key: "Cbl_Ebl_Rbl" → { code: "...", opsText: "..." }

function findPInNode(node) {
    if (!node) return null;
    if (t.isAssignmentExpression(node) && t.isIdentifier(node.left) && node.left.name === 'p') {
        if (t.isNumericLiteral(node.right)) return node.right.value;
        return findPInNode(node.right);
    }
    if (t.isSequenceExpression(node)) {
        for (var i = node.expressions.length - 1; i >= 0; i--) {
            var v = findPInNode(node.expressions[i]); if (v !== null) return v;
        }
    }
    if (t.isConditionalExpression(node)) {
        return findPInNode(node.consequent) || findPInNode(node.alternate);
    }
    return null;
}

function extractOps(code) {
    // Remove "p = N" or ", p = N" suffix to get business operations
    var m = code.match(/,?\s*p\s*=\s*(?:\d+|[^,]+?)\s*$/);
    if (m) return code.substring(0, code.length - m[0].length).replace(/,\s*$/, '');
    // If whole thing is "p = N", return empty
    if (/^p\s*=\s*\d+\s*$/.test(code.trim())) return '';
    return code.trim();
}

function resolvePFromTrace(code, node) {
    // If code is just "p = conditional ? A : B", resolve using browser trace
    var m = code.match(/^p\s*=\s*(.+)$/);
    if (m) {
        var rhs = m[1];
        // Try to evaluate both branches
        if (t.isConditionalExpression(node)) {
            var pA = findPInNode(node.consequent);
            var pB = findPInNode(node.alternate);
            // Find which p value the browser chose
            // We need the CURRENT p value to look up nextPFromTrace
            // This will be resolved at code-gen time
            return { type: 'conditional_p', expr: rhs, pA: pA, pB: pB };
        }
    }
    return null;
}

// Walk the VMP tree and extract
wSwitch.cases.forEach(function(wCase) {
    var Cbl = (wCase.test && t.isNumericLiteral(wCase.test)) ? wCase.test.value : null;
    if (Cbl === null) return;

    var wBody = wCase.consequent;
    for (var si = 0; si < wBody.length; si++) {
        var stmt = wBody[si];
        if (!t.isVariableDeclaration(stmt)) continue;
        for (var di = 0; di < stmt.declarations.length; di++) {
            var decl = stmt.declarations[di];
            if (!decl.init || !t.isCallExpression(decl.init)) continue;
            var callee = decl.init.callee;
            if (!t.isMemberExpression(callee) || callee.property.name !== 'apply') continue;
            var fn = callee.object;
            if (!t.isFunctionExpression(fn)) continue;

            var fnBody = fn.body.body;
            var eSwitch = null;
            for (var fi = 0; fi < fnBody.length; fi++) {
                if (t.isSwitchStatement(fnBody[fi])) { eSwitch = fnBody[fi]; break; }
            }
            if (!eSwitch) continue;

            eSwitch.cases.forEach(function(eCase) {
                var Ebl = (eCase.test && t.isNumericLiteral(eCase.test)) ? eCase.test.value : null;
                if (Ebl === null) return;

                var eBody = eCase.consequent;
                for (var ei = 0; ei < eBody.length; ei++) {
                    var eStmt = eBody[ei];
                    if (!t.isVariableDeclaration(eStmt)) continue;
                    for (var edi = 0; edi < eStmt.declarations.length; edi++) {
                        var eDecl = eStmt.declarations[edi];
                        if (!eDecl.init || !t.isCallExpression(eDecl.init)) continue;
                        var eCallee = eDecl.init.callee;
                        if (!t.isMemberExpression(eCallee) || eCallee.property.name !== 'apply') continue;
                        var eFn = eCallee.object;
                        if (!t.isFunctionExpression(eFn)) continue;

                        var eFnBody = eFn.body.body;

                        // Check for switch(Rbl) inside
                        var rSwitch = null;
                        for (var rfi = 0; rfi < eFnBody.length; rfi++) {
                            if (t.isSwitchStatement(eFnBody[rfi])) { rSwitch = eFnBody[rfi]; break; }
                        }

                        if (rSwitch) {
                            rSwitch.cases.forEach(function(rCase) {
                                var Rbl = (rCase.test && t.isNumericLiteral(rCase.test)) ? rCase.test.value : null;
                                if (Rbl === null) return;

                                var key = Cbl + '_' + Ebl + '_' + Rbl;
                                var rBody = rCase.consequent;
                                if (rBody.length > 0) {
                                    var opsCode = gen(rBody[0]);
                                    var opsText = extractOps(opsCode);
                                    cerMap[key] = { code: opsCode, ops: opsText };
                                }
                            });
                        } else {
                            // Handle ternary Rbl chain
                            for (var tfi = 0; tfi < eFnBody.length; tfi++) {
                                var tStmt = eFnBody[tfi];
                                if (t.isExpressionStatement(tStmt) && t.isConditionalExpression(tStmt.expression)) {
                                    var cur = tStmt.expression;
                                    while (cur && t.isConditionalExpression(cur)) {
                                        var test = cur.test;
                                        var rblVal = null;
                                        if (t.isBinaryExpression(test) && test.operator === '===') {
                                            if (t.isNumericLiteral(test.left) && t.isIdentifier(test.right) && test.right.name === 'Rbl')
                                                rblVal = test.left.value;
                                            else if (t.isNumericLiteral(test.right) && t.isIdentifier(test.left) && test.left.name === 'Rbl')
                                                rblVal = test.right.value;
                                        }
                                        if (rblVal === null) break;

                                        var key = Cbl + '_' + Ebl + '_' + rblVal;
                                        var opsCode = gen(cur.consequent);
                                        var opsText = extractOps(opsCode);
                                        cerMap[key] = { code: opsCode, ops: opsText };
                                        cur = cur.alternate;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    }
});

console.log('CER map entries:', Object.keys(cerMap).length);

// ===== Generate pure algorithm =====
var flatOps = [];
var uniqueSet = new Set();
var lastOps = null;

browserTrace.forEach(function(pValue, idx) {
    var Cbl = pValue & 31;
    var Ebl = (pValue >> 5) & 31;
    var Rbl = (pValue >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;

    var entry = cerMap[key];
    if (!entry || !entry.ops || entry.ops.trim() === '') return;

    // Dedup consecutive identical ops
    if (entry.ops === lastOps) return;
    lastOps = entry.ops;

    // Skip pure "p = N" operations
    if (/^p\s*=\s*\d+\s*$/.test(entry.ops.trim())) return;

    flatOps.push(entry.ops);
});

console.log('Flat operations:', flatOps.length);

// Generate JS
var lines = [];
lines.push('// Pure algorithm generated from browser VMP trace');
lines.push('// ' + flatOps.length + ' operations');
lines.push('');
lines.push('function generateToken(seed, ts) {');
lines.push('  // VMP variables');
lines.push('  var p, a, _, c, e, t, y, o, v, r, n, i, s, d, h, u, m, g, f, S, b, C, E, R, T, A, M, D, L, G, x, N, P, V, w, I, B, O, k, W, j, F, z, H, U, J, Z, K, X, Q, q, Y, $;');
lines.push('');

flatOps.forEach(function(op) {
    // Sanitize: replace characters that might cause issues
    var clean = op.replace(/\n/g, ' ').trim();
    if (clean) lines.push('  ' + clean + ';');
});

lines.push('');
lines.push('  // Extract token from final variable state');
lines.push('  // The token is in variable pp at the end of the algorithm');
lines.push('  return pp || "";');
lines.push('}');

fs.writeFileSync(__dirname + '/pure_algo_generated.js', lines.join('\n'));
console.log('Generated pure_algo_generated.js (' + lines.length + ' lines)');

// Also count by type
var types = {};
flatOps.forEach(function(op) {
    if (op.includes('typeof')) types.env = (types.env || 0) + 1;
    else if (op.match(/=\s*"[^"]*"/)) types.str = (types.str || 0) + 1;
    else if (op.match(/[+\-^*&|~<>]/)) types.math = (types.math || 0) + 1;
    else if (op.includes('function')) types.fn = (types.fn || 0) + 1;
    else if (op.match(/p\s*=\s*[^=]+\s*\?\s*[^:]+\s*:\s*[^;]+/)) types.cond = (types.cond || 0) + 1;
    else types.other = (types.other || 0) + 1;
});
console.log('Ops by type:', types);
