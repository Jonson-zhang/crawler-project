/**
 * Phase 1 v3: Extract VMP State Map from security-live.js
 *
 * Structure discovered:
 *   for(;p!==void0;) {
 *     switch(WSl=p&31) {
 *       case W: var zSl = function(){switch(jSl){...}}.apply();
 *         inside zSl: switch(jSl=(p>>5)&31) {
 *           case j: var a = function(){ FSl ternary chain }.apply();
 *             inside a: ExpressionStatement containing:
 *               0===FSl ? (op, p=N) : 1===FSl ? ... : void 0
 *         }
 *     }
 *   }
 *
 * This extracts: stateMap[state] = {W,j,F, ops, next}
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-live.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK');

// Find function l()
function findL(node, d) {
    if (d > 10) return null;
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) { var r = findL(node[i], d); if (r) return r; } return null; }
    if (!node || typeof node !== 'object' || !node.type) return null;
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'l') {
        var b = node.body.body;
        if (b && b[0] && b[0].type === 'TryStatement') {
            var tb = b[0].block.body;
            if (tb && tb[0] && tb[0].type === 'ForStatement') return node;
        }
    }
    for (var k in node) {
        if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' || k === 'leadingComments') continue;
        if (node[k] && typeof node[k] === 'object') { var r = findL(node[k], d + 1); if (r) return r; }
    }
    return null;
}

var lFunc = findL(ast.program, 0);
if (!lFunc) { console.error('l() not found'); process.exit(1); }
console.log('Found l()');

// Navigate to switch(WSl)
var forBody = lFunc.body.body[0].block.body[0].body.body; // try→for→BlockStatement
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}
if (!wSwitch) { console.error('switch(WSl) not found'); process.exit(1); }
console.log('switch(WSl) has ' + wSwitch.cases.length + ' cases');

// ====== Extraction ======
var stateMap = {};
var totalStates = 0;

/**
 * Parse a ternary condition chain to extract all (F, ops, next) tuples.
 * Pattern: F===N ? (ops, p=next) : (rest of chain)
 *          F===N ? p=next : (rest of chain)
 *          F===N ? p=cond?a:b : (rest of chain)
 */
function parseTernaryChain(ternaryNode) {
    var results = [];
    var current = ternaryNode;

    while (current && t.isConditionalExpression(current)) {
        var test = current.test;
        var consequent = current.consequent;
        var alternate = current.alternate;

        var fVal = null;
        // Extract F value: F===N or N===F
        if (t.isBinaryExpression(test)) {
            if (t.isIdentifier(test.left) && test.left.name === 'FSl' && t.isNumericLiteral(test.right)) {
                fVal = test.right.value;
            } else if (t.isIdentifier(test.right) && test.right.name === 'FSl' && t.isNumericLiteral(test.left)) {
                fVal = test.left.value;
            }
        }

        if (fVal !== null) {
            var ops = [];
            var nextStates = [];

            // Parse consequent: (op1, op2, ..., p=next)  OR  just p=next  OR  p=cond?a:b
            if (t.isSequenceExpression(consequent)) {
                // (op1, op2, ..., p=next)
                consequent.expressions.forEach(function(e) {
                    if (t.isAssignmentExpression(e)) {
                        if (t.isIdentifier(e.left) && e.left.name === 'p') {
                            extractPVals(e.right, nextStates);
                        } else {
                            ops.push({ type: 'assign', left: gen(e.left), right: gen(e.right).substring(0, 200) });
                        }
                    }
                });
            } else if (t.isAssignmentExpression(consequent)) {
                if (t.isIdentifier(consequent.left) && consequent.left.name === 'p') {
                    extractPVals(consequent.right, nextStates);
                } else {
                    ops.push({ type: 'assign', left: gen(consequent.left), right: gen(consequent.right).substring(0, 200) });
                }
            }

            results.push({ f: fVal, ops: ops, next: nextStates });
        }

        current = alternate;
    }

    return results;
}

function extractPVals(node, result) {
    if (t.isNumericLiteral(node)) {
        result.push(node.value);
    } else if (t.isConditionalExpression(node)) {
        if (t.isNumericLiteral(node.consequent)) result.push(node.consequent.value);
        if (t.isNumericLiteral(node.alternate)) {
            extractPVals(node.alternate, result);
        } else {
            result.push(null); // non-numeric = void 0
        }
    } else if (t.isUnaryExpression(node) && node.operator === 'void') {
        result.push(null); // void 0
    } else {
        result.push(null);
    }
}

/**
 * Get FunctionExpression from a .apply() wrapped CallExpression
 */
function getFnFromApply(callExpr) {
    if (!t.isCallExpression(callExpr)) return null;
    var callee = callExpr.callee;
    if (!t.isMemberExpression(callee)) return null;
    // callee.property should be 'apply' or 'call'
    return callee.object; // The FunctionExpression
}

