/**
 * Extract VMP State Map from security-11f5a2fc.js (2026 version)
 *
 * VMP Structure:
 *   for(;p!==void0;) {
 *     Cbl = 31 & p, Ebl = 31 & p >> 5, Rbl = 31 & p >> 10;
 *     switch(Cbl) {
 *       case N: var fn = function(){switch(Ebl){...}}.apply();
 *         inside: switch(Ebl) {
 *           case M: var inner = function(){switch(Rbl){...}}.apply();
 *             inside: switch(Rbl) {
 *               case K: <operations>; p = <next>; break;
 *             }
 *         }
 *     }
 *   }
 *
 * Also handles: 4th level dispatch via hp variable (0===hp? ... : 1===hp? ...)
 *
 * Output: vmp_state_map_2026.json
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
console.log('File size:', code.length, 'bytes');

var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK');

// ===== Find function l() =====
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
                    var r = findL(node[k][i], d + 1);
                    if (r) return r;
                }
            } else {
                var r = findL(node[k], d + 1);
                if (r) return r;
            }
        }
    }
    return null;
}

var lFunc = findL(ast.program, 0);
if (!lFunc) { console.error('function l() not found!'); process.exit(1); }
console.log('Found function l()');

// Navigate: l → try → for → body
var forBody = lFunc.body.body[0].block.body[0].body.body;

// Find switch(Cbl) — the outer switch
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}
if (!wSwitch) { console.error('Outer switch(Cbl) not found'); process.exit(1); }
console.log('Outer switch has', wSwitch.cases.length, 'cases');

// ====== Extraction ======
var stateMap = {};
var totalStates = 0;
var skipped = 0;

// Helper: extract the next p value from operation sequence
function findPValue(node) {
    if (!node) return null;
    if (t.isAssignmentExpression(node) && t.isIdentifier(node.left) && node.left.name === 'p') {
        if (t.isNumericLiteral(node.right)) return node.right.value;
    }
    if (t.isSequenceExpression(node)) {
        var exps = node.expressions;
        for (var i = 0; i < exps.length; i++) {
            var v = findPValue(exps[i]);
            if (v !== null) return v;
        }
    }
    if (t.isConditionalExpression(node)) {
        var cv = findPValue(node.consequent);
        if (cv !== null) return cv;
        var av = findPValue(node.alternate);
        if (av !== null) return av;
    }
    return null;
}

// Check if a ternary node is an hp dispatch (0===hp?...:1===hp?...)
function isHpDispatch(test) {
    if (!t.isBinaryExpression(test)) return false;
    var left = test.left, right = test.right, op = test.operator;
    if (op !== '===') return false;
    if (t.isNumericLiteral(left) && t.isIdentifier(right) && right.name === 'hp') return true;
    if (t.isNumericLiteral(right) && t.isIdentifier(left) && left.name === 'hp') return true;
    return false;
}

function extractHpValue(test) {
    if (t.isNumericLiteral(test.left)) return test.left.value;
    if (t.isNumericLiteral(test.right)) return test.right.value;
    return null;
}

// Parse the innermost switch(Rbl) case body to extract operations and hp dispatch
function parseRblCaseBody(bodyNode) {
    // bodyNode could be:
    // 1. Direct expression: (ops, p=next)
    // 2. function(){...}.apply(...) containing hp dispatch
    // 3. ConditionalExpression with hp dispatch

    if (t.isExpressionStatement(bodyNode)) {
        var expr = bodyNode.expression;

        // Check if it's a call expression wrapping hp logic
        if (t.isCallExpression(expr)) {
            var callee = expr.callee;
            if (t.isMemberExpression(callee) && callee.property.name === 'apply') {
                var fn = callee.object;
                if (t.isFunctionExpression(fn)) {
                    // Extract hp dispatch from inside this function
                    return extractHpDispatch(fn.body);
                }
            }
        }

        // Direct ternary: 0===hp ? ... : 1===hp ? ...
        if (t.isConditionalExpression(expr) && isHpDispatch(expr.test)) {
            return extractHpChain(expr);
        }

        // Direct assignment
        var code = gen(expr);
        var nextP = findPValue(expr);
        return { ops: code, next: nextP };
    }

    if (t.isBlockStatement(bodyNode)) {
        var code = gen(bodyNode);
        return { ops: code, next: null };
    }

    return null;
}

function extractHpDispatch(fnBody) {
    // fnBody.body[0] is typically a ConditionalExpression with hp dispatch
    if (!fnBody.body || fnBody.body.length === 0) return null;
    var stmt = fnBody.body[0];

    if (t.isExpressionStatement(stmt) && t.isConditionalExpression(stmt.expression)) {
        return extractHpChain(stmt.expression);
    }

    if (t.isReturnStatement(stmt) && t.isConditionalExpression(stmt.argument)) {
        return extractHpChain(stmt.argument);
    }

    return { ops: gen(fnBody), next: null };
}

function extractHpChain(ternaryNode) {
    var branches = {};
    var current = ternaryNode;

    while (current && t.isConditionalExpression(current)) {
        var hpVal = extractHpValue(current.test);
        if (hpVal === null) break;

        var ops = gen(current.consequent);
        var nextP = findPValue(current.consequent);
        branches[hpVal] = { ops: ops, next: nextP };

        current = current.alternate;
    }

    // Last alternate (else branch) or void 0
    if (current && !t.isConditionalExpression(current)) {
        if (t.isUnaryExpression(current) && current.operator === 'void') {
            // void 0 — nothing
        } else {
            branches['_else'] = { ops: gen(current), next: findPValue(current) };
        }
    }

    return branches;
}

// Process each outer switch case
wSwitch.cases.forEach(function(wCase, wIdx) {
    var wVal = null;
    if (wCase.test && t.isNumericLiteral(wCase.test)) {
        wVal = wCase.test.value;
    }
    // Skip default case
    if (wVal === null) return;

    var wBody = wCase.consequent;

    // Each W case has: var Tbl = function(){switch(Ebl){...}}.apply(this,arguments);
    //                     if(result) return result;
    //                     break;
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

            // Inside this function: switch(Ebl){...}
            var fnBody = fn.body.body;
            var eSwitch = null;
            for (var fi = 0; fi < fnBody.length; fi++) {
                if (t.isSwitchStatement(fnBody[fi])) { eSwitch = fnBody[fi]; break; }
            }
            if (!eSwitch) continue;

            // Process each Ebl case
            eSwitch.cases.forEach(function(eCase, eIdx) {
                var eVal = null;
                if (eCase.test && t.isNumericLiteral(eCase.test)) {
                    eVal = eCase.test.value;
                }
                if (eVal === null) return;

                var eBody = eCase.consequent;

                // Each E case has: var inner = function(){switch(Rbl){...}}.apply(this,arguments);
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

                        // Inside this function: switch(Rbl){...}
                        var eFnBody = eFn.body.body;
                        var rSwitch = null;
                        for (var rfi = 0; rfi < eFnBody.length; rfi++) {
                            if (t.isSwitchStatement(eFnBody[rfi])) { rSwitch = eFnBody[rfi]; break; }
                        }
                        if (!rSwitch) continue;

                        // Process each Rbl case — these contain the actual business logic
                        rSwitch.cases.forEach(function(rCase, rIdx) {
                            var rVal = null;
                            if (rCase.test && t.isNumericLiteral(rCase.test)) {
                                rVal = rCase.test.value;
                            }
                            if (rVal === null) return;

                            var stateKey = wVal + '_' + eVal + '_' + rVal;
                            var rBody = rCase.consequent;

                            // Extract operations from the R case body
                            if (rBody.length >= 1) {
                                var result = parseRblCaseBody(rBody[0]);
                                if (result) {
                                    stateMap[stateKey] = { W: wVal, E: eVal, R: rVal, data: result };
                                    totalStates++;
                                } else {
                                    skipped++;
                                }
                            }
                        });
                    }
                }
            });
        }
    }
});

console.log('Total states extracted:', totalStates);
console.log('Skipped:', skipped);

// Save
fs.writeFileSync(__dirname + '/vmp_state_map_2026.json', JSON.stringify(stateMap, null, 2));
console.log('Saved to vmp_state_map_2026.json');
console.log('Sample entries:');
var keys = Object.keys(stateMap).slice(0, 5);
keys.forEach(function(k) {
    console.log('  ' + k + ':', JSON.stringify(stateMap[k]).substring(0, 200));
});
