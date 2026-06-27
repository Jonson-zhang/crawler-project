/**
 * Phase 1 Final: Complete VMP State Map Extraction
 *
 * Handles:
 * 1. FSl ternary chains (N===FSl ? (op, p=next) : ...)
 * 2. Direct expressions without FSl checks (case j: (op, p=next); break;)
 * 3. DEFAULT cases for WSl and jSl switches (catch W=21-31, j=22-31)
 * 4. l.apply(this, [N].concat(args)) — nested state creation
 *
 * Output: vmp_state_map.json
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-live.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK');

// ===== Find function l() =====
// l() is inside: program → ExpressionStatement → SequenceExpression → ...IIFE... → l()
function findL(node, d) {
    if (d > 12 || !node) return null;

    // Base: found it
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'l') {
        var b = node.body.body;
        if (b && b[0] && b[0].type === 'TryStatement') {
            var tb = b[0].block.body;
            if (tb && tb[0] && tb[0].type === 'ForStatement') return node;
        }
    }

    // Only recurse into structural keys
    var keys = [];
    for (var k in node) {
        if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' ||
            k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' ||
            k === 'extra' || k === 'raw' || k === 'rawValue') continue;
        if (node[k] && typeof node[k] === 'object') keys.push(k);
    }

    // Recurse with depth limit
    for (var i = 0; i < keys.length; i++) {
        var val = node[keys[i]];
        if (Array.isArray(val)) {
            for (var j = 0; j < Math.min(val.length, 50); j++) {
                var r = findL(val[j], d + 1);
                if (r && r !== 'dead') return r;
            }
        } else if (val.type !== undefined) {
            var r = findL(val, d + 1);
            if (r && r !== 'dead') return r;
        }
    }
    return null;
}

// Prevent infinite recursion on pathological cycles
var _findCount = 0;
var origFindL = findL;
findL = function(node, d) {
    _findCount++;
    if (_findCount > 50000) return 'dead';
    return origFindL(node, d);
};

var lFunc = findL(ast.program, 0);
if (!lFunc) { console.error('l() not found'); process.exit(1); }
console.log('Found l()');

var forBody = lFunc.body.body[0].block.body[0].body.body; // try→for→BlockStatement

// Find switch(WSl)
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}
if (!wSwitch) { console.error('switch(WSl) not found'); process.exit(1); }
console.log('WSl cases:', wSwitch.cases.length, '(including default)');

// ====== Extraction State ======
var stateMap = {};
var totalStates = 0;

/** Parse ternary chain: F===N ? (ops, p=next) : rest */
function parseTernaryChain(ternaryNode) {
    var results = [];
    var current = ternaryNode;

    while (current && t.isConditionalExpression(current)) {
        var test = current.test;
        var consequent = current.consequent;
        var alternate = current.alternate;

        var fVal = null;
        if (t.isBinaryExpression(test)) {
            // FSl === N
            if (t.isIdentifier(test.left) && test.left.name === 'FSl' && t.isNumericLiteral(test.right)) {
                fVal = test.right.value;
            // N === FSl
            } else if (t.isNumericLiteral(test.left) && t.isIdentifier(test.right) && test.right.name === 'FSl') {
                fVal = test.left.value;
            }
        }

        if (fVal !== null) {
            var ops = [];
            var nextStates = [];
            extractFromConsequent(consequent, ops, nextStates);
            results.push({ f: fVal, ops: ops, next: nextStates });
        }

        current = alternate;
    }

    return results;
}

/** Extract ops and next states from a ternary branch consequent */
function extractFromConsequent(node, ops, next) {
    if (t.isSequenceExpression(node)) {
        node.expressions.forEach(function(e) {
            if (t.isAssignmentExpression(e)) {
                if (t.isIdentifier(e.left) && e.left.name === 'p') {
                    extractPVals(e.right, next);
                } else {
                    ops.push({ type: 'assign', left: gen(e.left), right: gen(e.right).substring(0, 200) });
                }
            }
        });
    } else if (t.isAssignmentExpression(node)) {
        if (t.isIdentifier(node.left) && node.left.name === 'p') {
            extractPVals(node.right, next);
        } else {
            ops.push({ type: 'assign', left: gen(node.left), right: gen(node.right).substring(0, 200) });
        }
    }
}

