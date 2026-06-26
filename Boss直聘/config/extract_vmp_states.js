/**
 * Extract VMP state operations from the security JS
 *
 * For each state (p value), find:
 * 1. The 3-layer dispatch path: WSl, jSl, FSl
 * 2. The operations performed (assignments, function calls, string constants)
 * 3. The next state(s)
 *
 * Output: A state map that can be used to trace the algorithm.
 */
var parser = require('@babel/parser');
var traverse = require('@babel/traverse').default;
var t = require('@babel/types');
var generate = require('@babel/generator').default;
var fs = require('fs');
var path = require('path');

var code = fs.readFileSync(path.join(__dirname, 'security-7c91433f.js'), 'utf8');

console.log('Parsing security JS (' + code.length + ' bytes)...');
var ast = parser.parse(code);
console.log('Parsed OK');

// Find the VMP interpreter function l()
var lFunc = null;
traverse(ast, {
    FunctionDeclaration: function(p) {
        if (p.node.id && p.node.id.name === 'l' && p.node.params.length > 0) {
            // Verify it's the VMP interpreter (has the for loop)
            var bodyStr = generate(p.node).code;
            if (bodyStr.indexOf('p!==void 0') > 0 || bodyStr.indexOf('p !== void 0') > 0) {
                lFunc = p;
                p.stop();
                console.log('Found VMP function l()');
            }
        }
    }
});

if (!lFunc) {
    console.error('VMP function l() not found!');
    process.exit(1);
}

// The VMP function structure:
// for (var p = arguments[0], ...; p !== void 0; ) {
//   var WSl = 31 & p, jSl = 31 & (p >> 5), FSl = 31 & (p >> 10);
//   switch (WSl) { ... }
// }

// Extract all states and their operations
var stateMap = {};

function getStateKey(p) { return String(p); }

// Visit the for loop body
var forBody = null;
lFunc.traverse({
    ForStatement: function(fp) {
        forBody = fp.get('body');
        fp.stop();
    }
});

if (!forBody) {
    console.error('For loop not found in l()');
    process.exit(1);
}

console.log('Extracting state operations...');

// Helper: extract operations from a state body
function extractOps(bodyPath) {
    var ops = [];
    bodyPath.traverse({
        // Assignment expressions: X = Y
        AssignmentExpression: function(ap) {
            if (t.isIdentifier(ap.node.left) || t.isMemberExpression(ap.node.left)) {
                var left = generate(ap.node.left).code;
                var right = generate(ap.node.right).code;
                // Filter out p = nextState (state transitions are handled separately)
                if (left !== 'p') {
                    ops.push({ type: 'assign', left: left, right: right.substring(0, 200) });
                }
            }
        },
        // Call expressions
        CallExpression: function(cp) {
            var callee = generate(cp.node.callee).code;
            ops.push({ type: 'call', callee: callee.substring(0, 100) });
        }
    });
    return ops;
}

// Extract next states from p assignments
function extractNextStates(bodyPath) {
    var states = [];
    bodyPath.traverse({
        AssignmentExpression: function(ap) {
            if (t.isIdentifier(ap.node.left, { name: 'p' })) {
                if (t.isNumericLiteral(ap.node.right)) {
                    states.push(ap.node.right.value);
                } else if (t.isConditionalExpression(ap.node.right)) {
                    // p = cond ? a : b
                    var c = ap.node.right;
                    if (t.isNumericLiteral(c.consequent)) states.push(c.consequent.value);
                    if (t.isNumericLiteral(c.alternate)) {
                        if (t.isConditionalExpression(c.alternate)) {
                            // Nested ternary: p = a ? b : c ? d : e
                            if (t.isNumericLiteral(c.alternate.consequent)) states.push(c.alternate.consequent.value);
                            if (t.isNumericLiteral(c.alternate.alternate)) states.push(c.alternate.alternate.value);
                        } else {
                            states.push(c.alternate.value);
                        }
                    }
                }
            }
        }
    });
    return states;
}

// Walk through all WSl → jSl → FSl paths
var totalStates = 0;
var body = forBody.node;
var varDecls = body.body[0]; // var WSl = 31 & p, jSl = ..., FSl = ...
var switchStmt = body.body[1]; // switch (WSl) { ... }

