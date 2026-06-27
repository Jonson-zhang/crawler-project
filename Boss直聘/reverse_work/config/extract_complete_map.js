/**
 * COMPLETE VMP State Map Extraction for 11f5a2fc.js
 *
 * Handles ALL dispatch patterns:
 *   A) switch(Rbl){case K: ...}  — standard switch
 *   B) 0===Rbl ? ... : 1===Rbl ? ... : void 0  — ternary chain
 *   C) hp dispatch: 0===hp ? ... : 1===hp ? ...
 *
 * Output: vmp_complete_map.json
 *   map[state_p] = { code: "...", next: N }
 *   map[state_p_hp] = { code: "...", next: N }  // for hp-specific entries
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });

// Find function l()
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
                for (var i = 0; i < Math.min(node[k].length, 200); i++) {
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

// ============ HELPERS ============

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
    if (t.isCallExpression(node)) {
        var callee = node.callee;
        if (t.isMemberExpression(callee) && callee.property.name === 'apply') {
            var fn = callee.object;
            if (t.isFunctionExpression(fn) && fn.body.body[0]) {
                return findPInNode(fn.body.body[0]);
            }
        }
    }
    return null;
}

function isHpTernary(testNode) {
    if (!t.isBinaryExpression(testNode) || testNode.operator !== '===') return false;
    var left = testNode.left, right = testNode.right;
    return (t.isNumericLiteral(left) && t.isIdentifier(right) && right.name === 'hp') ||
           (t.isNumericLiteral(right) && t.isIdentifier(left) && left.name === 'hp');
}

function getHpValue(testNode) {
    if (t.isNumericLiteral(testNode.left)) return testNode.left.value;
    if (t.isNumericLiteral(testNode.right)) return testNode.right.value;
    return null;
}

/**
 * Parse a ternary chain 0===hp ? (codeA, p=nextA) : 1===hp ? (codeB, p=nextB) : ...
 * Returns: [{hp:0, code:"...", next:N}, {hp:1, code:"...", next:N}, ...]
 */
function parseHpChain(ternaryNode) {
    var results = [];
    var cur = ternaryNode;
    while (cur && t.isConditionalExpression(cur) && isHpTernary(cur.test)) {
        var hpVal = getHpValue(cur.test);
        results.push({
            hp: hpVal,
            code: gen(cur.consequent),
            next: findPInNode(cur.consequent)
        });
        cur = cur.alternate;
    }
    // Handle last alternate (could be void 0 or another expression)
    if (cur && !t.isConditionalExpression(cur)) {
        if (t.isUnaryExpression(cur) && cur.operator === 'void') {
            // terminal void 0 - no hp match
        } else {
            results.push({ hp: -1, code: gen(cur), next: findPInNode(cur) });
        }
    }
    return results;
}

/**
 * Parse Rbl ternary chain: 0===Rbl ? ... : 1===Rbl ? ...
 * Returns: {rbl: [{rbl:0, code:"...", next:N}, ...], hpChain: [{hp:0, ...}]}
 */
function parseRblTernary(ternaryNode) {
    var rblBranches = [];
    var cur = ternaryNode;
    while (cur && t.isConditionalExpression(cur)) {
        var test = cur.test;
        var isRbl = false;
        var rblVal = null;
        if (t.isBinaryExpression(test) && test.operator === '===') {
            if (t.isNumericLiteral(test.left) && t.isIdentifier(test.right) && test.right.name === 'Rbl') {
                isRbl = true; rblVal = test.left.value;
            } else if (t.isNumericLiteral(test.right) && t.isIdentifier(test.left) && test.left.name === 'Rbl') {
                isRbl = true; rblVal = test.right.value;
            }
        }
        if (!isRbl) break;

        var conseq = cur.consequent;
        var conseqCode = gen(conseq);
        var nextP = findPInNode(conseq);

        // Check if the consequent contains hp dispatch
        var hpBranches = null;
        if (t.isCallExpression(conseq)) {
            var callee = conseq.callee;
            if (t.isMemberExpression(callee) && callee.property.name === 'apply') {
                var fn = callee.object;
                if (t.isFunctionExpression(fn)) {
                    var innerCode = gen(fn.body);
                    // Check for hp dispatch inside
                    var fnBody = fn.body.body[0];
                    if (fnBody && t.isExpressionStatement(fnBody)) {
                        var innerExpr = fnBody.expression;
                        if (t.isConditionalExpression(innerExpr) && isHpTernary(innerExpr.test)) {
                            hpBranches = parseHpChain(innerExpr);
                        } else if (t.isConditionalExpression(innerExpr)) {
                            hpBranches = parseHpChain(innerExpr);
                        }
                    }
                    if (!hpBranches) {
                        // No hp dispatch, just regular code
                        conseqCode = innerCode;
                        nextP = findPInNode(fn.body);
                    }
                }
            }
        } else if (t.isConditionalExpression(conseq) && isHpTernary(conseq.test)) {
            hpBranches = parseHpChain(conseq);
        }

        rblBranches.push({
            rbl: rblVal,
            code: conseqCode,
            next: nextP,
            hpBranches: hpBranches
        });

        cur = cur.alternate;
    }

    return rblBranches;
}