function extractPVals(node, result) {
    if (t.isNumericLiteral(node)) {
        result.push(node.value);
    } else if (t.isConditionalExpression(node)) {
        if (t.isNumericLiteral(node.consequent)) result.push(node.consequent.value);
        extractPVals(node.alternate, result);
    } else if (t.isUnaryExpression(node) && node.operator === 'void') {
        result.push(null);
    } else {
        // Complex expression — record as string
        result.push('?' + gen(node).substring(0, 60));
    }
}

/** Get FunctionExpression from .apply() wrapped CallExpression */
function getFnFromApply(callExpr) {
    if (!t.isCallExpression(callExpr)) return null;
    var callee = callExpr.callee;
    if (!t.isMemberExpression(callee)) return callee; // Direct function call
    return callee.object; // The FunctionExpression
}

/** Extract jSl switch from a WSl case body */
function getJSwitchFromWCase(caseBody) {
    for (var si = 0; si < caseBody.length; si++) {
        var stmt = caseBody[si];
        if (!t.isVariableDeclaration(stmt)) continue;
        for (var di = 0; di < stmt.declarations.length; di++) {
            var decl = stmt.declarations[di];
            if (!decl.init || !t.isCallExpression(decl.init)) continue;
            var fn = getFnFromApply(decl.init);
            if (!t.isFunctionExpression(fn)) continue;
            var body = fn.body.body;
            for (var fi = 0; fi < body.length; fi++) {
                if (t.isSwitchStatement(body[fi])) return body[fi];
            }
        }
    }
    return null;
}

/** Extract FSl dispatch from a jSl case body */
function getFSlDispatchFromJCase(caseBody) {
    for (var ci = 0; ci < caseBody.length; ci++) {
        var stmt = caseBody[ci];
        // Direct ExpressionStatement: (op, p=N); or ternary
        if (t.isExpressionStatement(stmt)) {
            if (t.isConditionalExpression(stmt.expression)) return { type: 'ternary', node: stmt.expression };
            if (t.isSequenceExpression(stmt.expression)) return { type: 'direct', node: stmt.expression };
            if (t.isAssignmentExpression(stmt.expression)) return { type: 'direct', node: stmt.expression };
        }
        // VariableDeclaration: var a = function(){...}.apply()
        if (t.isVariableDeclaration(stmt)) {
            for (var di = 0; di < stmt.declarations.length; di++) {
                var decl = stmt.declarations[di];
                if (!decl.init || !t.isCallExpression(decl.init)) continue;
                var fn = getFnFromApply(decl.init);
                if (!t.isFunctionExpression(fn)) continue;
                var body = fn.body.body;
                for (var fi = 0; fi < body.length; fi++) {
                    var bStmt = body[fi];
                    // switch(FSl) pattern
                    if (t.isSwitchStatement(bStmt)) return { type: 'switch', node: bStmt };
                    // Ternary chain
                    if (t.isExpressionStatement(bStmt)) {
                        if (t.isConditionalExpression(bStmt.expression)) return { type: 'ternary', node: bStmt.expression };
                        if (t.isSequenceExpression(bStmt.expression)) return { type: 'direct', node: bStmt.expression };
                    }
                }
            }
        }
    }
    return null;
}

/** Parse FSl switch statement to extract all (F, ops, next) tuples */
function parseFSlSwitch(switchNode) {
    var results = [];
    switchNode.cases.forEach(function(fCase) {
        var fVal = fCase.test && t.isNumericLiteral(fCase.test) ? fCase.test.value : null;
        if (fVal === null) return;
        var ops = [], next = [];
        fCase.consequent.forEach(function(s) {
            if (t.isExpressionStatement(s)) {
                extractFromConsequent(s.expression, ops, next);
            }
        });
        results.push({ f: fVal, ops: ops, next: next });
    });
    return results;
}

