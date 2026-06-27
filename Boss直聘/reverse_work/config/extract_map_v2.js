/**
 * Phase 1 v2: Direct AST walk to extract VMP state map
 * Structure: for() { switch(WSl) { case W: func{ switch(jSl) { case j: func{ if(FSl===F){...} } } } } }
 * Output: stateMap[state] = {W,j,F, ops, next}
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var gen = require('@babel/generator').default;
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-live.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });

function g(node) { return gen(node).code; }

function findNode(root, targetType, targetName, maxDepth) {
    if (maxDepth <= 0 || !root) return null;
    if (Array.isArray(root)) {
        for (var i = 0; i < root.length; i++) {
            var r = findNode(root[i], targetType, targetName, maxDepth);
            if (r) return r;
        }
        return null;
    }
    if (typeof root !== 'object' || !root.type) return null;

    // Match
    if (targetType === 'FunctionDeclaration' && root.type === 'FunctionDeclaration' && root.id && root.id.name === targetName) {
        // verify it's the VMP: has TryStatement with ForStatement
        var body = root.body.body;
        if (body && body.length > 0 && body[0].type === 'TryStatement') {
            var tb = body[0].block.body;
            if (tb && tb.length > 0 && tb[0].type === 'ForStatement') {
                return root;
            }
        }
    }

    // Recurse
    for (var key in root) {
        if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' ||
            key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
        var val = root[key];
        if (val && typeof val === 'object') {
            var r = findNode(val, targetType, targetName, maxDepth - 1);
            if (r) return r;
        }
    }
    return null;
}

var l = findNode(ast.program, 'FunctionDeclaration', 'l', 10);
if (!l) { console.error('l() not found'); process.exit(1); }
console.log('Found l()');

var forLoop = l.body.body[0].block.body[0]; // TryStatement → body → ForStatement
var forBody = forLoop.body.body; // BlockStatement → body
console.log('For body:', forBody.length, 'items');

// [0] = VariableDeclaration (WSl, jSl, FSl)
// [1] = SwitchStatement (switch WSl)
var wSwitch = forBody[1];
if (!t.isSwitchStatement(wSwitch)) {
    // Search for it
    for (var i = 0; i < forBody.length; i++) {
        if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
    }
}
if (!wSwitch) { console.error('switch(WSl) not found'); process.exit(1); }
console.log('WSl cases:', wSwitch.cases.length);

// ===== Extraction =====
var stateMap = {};
var totalStates = 0;

/** Extract operations from a statement list (before p=N) */
function getOps(stmts) {
    var ops = [];
    if (!stmts) return ops;
    if (!Array.isArray(stmts)) stmts = [stmts];
    stmts.forEach(function(s) {
        if (t.isExpressionStatement(s) && t.isSequenceExpression(s.expression)) {
            s.expression.expressions.forEach(function(e) {
                if (t.isAssignmentExpression(e) && !(t.isIdentifier(e.left) && e.left.name === 'p')) {
                    ops.push({ type: 'assign', left: g(e.left), right: g(e.right).substring(0, 200) });
                }
            });
        }
    });
    return ops;
}

/** Extract next state values (p=N, p=cond?a:b, p=void 0) */
function getNext(stmts) {
    var states = [];
    if (!stmts) return states;
    if (!Array.isArray(stmts)) stmts = [stmts];
    stmts.forEach(function(s) {
        function collect(expr) {
            if (t.isSequenceExpression(expr)) {
                expr.expressions.forEach(function(e) {
                    if (t.isAssignmentExpression(e) && t.isIdentifier(e.left) && e.left.name === 'p') {
                        extractVals(e.right, states);
                    }
                });
            } else if (t.isAssignmentExpression(expr) && t.isIdentifier(expr.left) && expr.left.name === 'p') {
                extractVals(expr.right, states);
            }
        }
        if (t.isExpressionStatement(s)) collect(s.expression);
    });
    return states;
}

function extractVals(node, result) {
    if (t.isNumericLiteral(node)) { result.push(node.value); }
    else if (t.isConditionalExpression(node)) {
        if (t.isNumericLiteral(node.consequent)) result.push(node.consequent.value);
        if (t.isNumericLiteral(node.alternate)) extractVals(node.alternate, result);
        else extractVals(node.alternate, result);
    } else if (t.isUnaryExpression(node) && node.operator === 'void') {
        result.push(null); // null = void 0
    }
}

/** Find the jSl switch inside a WSl case VariableDeclaration */
function findJSwitch(funcBody) {
    if (!funcBody) return null;
    var body = Array.isArray(funcBody) ? funcBody : funcBody.body || [];
    for (var i = 0; i < body.length; i++) {
        var s = body[i];
        if (t.isSwitchStatement(s)) {
            // Check if it switches on jSl
            var disc = g(s.discriminant);
            if (disc.includes('jSl')) return s;
        }
    }
    // Maybe it's nested inside another try/catch or function
    for (var i = 0; i < body.length; i++) {
        var s = body[i];
        if (t.isTryStatement(s)) {
            var nested = findJSwitch(s.block.body);
            if (nested) return nested;
        }
    }
    return null;
}

