/**
 * Phase 1: Extract VMP State Map from security-live.js
 *
 * Maps each (W, j, F) → { ops: [...], next: [...] }
 * The state value p encodes: W=(p&31), j=((p>>5)&31), F=((p>>10)&31)
 *
 * Output: vmp_state_map.json
 */
var parser = require('@babel/parser');
var traverse = require('@babel/traverse').default;
var t = require('@babel/types');
var generate = require('@babel/generator').default;
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-live.js', 'utf8');
console.log('Parsing security-live.js (' + code.length + ' bytes, ' + code.split('\n').length + ' lines)...');

var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parse OK');

// Step 1: Find the VMP function l()
var lFunc = null;
traverse(ast, {
    FunctionDeclaration: function(path) {
        if (path.node.id && path.node.id.name === 'l' && path.node.params.length > 0) {
            var src = generate(path.node).code;
            if (src.includes('p !== void 0') || src.includes('p!==void 0')) {
                lFunc = path;
                path.stop();
            }
        }
    }
});

if (!lFunc) {
    console.error('VMP function l() not found!');
    process.exit(1);
}
console.log('Found function l() (line ~' + (lFunc.node.loc ? lFunc.node.loc.start.line : '?') + ')');

// Step 2: Find the main for loop body inside l()
var forBody = null;
lFunc.traverse({
    ForStatement: function(path) {
        var src = generate(path.node.test).code;
        if (src.includes('void 0') && path.node.body && t.isBlockStatement(path.node.body)) {
            forBody = path.node.body.body;
            path.stop();
        }
    }
});

if (!forBody) {
    console.error('Main for loop not found');
    process.exit(1);
}
console.log('Found for loop body (' + forBody.length + ' statements)');

// The for body structure:
// [0] var WSl = 31 & p, jSl = 31 & (p >> 5), FSl = 31 & (p >> 10);
// [1] switch (WSl) { ... }
// [2] apply/return statement

// Step 3: Find the switch(WSl) statement
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) {
        wSwitch = forBody[i];
        break;
    }
}

if (!wSwitch) {
    console.error('switch(WSl) not found');
    process.exit(1);
}
console.log('Found switch(WSl) with ' + wSwitch.cases.length + ' cases');

// Step 4: Extract all (W,j,F) → {ops, next} mappings
var stateMap = {};
var totalStates = 0;

// Helper: generate code string from AST node (cleaned up)
function gen(node) {
    return generate(node).code.trim();
}

// Helper: extract p=N values from a statement
function extractNextStates(stmts) {
    var states = [];
    if (!Array.isArray(stmts)) stmts = [stmts];
    for (var i = 0; i < stmts.length; i++) {
        var s = stmts[i];
        if (t.isExpressionStatement(s)) {
            extractPFromExpr(s.expression, states);
        }
    }
    return states;
}

function extractPFromExpr(expr, result) {
    if (t.isAssignmentExpression(expr) && t.isIdentifier(expr.left, { name: 'p' })) {
        collectValues(expr.right, result);
    } else if (t.isSequenceExpression(expr)) {
        expr.expressions.forEach(function(e) {
            if (t.isAssignmentExpression(e) && t.isIdentifier(e.left, { name: 'p' })) {
                collectValues(e.right, result);
            }
        });
    }
}

function collectValues(node, result) {
    if (t.isNumericLiteral(node)) {
        result.push(node.value);
    } else if (t.isConditionalExpression(node)) {
        if (t.isNumericLiteral(node.consequent)) result.push(node.consequent.value);
        if (t.isNumericLiteral(node.alternate)) collectValues(node.alternate, result);
    } else if (t.isUnaryExpression(node) && node.operator === 'void') {
        result.push(null); // null represents void 0
    }
}

// Helper: extract operations from the statement body (before p=N)
function extractOps(stmts) {
    var ops = [];
    if (!Array.isArray(stmts)) stmts = [stmts];
    for (var i = 0; i < stmts.length; i++) {
        var s = stmts[i];
        if (t.isExpressionStatement(s)) {
            extractOpsFromExpr(s.expression, ops);
        }
    }
    return ops;
}

function extractOpsFromExpr(expr, ops) {
    if (t.isSequenceExpression(expr)) {
        // (op1, op2, ..., p=N)
        expr.expressions.forEach(function(e) {
            if (t.isAssignmentExpression(e)) {
                if (!t.isIdentifier(e.left, { name: 'p' })) {
                    ops.push({ type: 'assign', left: gen(e.left), right: simplifyRight(e.right) });
                }
            } else if (t.isCallExpression(e)) {
                ops.push({ type: 'call', expr: simplifyExpr(e) });
            } else if (t.isUnaryExpression(e)) {
                ops.push({ type: 'unary', expr: gen(e) });
            }
        });
    } else if (t.isAssignmentExpression(expr) && !t.isIdentifier(expr.left, { name: 'p' })) {
        ops.push({ type: 'assign', left: gen(expr.left), right: simplifyRight(expr.right) });
    } else if (t.isCallExpression(expr)) {
        ops.push({ type: 'call', expr: simplifyExpr(expr) });
    }
}

function simplifyRight(node) {
    if (t.isBinaryExpression(node)) {
        return gen(node.left) + ' ' + node.operator + ' ' + gen(node.right);
    }
    if (t.isCallExpression(node)) {
        return simplifyExpr(node);
    }
    if (t.isStringLiteral(node)) {
        return JSON.stringify(node.value);
    }
    if (t.isNumericLiteral(node)) {
        return String(node.value);
    }
    if (t.isBooleanLiteral(node)) {
        return String(node.value);
    }
    return gen(node);
}