var wCases = switchStmt.cases;
for (var wi = 0; wi < wCases.length; wi++) {
    var wCase = wCases[wi];
    if (!wCase.test) continue; // skip default case
    var wVal = wCase.test.value;

    // Inside WSl case: function zSl() { switch(jSl) { ... } }
    var wBody = wCase.consequent;
    // Find the switch(jSl) statement
    for (var bi = 0; bi < wBody.length; bi++) {
        var stmt = wBody[bi];
        if (t.isVariableDeclaration(stmt)) {
            // var zSl = function() { switch(jSl) { ... } }
            var decl = stmt.declarations[0];
            if (decl && decl.init && t.isFunctionExpression(decl.init)) {
                // Find switch in function body
                var funcBody = decl.init.body.body;
                for (var fi = 0; fi < funcBody.length; fi++) {
                    if (t.isSwitchStatement(funcBody[fi])) {
                        var jSwitch = funcBody[fi];
                        var jCases = jSwitch.cases;

                        for (var ji = 0; ji < jCases.length; ji++) {
                            var jCase = jCases[ji];
                            if (!jCase.test) continue;
                            var jVal = jCase.test.value;

                            // Inside jSl case: var a = function() { if(0===FSl) ... else if(1===FSl) ... }
                            for (var ci = 0; ci < jCase.consequent.length; ci++) {
                                var jStmt = jCase.consequent[ci];
                                if (t.isVariableDeclaration(jStmt)) {
                                    var jDecl = jStmt.declarations[0];
                                    if (jDecl && jDecl.init && t.isFunctionExpression(jDecl.init)) {
                                        var innerBody = jDecl.init.body.body;
                                        for (var ii = 0; ii < innerBody.length; ii++) {
                                            if (t.isIfStatement(innerBody[ii])) {
                                                // if(0===FSl) { ... p = N } else if(1===FSl) { ... }
                                                processIfChain(innerBody[ii], wVal, jVal);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (t.isSwitchStatement(stmt)) {
            // Direct switch(jSl) (without wrapping function)
            var jCases2 = stmt.cases;
            // Similar processing...
        }
    }
}

function processIfChain(ifStmt, w, j) {
    var current = ifStmt;
    while (current) {
        if (t.isIfStatement(current)) {
            var test = current.test;
            var fVal = null;
            if (t.isBinaryExpression(test) && test.operator === '===') {
                if (t.isNumericLiteral(test.right)) fVal = test.right.value;
                else if (t.isNumericLiteral(test.left)) fVal = test.left.value;
            }

            if (fVal !== null) {
                var state = (fVal << 10) | (j << 5) | w;
                var ops = extractOpsFromConsequent(current.consequent);
                var nextStates = extractNextFromConsequent(current.consequent);
                stateMap[state] = {
                    w: w, j: j, f: fVal,
                    ops: ops,
                    next: nextStates
                };
                totalStates++;
            }
            current = current.alternate;
        } else {
            break;
        }
    }
}

function extractOpsFromConsequent(body) {
    if (t.isBlockStatement(body)) {
        body = body.body;
    } else {
        body = [body];
    }
    var ops = [];
    for (var i = 0; i < body.length; i++) {
        var s = body[i];
        if (t.isExpressionStatement(s)) {
            var expr = s.expression;
            if (t.isAssignmentExpression(expr)) {
                var left = generate(expr.left).code;
                var right = generate(expr.right).code.substring(0, 150);
                if (left !== 'p') {
                    ops.push({ type: 'assign', left: left, right: right });
                }
            } else if (t.isSequenceExpression(expr)) {
                // (X = Y, p = N) — comma expression
                for (var j = 0; j < expr.expressions.length; j++) {
                    var e = expr.expressions[j];
                    if (t.isAssignmentExpression(e) && !t.isIdentifier(e.left, { name: 'p' })) {
                        ops.push({ type: 'assign', left: generate(e.left).code, right: generate(e.right).code.substring(0, 150) });
                    }
                }
            }
        }
    }
    return ops;
}

function extractNextFromConsequent(body) {
    if (t.isBlockStatement(body)) body = body.body;
    else body = [body];
    var states = [];
    for (var i = 0; i < body.length; i++) {
        var s = body[i];
        if (t.isExpressionStatement(s)) {
            var expr = s.expression;
            if (t.isAssignmentExpression(expr) && t.isIdentifier(expr.left, { name: 'p' })) {
                collectPValues(expr.right, states);
            } else if (t.isSequenceExpression(expr)) {
                for (var j = 0; j < expr.expressions.length; j++) {
                    var e = expr.expressions[j];
                    if (t.isAssignmentExpression(e) && t.isIdentifier(e.left, { name: 'p' })) {
                        collectPValues(e.right, states);
                    }
                }
            }
        }
    }
    return states;
}

function collectPValues(node, result) {
    if (t.isNumericLiteral(node)) {
        result.push(node.value);
    } else if (t.isConditionalExpression(node)) {
        if (t.isNumericLiteral(node.consequent)) result.push(node.consequent.value);
        if (t.isNumericLiteral(node.alternate)) {
            collectPValues(node.alternate, result);
        }
    }
}

console.log('Total states extracted: ' + totalStates);
console.log('Sample states:');
var keys = Object.keys(stateMap).slice(0, 10);
keys.forEach(function(k) {
    var s = stateMap[k];
    console.log('  p=' + k + ' (W=' + s.w + ' j=' + s.j + ' F=' + s.f + ') ops=' + JSON.stringify(s.ops).substring(0, 200));
});

// Save state map
var stateMapJSON = {};
Object.keys(stateMap).sort(function(a,b) { return parseInt(a)-parseInt(b); }).forEach(function(k) {
    stateMapJSON[k] = {
        w: stateMap[k].w, j: stateMap[k].j, f: stateMap[k].f,
        ops: stateMap[k].ops,
        next: stateMap[k].next
    };
});
fs.writeFileSync(path.join(__dirname, 'vmp_state_map.json'), JSON.stringify(stateMapJSON, null, 2));
console.log('Saved ' + Object.keys(stateMap).length + ' states to vmp_state_map.json');