// ============ MAIN EXTRACTION ============

var stateMap = {};  // key: "Cbl_Ebl_Rbl" or "Cbl_Ebl_Rbl_hpH" → {code, next}
var stats = { total: 0, withHp: 0, withoutHp: 0, missed: 0 };

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

            // Find switch(Ebl) inside this function
            var fnBody = fn.body.body;
            var eSwitch = null;
            for (var fi = 0; fi < fnBody.length; fi++) {
                if (t.isSwitchStatement(fnBody[fi])) { eSwitch = fnBody[fi]; break; }
            }
            if (!eSwitch) continue;

            // === Process each Ebl case ===
            eSwitch.cases.forEach(function(eCase) {
                var Ebl = (eCase.test && t.isNumericLiteral(eCase.test)) ? eCase.test.value : null;
                if (Ebl === null) return;

                var eBody = eCase.consequent;

                for (var ei = 0; ei < eBody.length; ei++) {
                    var eStmt = eBody[ei];

                    // === PATTERN A: var innerFn = function(){switch(Rbl){...}}.apply(...) ===
                    if (t.isVariableDeclaration(eStmt)) {
                        for (var edi = 0; edi < eStmt.declarations.length; edi++) {
                            var eDecl = eStmt.declarations[edi];
                            if (!eDecl.init || !t.isCallExpression(eDecl.init)) continue;
                            var eCallee = eDecl.init.callee;
                            if (!t.isMemberExpression(eCallee) || eCallee.property.name !== 'apply') continue;
                            var eFn = eCallee.object;
                            if (!t.isFunctionExpression(eFn)) continue;

                            var eFnBody = eFn.body.body;
                            var rSwitch = null;

                            // Look for switch(Rbl)
                            for (var rfi = 0; rfi < eFnBody.length; rfi++) {
                                if (t.isSwitchStatement(eFnBody[rfi])) { rSwitch = eFnBody[rfi]; break; }
                            }

                            if (rSwitch) {
                                // === PATTERN A: switch(Rbl) ===
                                rSwitch.cases.forEach(function(rCase) {
                                    var Rbl = (rCase.test && t.isNumericLiteral(rCase.test)) ? rCase.test.value : null;
                                    if (Rbl === null) return;

                                    var rBody = rCase.consequent;
                                    processRblBody(Cbl, Ebl, Rbl, rBody);
                                });
                            } else {
                                // === Check for ternary pattern in function body ===
                                // function(){0===Rbl ? ... : void 0}
                                for (var tfi = 0; tfi < eFnBody.length; tfi++) {
                                    var tStmt = eFnBody[tfi];
                                    if (t.isExpressionStatement(tStmt) && t.isConditionalExpression(tStmt.expression)) {
                                        var rblBranches = parseRblTernary(tStmt.expression);
                                        rblBranches.forEach(function(b) {
                                            processRblBranch(Cbl, Ebl, b.rbl, b.code, b.next, b.hpBranches);
                                        });
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

function processRblBody(Cbl, Ebl, Rbl, rBody) {
    if (rBody.length === 0) return;
    var firstStmt = rBody[0];

    if (t.isExpressionStatement(firstStmt)) {
        var expr = firstStmt.expression;

        // Check: var fn = function(){hp dispatch}.apply(...)
        if (t.isCallExpression(expr)) {
            var callee = expr.callee;
            if (t.isMemberExpression(callee) && callee.property.name === 'apply') {
                var fn = callee.object;
                if (t.isFunctionExpression(fn)) {
                    // Look for hp dispatch inside
                    for (var fi = 0; fi < fn.body.body.length; fi++) {
                        var inner = fn.body.body[fi];
                        if (t.isExpressionStatement(inner) && t.isConditionalExpression(inner.expression)) {
                            // Try hp dispatch
                            var hpBranches = parseHpChain(inner.expression);
                            if (hpBranches.length > 0) {
                                hpBranches.forEach(function(hb) {
                                    var key = Cbl + '_' + Ebl + '_' + Rbl + '_h' + hb.hp;
                                    stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, hp: hb.hp, code: hb.code, next: hb.next };
                                    stats.withHp++;
                                });
                                return;
                            }
                            // Try Rbl ternary inside function
                            var rblBranches = parseRblTernary(inner.expression);
                            if (rblBranches.length > 0) {
                                rblBranches.forEach(function(b) {
                                    processRblBranch(Cbl, Ebl, b.rbl, b.code, b.next, b.hpBranches);
                                });
                                return;
                            }
                        }
                        // Return statement
                        if (t.isReturnStatement(inner)) {
                            var nextP = findPInNode(inner.argument);
                            var key = Cbl + '_' + Ebl + '_' + Rbl;
                            stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: gen(inner.argument), next: nextP };
                            stats.withoutHp++;
                            return;
                        }
                        // Switch statement (nested dispatch)
                        if (t.isSwitchStatement(inner)) {
                            var key = Cbl + '_' + Ebl + '_' + Rbl;
                            stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: gen(fn.body), next: null };
                            stats.withoutHp++;
                            return;
                        }
                    }
                    // Generic: just save the whole function
                    var key = Cbl + '_' + Ebl + '_' + Rbl;
                    stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: gen(fn.body), next: findPInNode(fn.body) };
                    stats.withoutHp++;
                    return;
                }
            }
        }

        // Check: hp ternary directly — 0===hp ? (ops) : 1===hp ? (ops) : void 0
        if (t.isConditionalExpression(expr) && isHpTernary(expr.test)) {
            var hpBranches = parseHpChain(expr);
            hpBranches.forEach(function(hb) {
                var key = Cbl + '_' + Ebl + '_' + Rbl + '_h' + hb.hp;
                stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, hp: hb.hp, code: hb.code, next: hb.next };
                stats.withHp++;
            });
            return;
        }

        // Fallback: direct expression
        var key = Cbl + '_' + Ebl + '_' + Rbl;
        var nextP = findPInNode(expr);
        stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: gen(expr), next: nextP };
        stats.withoutHp++;
    } else if (t.isVariableDeclaration(firstStmt)) {
        var key = Cbl + '_' + Ebl + '_' + Rbl;
        stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: gen(firstStmt), next: null };
        stats.withoutHp++;
    } else if (t.isReturnStatement(firstStmt)) {
        var key = Cbl + '_' + Ebl + '_' + Rbl;
        var nextP = findPInNode(firstStmt.argument);
        stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: gen(firstStmt), next: nextP };
        stats.withoutHp++;
    } else {
        stats.missed++;
    }
}