/** Find if-else chain checking FSl inside a jSl case body */
function findFSlChain(body) {
    if (!body) return null;
    var b = Array.isArray(body) ? body : body.body || [];
    for (var i = 0; i < b.length; i++) {
        var s = b[i];
        if (t.isIfStatement(s)) {
            var test = g(s.test);
            if (test.includes('FSl')) return s;
        }
        // Also check inside VariableDeclaration → FunctionExpression
        if (t.isVariableDeclaration(s)) {
            for (var di = 0; di < s.declarations.length; di++) {
                var decl = s.declarations[di];
                if (decl.init && t.isFunctionExpression(decl.init)) {
                    var fb2 = decl.init.body.body;
                    for (var fi = 0; fi < fb2.length; fi++) {
                        if (t.isIfStatement(fb2[fi]) && g(fb2[fi].test).includes('FSl')) {
                            return fb2[fi];
                        }
                    }
                }
            }
        }
    }
    return null;
}

// Process each WSl case
wSwitch.cases.forEach(function(wCase) {
    if (!wCase.test || !t.isNumericLiteral(wCase.test)) return;
    var wVal = wCase.test.value;

    // Look for VariableDeclaration containing FunctionExpression with jSl switch
    for (var si = 0; si < wCase.consequent.length; si++) {
        var stmt = wCase.consequent[si];
        if (!t.isVariableDeclaration(stmt)) continue;

        for (var di = 0; di < stmt.declarations.length; di++) {
            var decl = stmt.declarations[di];
            if (!decl.init || !t.isFunctionExpression(decl.init)) continue;

            var jSwitch = findJSwitch(decl.init.body);
            if (!jSwitch) {
                // Check if direct FSl chain (no jSl level)
                var directFSl = findFSlChain(decl.init.body.body);
                if (directFSl) {
                    processFSlChain(directFSl, wVal, null);
                }
                continue;
            }

            // Process each jSl case
            jSwitch.cases.forEach(function(jCase) {
                if (!jCase.test || !t.isNumericLiteral(jCase.test)) return;
                var jVal = jCase.test.value;

                // Look for FSl chain inside jCase body
                var fChain = findFSlChain(jCase.consequent);
                if (fChain) {
                    processFSlChain(fChain, wVal, jVal);
                }
            });
        }
    }
});

function processFSlChain(ifStmt, w, j) {
    var current = ifStmt;
    while (current && t.isIfStatement(current)) {
        var test = current.test;
        var fVal = null;

        if (t.isBinaryExpression(test) && (test.operator === '===' || test.operator === '==')) {
            // Try to get the numeric literal
            if (t.isNumericLiteral(test.left)) fVal = test.left.value;
            else if (t.isNumericLiteral(test.right)) fVal = test.right.value;
        }

        if (fVal !== null) {
            var stats = t.isBlockStatement(current.consequent) ? current.consequent.body : [current.consequent];
            var stateKey = (fVal << 10) | ((j !== null ? j : 0) << 5) | w;

            stateMap[stateKey] = {
                w: w,
                j: j !== null ? j : 'N/A',
                f: fVal,
                state: stateKey,
                ops: getOps(stats),
                next: getNext(stats)
            };
            totalStates++;
        }

        current = current.alternate;
    }
}

console.log('Total states extracted: ' + totalStates);

// Sort and save
var sorted = {};
Object.keys(stateMap).map(Number).sort(function(a,b){return a-b;}).forEach(function(k){
    sorted[k] = stateMap[k];
});
fs.writeFileSync(__dirname + '/vmp_state_map.json', JSON.stringify(sorted, null, 2));
console.log('Saved vmp_state_map.json');

// Show browser states
var browserStates = [21867, 3218, 2310, 1219, 2096, 6319, 2273, 20975, 7279, 7299,
    18784, 15635, 6798, 16834, 15984, 22059, 16974, 2164, 10689, 1481, 22017,
    3208, 16420, 20843, 397, 1194, 1709, 2527, 3216, 3432, 3655, 4037,
    8436, 10734, 12144, 15122, 16058, 20492, 20754, 20842, 21058, 21065,
    21649, 21783, 24916, 25624, 26712, 31589];

console.log('\nBrowser 49 states in map:');
var found = 0, missing = [];
browserStates.forEach(function(s) {
    if (sorted[s]) { found++; }
    else { missing.push(s); }
});
console.log('Found: ' + found + '/49');
console.log('Missing: ' + JSON.stringify(missing));

// Show first few states
console.log('\nSample entries:');
Object.keys(sorted).slice(0, 8).forEach(function(k) {
    var s = sorted[k];
    console.log('  state=' + k + ' W=' + s.w + ' j=' + s.j + ' F=' + s.f +
        ' ops=' + JSON.stringify(s.ops).substring(0,100) +
        ' next=' + JSON.stringify(s.next));
});

// Also show the most frequent browser states
console.log('\nHigh-frequency browser states:');
[16974, 2164, 2273, 10689, 15635, 3218].forEach(function(s) {
    var e = sorted[s];
    if (e) console.log('  ['+s+'] ops=' + JSON.stringify(e.ops) + ' next=' + JSON.stringify(e.next));
    else console.log('  ['+s+'] MISSING');
});