function simplifyExpr(node) {
    if (t.isCallExpression(node)) {
        var calleeStr = gen(node.callee);
        if (calleeStr.length > 80) calleeStr = calleeStr.substring(0, 80) + '...';
        return calleeStr + '(...)';
    }
    return gen(node).substring(0, 120);
}

// Walk all WSl cases
wSwitch.cases.forEach(function(wCase) {
    if (!wCase.test || !t.isNumericLiteral(wCase.test)) return; // skip default
    var wVal = wCase.test.value;

    // For each statement in the WSl case body, look for:
    // var zSl = function() { switch(jSl) { ... } };
    // var zSl = function() { ... };  (direct FSl check)
    for (var si = 0; si < wCase.consequent.length; si++) {
        var stmt = wCase.consequent[si];

        if (t.isVariableDeclaration(stmt)) {
            for (var di = 0; di < stmt.declarations.length; di++) {
                var decl = stmt.declarations[di];
                if (!decl.init || !t.isFunctionExpression(decl.init)) continue;

                var funcBody = decl.init.body.body;

                // Look for switch(jSl) or direct if(0===FSl)...else if...
                for (var fi = 0; fi < funcBody.length; fi++) {
                    var fStmt = funcBody[fi];

                    if (t.isSwitchStatement(fStmt)) {
                        // Nested: switch(jSl) → case j:
                        fStmt.cases.forEach(function(jCase) {
                            if (!jCase.test || !t.isNumericLiteral(jCase.test)) return;
                            var jVal = jCase.test.value;

                            // Inside jSl case: var a = function() { if(0===FSl)...else if... }
                            processCaseBody(jCase.consequent, wVal, jVal);
                        });
                    } else if (t.isIfStatement(fStmt)) {
                        // Direct FSl check (single-level nesting)
                        processIfChain(fStmt, wVal, null);
                    }
                }
            }
        } else if (t.isIfStatement(stmt)) {
            // Direct if inside WSl case
            processIfChain(stmt, wVal, null);
        }
    }
});

function processCaseBody(body, w, j) {
    for (var i = 0; i < body.length; i++) {
        var stmt = body[i];
        if (t.isIfStatement(stmt)) {
            processIfChain(stmt, w, j);
        } else if (t.isVariableDeclaration(stmt)) {
            for (var di = 0; di < stmt.declarations.length; di++) {
                var decl = stmt.declarations[di];
                if (!decl.init || !t.isFunctionExpression(decl.init)) continue;
                var innerBody = decl.init.body.body;
                // Look for if-else chain
                for (var fi = 0; fi < innerBody.length; fi++) {
                    if (t.isIfStatement(innerBody[fi])) {
                        processIfChain(innerBody[fi], w, j);
                    }
                }
            }
        }
    }
}

function processIfChain(ifStmt, w, j) {
    var current = ifStmt;
    while (current && t.isIfStatement(current)) {
        // Extract FSl value from test: FSl === N or N === FSl
        var test = current.test;
        var fVal = null;
        if (t.isBinaryExpression(test) && (test.operator === '===' || test.operator === '==')) {
            if (t.isNumericLiteral(test.left)) fVal = test.left.value;
            else if (t.isNumericLiteral(test.right)) fVal = test.right.value;
        }

        if (fVal !== null) {
            var consequent = current.consequent;
            var stmts = t.isBlockStatement(consequent) ? consequent.body : [consequent];

            var stateKey = (fVal !== null && j !== null) ?
                (fVal << 10) | (j << 5) | w :
                (fVal !== null ? (fVal << 5) | w : undefined);

            if (stateKey !== undefined) {
                stateMap[stateKey] = {
                    w: w,
                    j: j !== null ? j : 'N/A',
                    f: fVal,
                    state: stateKey,
                    ops: extractOps(stmts),
                    next: extractNextStates(stmts)
                };
                totalStates++;
            }
        }

        current = current.alternate;
    }
}

console.log('Extracted ' + totalStates + ' states');

// Write the state map, sorted by state value
var sorted = {};
Object.keys(stateMap).map(Number).sort(function(a, b) { return a - b; }).forEach(function(k) {
    sorted[k] = stateMap[k];
});
fs.writeFileSync(__dirname + '/vmp_state_map.json', JSON.stringify(sorted, null, 2));
console.log('Saved vmp_state_map.json');

// Print sample entries
console.log('\nSample entries (first 10):');
Object.keys(sorted).slice(0, 10).forEach(function(k) {
    var s = sorted[k];
    console.log('  state=' + k + ' (W=' + s.w + ' j=' + s.j + ' F=' + s.f + ')');
    console.log('    ops: ' + JSON.stringify(s.ops));
    console.log('    next: ' + JSON.stringify(s.next));
});

// Print the browser trace states we know about
console.log('\nBrowser trace states decoded:');
var browserStates = [21867, 3218, 2310, 1219, 2096, 6319, 2273, 20975, 7279, 7299, 18784, 15635,
    6798, 16834, 15984, 22059, 16974, 2164, 10689, 1481, 22017];
browserStates.forEach(function(s) {
    var entry = sorted[s];
    if (entry) {
        console.log('  [' + s + '] W=' + entry.w + ' j=' + entry.j + ' F=' + entry.f +
            ' ops=' + entry.ops.length + ' next=' + JSON.stringify(entry.next));
    } else {
        console.log('  [' + s + '] NOT FOUND in map');
    }
});