/** Process a jSl case and add states to the map */
function processJCase(jVal, caseBody, wVal) {
    var dispatch = getFSlDispatchFromJCase(caseBody);

    if (dispatch && dispatch.type === 'ternary') {
        var entries = parseTernaryChain(dispatch.node);
        entries.forEach(function(entry) {
            addState((entry.f << 10) | (jVal << 5) | wVal, wVal, jVal, entry.f, entry.ops, entry.next);
        });
    } else if (dispatch && dispatch.type === 'switch') {
        var entries2 = parseFSlSwitch(dispatch.node);
        entries2.forEach(function(entry) {
            addState((entry.f << 10) | (jVal << 5) | wVal, wVal, jVal, entry.f, entry.ops, entry.next);
        });
    } else if (dispatch && dispatch.type === 'direct') {
        var ops = [], next = [];
        extractFromConsequent(dispatch.node, ops, next);
        for (var f = 0; f <= 21; f++) {
            addState((f << 10) | (jVal << 5) | wVal, wVal, jVal, f, ops, next);
        }
    }
}

function addState(stateKey, w, j, f, ops, next) {
    stateMap[stateKey] = { w: w, j: j, f: f, state: stateKey, ops: ops, next: next };
    totalStates++;
}

// ====== Main extraction loop ======

// Process all WSl cases (including default)
wSwitch.cases.forEach(function(wCase) {
    var wVal = wCase.test && t.isNumericLiteral(wCase.test) ? wCase.test.value : 'default';
    var jSwitch = getJSwitchFromWCase(wCase.consequent);

    if (jSwitch) {
        // Process jSl cases (including default)
        jSwitch.cases.forEach(function(jCase) {
            var jVal = jCase.test && t.isNumericLiteral(jCase.test) ? jCase.test.value : 'default';
            if (wVal !== 'default' && jVal !== 'default') {
                processJCase(jVal, jCase.consequent, wVal);
            } else if (wVal !== 'default' && jVal === 'default') {
                // jSl default: apply to ALL j values 22-31
                for (var jUnhandled = 22; jUnhandled <= 31; jUnhandled++) {
                    processJCase(jUnhandled, jCase.consequent, wVal);
                }
            } else if (wVal === 'default' && jVal !== 'default') {
                // WSl default: apply to ALL w values 21-31
                for (var wUnhandled = 21; wUnhandled <= 31; wUnhandled++) {
                    processJCase(jVal, jCase.consequent, wUnhandled);
                }
            }
        });
    }
});

console.log('Total states: ' + totalStates);

// ===== Save =====
var sorted = {};
Object.keys(stateMap).map(Number).sort(function(a, b) { return a - b; }).forEach(function(k) {
    sorted[k] = stateMap[k];
});
fs.writeFileSync(__dirname + '/vmp_state_map.json', JSON.stringify(sorted, null, 2));
console.log('Saved vmp_state_map.json (' + Object.keys(sorted).length + ' entries)');

// ===== Cross-check with browser trace =====
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
console.log('\nBrowser states covered: ' + found + '/' + browserStates.length);
if (missing.length > 0) {
    console.log('Still missing (' + missing.length + '): ' + JSON.stringify(missing));
    // Decode missing
    console.log('Decoded:');
    missing.forEach(function(s) {
        var w = s & 31, j = (s >> 5) & 31, f = (s >> 10) & 31;
        console.log('  ' + s + ' → W=' + w + ' j=' + j + ' F=' + f);
    });
}

// Show top browser states
console.log('\nTop browser states:');
[16974, 2164, 2273, 10689, 15635, 3218, 21867, 20975, 20843].forEach(function(s) {
    var e = sorted[s];
    if (e) {
        console.log('  [' + s + '] W=' + e.w + ' j=' + e.j + ' F=' + e.f +
            ' ops=' + JSON.stringify(e.ops).substring(0, 120) +
            ' next=' + JSON.stringify(e.next));
    } else {
        console.log('  [' + s + '] MISSING');
    }
});