// Walk all WSl cases
wSwitch.cases.forEach(function(wCase) {
    if (!wCase.test || !t.isNumericLiteral(wCase.test)) return;
    var wVal = wCase.test.value;

    // Find the jSl switch
    // Pattern: consequent[0] = var zSl = function(){switch(jSl){...}}.apply(...)
    for (var si = 0; si < wCase.consequent.length; si++) {
        var stmt = wCase.consequent[si];
        if (!t.isVariableDeclaration(stmt)) continue;

        for (var di = 0; di < stmt.declarations.length; di++) {
            var decl = stmt.declarations[di];
            if (!decl.init || !t.isCallExpression(decl.init)) continue;

            var outerFn = getFnFromApply(decl.init);
            if (!t.isFunctionExpression(outerFn)) continue;

            // Find switch(jSl) in outer function body
            var outerBody = outerFn.body.body;
            for (var oi = 0; oi < outerBody.length; oi++) {
                var oStmt = outerBody[oi];
                if (t.isSwitchStatement(oStmt)) {
                    var disc = gen(oStmt.discriminant);
                    if (disc.indexOf('jSl') < 0) continue;

                    // Process each jSl case
                    oStmt.cases.forEach(function(jCase) {
                        if (!jCase.test || !t.isNumericLiteral(jCase.test)) return;
                        var jVal = jCase.test.value;

                        // Find inner function with FSl ternary chain
                        // Pattern: jCase.consequent[0] = var a = function(){...}.apply(...)
                        for (var ci = 0; ci < jCase.consequent.length; ci++) {
                            var cStmt = jCase.consequent[ci];
                            if (!t.isVariableDeclaration(cStmt)) continue;

                            for (var cdi = 0; cdi < cStmt.declarations.length; cdi++) {
                                var cDecl = cStmt.declarations[cdi];
                                if (!cDecl.init || !t.isCallExpression(cDecl.init)) continue;

                                var innerFn = getFnFromApply(cDecl.init);
                                if (!t.isFunctionExpression(innerFn)) continue;

                                // The inner function body has a single ExpressionStatement
                                // containing the ternary chain
                                var innerBody = innerFn.body.body;
                                for (var ii = 0; ii < innerBody.length; ii++) {
                                    var iStmt = innerBody[ii];
                                    if (t.isExpressionStatement(iStmt) && t.isConditionalExpression(iStmt.expression)) {
                                        var entries = parseTernaryChain(iStmt.expression);
                                        entries.forEach(function(entry) {
                                            var stateKey = (entry.f << 10) | (jVal << 5) | wVal;
                                            stateMap[stateKey] = {
                                                w: wVal,
                                                j: jVal,
                                                f: entry.f,
                                                state: stateKey,
                                                ops: entry.ops,
                                                next: entry.next
                                            };
                                            totalStates++;
                                        });
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
    }
});

console.log('Total states extracted: ' + totalStates);

// Sort and save
var sorted = {};
Object.keys(stateMap).map(Number).sort(function(a, b) { return a - b; }).forEach(function(k) {
    sorted[k] = stateMap[k];
});
fs.writeFileSync(__dirname + '/vmp_state_map.json', JSON.stringify(sorted, null, 2));
console.log('Saved vmp_state_map.json (' + Object.keys(sorted).length + ' entries)');

// ===== Analysis =====
var browserStates = [
    21867, 3218, 2310, 1219, 2096, 6319, 2273, 20975, 7279, 7299,
    18784, 15635, 6798, 16834, 15984, 22059, 16974, 2164, 10689, 1481, 22017,
    3208, 16420, 20843, 397, 1194, 1709, 2527, 3216, 3432, 3655, 4037,
    8436, 10734, 12144, 15122, 16058, 20492, 20754, 20842, 21058, 21065,
    21649, 21783, 24916, 25624, 26712, 31589
];

var found = 0, missing = [];
browserStates.forEach(function(s) {
    if (sorted[s]) found++;
    else missing.push(s);
});
console.log('\nBrowser states: ' + found + '/' + browserStates.length + ' found in map');
if (missing.length > 0) {
    console.log('Missing: ' + JSON.stringify(missing));
}

// Show sample entries
console.log('\nSample entries (first 5):');
Object.keys(sorted).slice(0, 5).forEach(function(k) {
    var s = sorted[k];
    console.log('  state=' + k + ' W=' + s.w + ' j=' + s.j + ' F=' + s.f +
        ' ops=' + JSON.stringify(s.ops).substring(0, 120) +
        ' next=' + JSON.stringify(s.next));
});

// Show the most important browser states
console.log('\nKey browser states:');
[16974, 2164, 2273, 10689, 15635, 3218, 21867].forEach(function(s) {
    var e = sorted[s];
    if (e) {
        console.log('  [' + s + '] W=' + e.w + ' j=' + e.j + ' F=' + e.f +
            ' ops=' + JSON.stringify(e.ops).substring(0, 150) +
            ' next=' + JSON.stringify(e.next));
    } else {
        console.log('  [' + s + '] MISSING');
    }
});