function processRblBranch(Cbl, Ebl, Rbl, code, next, hpBranches) {
    if (hpBranches && hpBranches.length > 0) {
        hpBranches.forEach(function(hb) {
            var key = Cbl + '_' + Ebl + '_' + Rbl + '_h' + hb.hp;
            stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, hp: hb.hp, code: hb.code, next: hb.next };
            stats.withHp++;
        });
    } else {
        var key = Cbl + '_' + Ebl + '_' + Rbl;
        stateMap[key] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, code: code, next: next };
        stats.withoutHp++;
    }
}

console.log('=== Extraction Results ===');
console.log('Total entries:', stats.total = stats.withHp + stats.withoutHp);
console.log('  With hp dispatch:', stats.withHp);
console.log('  Without hp dispatch:', stats.withoutHp);
console.log('  Missed:', stats.missed);

// Save
var output = {
    meta: { version: '11f5a2fc', total: stats.total, withHp: stats.withHp, withoutHp: stats.withoutHp, missed: stats.missed },
    map: stateMap
};
fs.writeFileSync(__dirname + '/vmp_complete_map.json', JSON.stringify(output, null, 2));
console.log('Saved vmp_complete_map.json (' + JSON.stringify(output).length + ' bytes)');

// Show sample hp entries
console.log('\n=== Sample hp dispatch entries ===');
var hpKeys = Object.keys(stateMap).filter(k => k.includes('_h')).slice(0, 10);
hpKeys.forEach(function(k) {
    var e = stateMap[k];
    console.log('  ' + k + ': hp=' + e.hp + ' next=' + e.next + ' code=' + e.code.substring(0, 100));
});

// Show Cbl=15 entries
console.log('\n=== Cbl=15 entries ===');
var c15Keys = Object.keys(stateMap).filter(k => k.startsWith('15_')).slice(0, 20);
c15Keys.forEach(function(k) {
    var e = stateMap[k];
    console.log('  ' + k + ': next=' + e.next + ' code=' + e.code.substring(0, 80));
});
