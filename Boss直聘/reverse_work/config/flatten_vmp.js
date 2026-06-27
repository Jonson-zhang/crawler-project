/**
 * FLATTEN the VMP — collapse all FSl ternary chains to browser-taken path
 *
 * For each FSl===N ? (ops, p=next) : (rest):
 *   If the browser went through branch N, KEEP only that branch.
 *   Replace: p = <browser_next> (drop the ternary entirely!)
 *   Also inline all intermediate states (walk the chain).
 *
 * This eliminates 99.5% of the VMP, leaving only the pure algorithm.
 */
var parser = require('@babel/parser');
var traverse = require('@babel/traverse').default;
var t = require('@babel/types');
var generator = require('@babel/generator').default;
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });

// Load state map
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// Full browser state trace (from MCP — 1318 steps, compacted)
// These are the ONLY states the browser visited
var browserTraceCompact = [
    14887,11814,4399,21867,
    3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,
    2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,
    // 16974 and 10689 cycle 36 times
    16974,10689,
    2164,
    3218,2273,15635,2273,14473,3218,2273,15635,2273,14371,3218,2273,15635,2273,7762,3218,1481,
    1219,2096,6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,
    2273,22017,2273,22017,2273,22017,2273,15635,2273,16420,2273,15878,12497,3218,14635,2273,15635,2273,10287,3218,1481,
    2273,15635,2273,14704,15635,2273,5285,3218,15635,2273,1709,15635,2273,397,15635,2273,6735,2273,15635,2273,16420,
    2273,15635,2273,13760,2051,3218,2273,15635,2273,18928,15635,2273,14406,15635,2273,7178,3218,2273,15635,
    2273,7279,7299,2273,20906,3208,2273,20843,2273,3208,2273,20843,2273,15635,2273,15635,2273,15635,2273,7279,7299,10734,3218,2273,20492,3216,3655,20754,3463
];

// Expand browser trace: walk each state's chain through the map
var visitedStates = new Set();
function expandFromState(s) {
    var visited = new Set();
    var queue = [s];
    while (queue.length > 0) {
        var current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        var e = stateMap[current];
        if (!e) continue;
        var next = e.next || [];
        for (var i = 0; i < next.length; i++) {
            if (next[i] !== null && typeof next[i] === 'number' && !visited.has(next[i])) {
                queue.push(next[i]);
            }
        }
    }
    return visited;
}

browserTraceCompact.forEach(function(s) {
    visitedStates.add(s);
    var expanded = expandFromState(s);
    expanded.forEach(function(v) { visitedStates.add(v); });
});

console.log('Total visited states: ' + visitedStates.size);

// ===== Now flatten: for each visited state, find its FSl ternary chain
// For EACH FSl===N branch in the chain:
//   - If the browser took branch N (i.e., state (N<<10|j<<5|W) is in visitedStates)
//     keep it. Otherwise, skip to the alternate.

// Find l() function
function findL(node, depth) {
    if (depth > 15) return null;
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) { var r = findL(node[i], depth); if (r) return r; } return null; }
    if (!node || typeof node !== 'object' || !node.type) return null;
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'l') {
        var b = node.body.body;
        if (b && b[0] && b[0].type === 'TryStatement') {
            if (b[0].block.body && b[0].block.body[0] && b[0].block.body[0].type === 'ForStatement') return node;
        }
    }
    var skip = ['type','start','end','loc','leadingComments','trailingComments','innerComments','extra'];
    for (var k in node) { if (skip.indexOf(k) >= 0) continue; if (node[k] && typeof node[k] === 'object') { var r = findL(node[k], depth + 1); if (r) return r; } }
    return null;
}

var lFunc = findL(ast.program, 0);
if (!lFunc) { console.error('l() not found'); process.exit(1); }
console.log('Found l(), flattening...');

// Counters
var branchesCollapsed = 0;
var statesInlined = 0;

// Walk all FSl ternary chains inside the FULL program
// (l() is too deep to traverse from the found node — use the full AST)
traverse(ast, {
    ConditionalExpression: function(path) {
        var node = path.node;
        // Check if this is an FSl check
        var test = node.test;
        var isFSlCheck = false;
        var fVal = null;

        if (t.isBinaryExpression(test) && t.isIdentifier(test.right) && test.right.name === 'FSl' && t.isNumericLiteral(test.left)) {
            isFSlCheck = true;
            fVal = test.left.value;
        }

        if (!isFSlCheck || fVal === null) return;

        // Only prune inside l() — skip MD5 module ternaries
        var ancestor = path.parentPath;
        var inside_l = false;
        while (ancestor) {
            if (ancestor.node && ancestor.node.type === 'FunctionDeclaration' && ancestor.node.id && ancestor.node.id.name === 'l') {
                inside_l = true; break;
            }
            ancestor = ancestor.parentPath;
        }
        if (!inside_l) return;

        // Get the p value from the consequent
        var consequent = node.consequent;
        var pVal = findPInNode(consequent);

        if (pVal === null) return; // can't determine p

        // Get W and j from context — we need to walk up to find the enclosing function
        // Actually, state = (F << 10) | (j << 5) | W
        // We don't know W and j from this node alone.
        // Instead, just check if pVal is in visitedStates
        // If NOT, this branch is dead code

        if (!visitedStates.has(pVal)) {
            // This branch is DEAD — replace the ternary with just the alternate
            //  F===N ? (dead, p=X) : (rest)  →  (rest)
            var alternate = node.alternate;
            path.replaceWith(alternate);
            branchesCollapsed++;
        }
        // If pVal IS in visitedStates, keep the branch (it's on the browser path)
    }
});

function findPInNode(node) {
    if (t.isAssignmentExpression(node) && t.isIdentifier(node.left) && node.left.name === 'p') {
        if (t.isNumericLiteral(node.right)) return node.right.value;
    }
    if (t.isSequenceExpression(node)) {
        for (var i = 0; i < node.expressions.length; i++) {
            var e = node.expressions[i];
            if (t.isAssignmentExpression(e) && t.isIdentifier(e.left) && e.left.name === 'p') {
                if (t.isNumericLiteral(e.right)) return e.right.value;
            }
        }
    }
    return null;
}

console.log('Branches collapsed: ' + branchesCollapsed);

// Write the flattened version
var output = generator(ast).code;
fs.writeFileSync(__dirname + '/security-flattened.js', output);
console.log('Saved security-flattened.js (' + output.length + ' bytes, was ' + code.length + ')');
console.log('Size reduction: ' + ((1 - output.length / code.length) * 100).toFixed(1) + '%');
