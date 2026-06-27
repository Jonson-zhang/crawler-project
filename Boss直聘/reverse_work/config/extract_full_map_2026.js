/**
 * Extract COMPLETE VMP state map from security-11f5a2fc.js
 * Captures all 4 levels: Cbl → Ebl → Rbl → hp
 * For each (Cbl, Ebl, Rbl, hp) combination, extracts:
 *   - Operations (JS code)
 *   - Next state (p value)
 *   - Whether this is an environment check
 *
 * Output: vmp_full_map_2026.json
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK,', code.length, 'bytes');

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

var forBody = lFunc.body.body[0].block.body[0].body.body;
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}
if (!wSwitch) { console.error('Outer switch not found'); process.exit(1); }
console.log('Outer switch:', wSwitch.cases.length, 'cases');

// ====== EXTRACTION ======
var stateMap = {};  // key: "Cbl_Ebl_Rbl_hp" → {ops, next, isEnvCheck}
var statesByCER = {};  // key: "Cbl_Ebl_Rbl" → {hp branches, hasHpDispatch}
var envChecks = {};  // key: "Cbl_Ebl_Rbl_hp" → details of what's checked
var totalStates = 0;
var totalHpStates = 0;

// Detect environment-related operations by keyword
var ENV_KEYWORDS = [
    'navigator', 'window', 'document', 'screen', 'canvas', 'webgl',
    'typeof', 'toString', 'prototype', 'constructor', 'instanceof',
    'getTimezoneOffset', 'charCodeAt', 'fromCharCode',
    'userAgent', 'plugins', 'mimeTypes', 'cookie', 'localStorage',
    'webdriver', 'chrome', 'safari', 'firefox',
    'HTMLElement', 'HTMLDocument', 'SVG', 'Audio', 'OfflineAudio',
    'performance', 'crypto', 'Math.random', 'Date.now',
    'Geolocation', 'NodeIterator', 'CSS', 'MutationObserver',
];

function isEnvCheck(code) {
    for (var i = 0; i < ENV_KEYWORDS.length; i++) {
        if (code.indexOf(ENV_KEYWORDS[i]) >= 0) return true;
    }
    return false;
}

function findPValue(node) {
    if (!node) return null;
    if (t.isAssignmentExpression(node) && t.isIdentifier(node.left) && node.left.name === 'p') {
        if (t.isNumericLiteral(node.right)) return node.right.value;
        if (t.isConditionalExpression(node.right)) {
            return findPValue(node.right.consequent) || findPValue(node.right.alternate);
        }
    }
    if (t.isSequenceExpression(node)) {
        for (var i = 0; i < node.expressions.length; i++) {
            var v = findPValue(node.expressions[i]);
            if (v !== null) return v;
        }
    }
    if (t.isConditionalExpression(node)) {
        return findPValue(node.consequent) || findPValue(node.alternate);
    }
    return null;
}

function findPInCode(codeStr) {
    var m = codeStr.match(/p\s*=\s*(\d+)/);
    return m ? parseInt(m[1]) : null;
}

function extractHpValue(testNode) {
    if (!t.isBinaryExpression(testNode) || testNode.operator !== '===') return null;
    if (t.isNumericLiteral(testNode.left) && t.isIdentifier(testNode.right) && testNode.right.name === 'hp') return testNode.left.value;
    if (t.isNumericLiteral(testNode.right) && t.isIdentifier(testNode.left) && testNode.left.name === 'hp') return testNode.right.value;
    return null;
}

function isHpCheck(testNode) {
    if (!t.isBinaryExpression(testNode) || testNode.operator !== '===') return false;
    return (t.isNumericLiteral(testNode.left) && t.isIdentifier(testNode.right) && testNode.right.name === 'hp') ||
           (t.isNumericLiteral(testNode.right) && t.isIdentifier(testNode.left) && testNode.left.name === 'hp');
}

// Extract hp dispatch from a ConditionalExpression chain
function extractHpChain(ternaryNode) {
    var branches = [];
    var current = ternaryNode;

    while (current && t.isConditionalExpression(current)) {
        var hpVal = extractHpValue(current.test);
        if (hpVal === null) break;

        var opsCode = gen(current.consequent);
        var nextP = findPValue(current.consequent);
        if (nextP === null) nextP = findPInCode(opsCode);

        branches.push({
            hp: hpVal,
            ops: opsCode,
            next: nextP,
            isEnv: isEnvCheck(opsCode)
        });

        current = current.alternate;
    }

    // Last alternate
    if (current) {
        if (t.isUnaryExpression(current) && current.operator === 'void') {
            // void 0 — terminal
        } else {
            var opsCode = gen(current);
            var nextP = findPValue(current);
            if (nextP === null) nextP = findPInCode(opsCode);
            branches.push({
                hp: '_default',
                ops: opsCode,
                next: nextP,
                isEnv: isEnvCheck(opsCode)
            });
        }
    }

    return branches;
}

// Parse an Rbl case body to extract operations
function parseRblCaseBody(bodyStmt) {
    if (!bodyStmt) return null;

    if (t.isExpressionStatement(bodyStmt)) {
        var expr = bodyStmt.expression;

        // Case 1: p = N (direct state transition)
        if (t.isAssignmentExpression(expr) && t.isIdentifier(expr.left) && expr.left.name === 'p') {
            return {
                type: 'direct_p',
                ops: gen(expr),
                next: findPValue(expr),
            };
        }

        // Case 2: (ops, p = N) — comma expression
        if (t.isSequenceExpression(expr)) {
            var opsCode = gen(expr);
            var nextP = findPValue(expr);
            return {
                type: 'sequence',
                ops: opsCode,
                next: nextP,
            };
        }

        // Case 3: var fn = function(){...}.apply(...) — wrapping hp dispatch
        if (t.isCallExpression(expr)) {
            var callee = expr.callee;
            if (t.isMemberExpression(callee) && callee.property.name === 'apply') {
                var fn = callee.object;
                if (t.isFunctionExpression(fn) && fn.body.body.length > 0) {
                    var fnBodyExpr = fn.body.body[0];

                    // Check for hp dispatch inside
                    if (t.isExpressionStatement(fnBodyExpr)) {
                        var inner = fnBodyExpr.expression;
                        if (t.isConditionalExpression(inner) && isHpCheck(inner.test)) {
                            return {
                                type: 'hp_dispatch',
                                branches: extractHpChain(inner),
                            };
                        }
                    }

                    // Check for direct return
                    if (t.isReturnStatement(fnBodyExpr)) {
                        return {
                            type: 'return',
                            ops: gen(fnBodyExpr.argument),
                            next: findPValue(fnBodyExpr.argument) || findPInCode(gen(fnBodyExpr.argument)),
                        };
                    }

                    // Check for nested switch
                    if (t.isSwitchStatement(fnBodyExpr)) {
                        return {
                            type: 'nested_switch',
                            ops: gen(fn.body),
                        };
                    }

                    return {
                        type: 'fn_apply',
                        ops: gen(fn.body),
                        next: findPValue(expr) || findPInCode(gen(expr)),
                    };
                }
            }
        }

        // Case 4: hp dispatch directly (0===hp ? ... : 1===hp ? ...)
        if (t.isConditionalExpression(expr) && isHpCheck(expr.test)) {
            return {
                type: 'hp_dispatch',
                branches: extractHpChain(expr),
            };
        }

        return {
            type: 'unknown_expr',
            ops: gen(expr),
            next: findPValue(expr) || findPInCode(gen(expr)),
        };
    }

    if (t.isVariableDeclaration(bodyStmt)) {
        return {
            type: 'var_decl',
            ops: gen(bodyStmt),
        };
    }

    if (t.isReturnStatement(bodyStmt)) {
        return {
            type: 'return',
            ops: gen(bodyStmt.argument),
        };
    }

    if (t.isIfStatement(bodyStmt)) {
        return {
            type: 'if',
            ops: gen(bodyStmt),
            next: findPValue(bodyStmt) || findPInCode(gen(bodyStmt)),
        };
    }

    return null;
}

// === Main extraction loop ===
wSwitch.cases.forEach(function(wCase) {
    var Cbl = null;
    if (wCase.test && t.isNumericLiteral(wCase.test)) Cbl = wCase.test.value;
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

            // Inner: switch(Ebl)
            var fnBody = fn.body.body;
            var eSwitch = null;
            for (var fi = 0; fi < fnBody.length; fi++) {
                if (t.isSwitchStatement(fnBody[fi])) { eSwitch = fnBody[fi]; break; }
            }
            if (!eSwitch) continue;

            eSwitch.cases.forEach(function(eCase) {
                var Ebl = null;
                if (eCase.test && t.isNumericLiteral(eCase.test)) Ebl = eCase.test.value;
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

                        // Innermost: switch(Rbl)
                        var eFnBody = eFn.body.body;
                        var rSwitch = null;
                        for (var rfi = 0; rfi < eFnBody.length; rfi++) {
                            if (t.isSwitchStatement(eFnBody[rfi])) { rSwitch = eFnBody[rfi]; break; }
                        }
                        if (!rSwitch) continue;

                        rSwitch.cases.forEach(function(rCase) {
                            var Rbl = null;
                            if (rCase.test && t.isNumericLiteral(rCase.test)) Rbl = rCase.test.value;
                            if (Rbl === null) return;

                            var cerKey = Cbl + '_' + Ebl + '_' + Rbl;
                            var rBody = rCase.consequent;
                            var result = null;

                            if (rBody.length >= 1) {
                                result = parseRblCaseBody(rBody[0]);
                            }

                            if (result) {
                                if (!statesByCER[cerKey]) statesByCER[cerKey] = { Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, result: result };
                                totalStates++;

                                // For hp dispatch, create separate entries per hp value
                                if (result.type === 'hp_dispatch' && result.branches) {
                                    result.branches.forEach(function(branch) {
                                        var hpKey = cerKey + '_' + branch.hp;
                                        stateMap[hpKey] = {
                                            Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, hp: branch.hp,
                                            ops: branch.ops,
                                            next: branch.next,
                                            isEnv: branch.isEnv
                                        };
                                        if (branch.isEnv) {
                                            envChecks[hpKey] = stateMap[hpKey];
                                        }
                                        totalHpStates++;
                                    });
                                } else if (result.next !== null && result.next !== undefined) {
                                    // Direct state, no hp dispatch
                                    var hpKey = cerKey + '_-';
                                    stateMap[hpKey] = {
                                        Cbl: Cbl, Ebl: Ebl, Rbl: Rbl, hp: null,
                                        ops: result.ops,
                                        next: result.next,
                                        isEnv: isEnvCheck(result.ops)
                                    };
                                    if (stateMap[hpKey].isEnv) {
                                        envChecks[hpKey] = stateMap[hpKey];
                                    }
                                    totalHpStates++;
                                }
                            }
                        });
                    }
                }
            });
        }
    }
});

console.log('Total CER states:', totalStates);
console.log('Total hp-level states:', totalHpStates);
console.log('Environment checks:', Object.keys(envChecks).length);

// ===== Build reachability graph =====
// For each state, determine which states it can transition to
var adjacency = {};
Object.keys(stateMap).forEach(function(k) {
    var entry = stateMap[k];
    if (entry.next !== null && entry.next !== undefined) {
        // Decode next: Cbl = next & 31, Ebl = (next>>5) & 31, Rbl = (next>>10) & 31
        var nextP = entry.next;
        var nextCbl = nextP & 31;
        var nextEbl = (nextP >> 5) & 31;
        var nextRbl = (nextP >> 10) & 31;
        entry.nextCER = nextCbl + '_' + nextEbl + '_' + nextRbl;
    }
});

// ===== Walk the VMP to find the path from initial state =====
// l() is called with arguments[0] = p (initial state)
// We need to know the initial p value from how ABC.z() is called
// Looking at the code: yp="ABC" at some state, then later ABC.z is called
// The initial p is passed as argument to l()

// Save the map
var output = {
    meta: {
        totalCERStates: totalStates,
        totalHpStates: totalHpStates,
        envCheckCount: Object.keys(envChecks).length,
        version: '11f5a2fc',
    },
    statesByCER: statesByCER,
    statesByHp: stateMap,
    envChecks: envChecks,
};

fs.writeFileSync(__dirname + '/vmp_full_map_2026.json', JSON.stringify(output, null, 2));
console.log('Saved vmp_full_map_2026.json (' + JSON.stringify(output).length + ' bytes)');

// Print some samples
console.log('\n=== Sample states ===');
var keys = Object.keys(stateMap).slice(0, 10);
keys.forEach(function(k) {
    var s = stateMap[k];
    console.log('  ' + k + ': next=' + s.next + ' env=' + s.isEnv + ' ops=' + s.ops.substring(0, 80));
});

console.log('\n=== Sample env checks ===');
var ekeys = Object.keys(envChecks).slice(0, 10);
ekeys.forEach(function(k) {
    var s = envChecks[k];
    console.log('  ' + k + ': ' + s.ops.substring(0, 100));
});
