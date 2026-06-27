/**
 * Pure Algorithm Extractor
 *
 * Walks VMP state transitions using browser trace as guide,
 * extracts all operations, resolves conditions, builds
 * a linear algorithm that can be translated to Python.
 *
 * Output: pure_algorithm.json → Python implementation
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// Browser trace (52 unique states from MCP capture)
// Flattened: "1481x462" expands to 462 copies of 1481, etc.
var browserTrace = [
    14887,11814,4399,21867,3218,2310,3218,1219,2096,6319,3218,
    2273,20975,1219,2096,6319,3218,2273,20975,2273,7279,7299,
    2273,18784,15635,2273,6798,3218,16834,15984,22059,3218,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    // 1481 repeated 462 times
    1481,1481,1481,1481,1481,
    // 16974 repeated 696 times
    16974,16974,16974,16974,16974,
    // 2164 repeated 392 times
    2164,2164,2164,2164,2164,
    3208,2273,20843,2273,15635,2273,15635,2273,15635,2273,7279,
    7299,10734,3218,2273,20492,3216,3655,20754,3463
];

// Deduplicate: unique browser states (for analysis)
var uniqueStates = [];
browserTrace.forEach(function(s) {
    if (uniqueStates.indexOf(s) < 0) uniqueStates.push(s);
});
console.log('Unique browser states: ' + uniqueStates.length);

// ===== Step 1: Walk a state chain and collect ALL operations =====
function walkState(startState, maxSteps) {
    var s = startState;
    var steps = [];
    for (var i = 0; i < maxSteps; i++) {
        var e = stateMap[s];
        if (!e) { /*console.log('  [!] State ' + s + ' not found');*/ break; }

        if (e.ops && e.ops.length > 0) {
            steps.push({state: s, ops: e.ops});
        }

        var next = e.next || [];
        if (next.length === 0) break;
        if (next.length === 1 && next[0] === null) break;
        if (next.length === 1 && next[0] === s) break; // self-loop

        // For conditional states, take first numeric branch
        var chosen = null;
        for (var j = 0; j < next.length; j++) {
            if (typeof next[j] === 'number') { chosen = next[j]; break; }
        }
        if (chosen === null) break;

        s = chosen;
    }
    return steps;
}

// ===== Step 2: Extract ALL paths from ALL browser states =====
console.log('Extracting operation chains for all browser states...\n');

var allOps = {};
var visited = {};
var stateChains = {};

browserTrace.forEach(function(s) {
    if (visited[s]) return;
    visited[s] = true;

    var chain = walkState(s, 30);
    if (chain.length > 0) {
        stateChains[s] = chain;
        if (!allOps[s]) allOps[s] = chain;
        // Also save child states
        chain.forEach(function(step) {
            if (!visited[step.state]) visited[step.state] = true;
        });
    }
});

// ===== Step 3: Show the algorithm =====
console.log('=== Operation Chains per Browser State ===\n');

Object.keys(stateChains).sort(function(a,b) { return parseInt(a) - parseInt(b); }).forEach(function(s) {
    var chain = stateChains[s];
    console.log('State ' + s + ' (' + chain.length + ' ops):');
    chain.forEach(function(step) {
        step.ops.forEach(function(op) {
            console.log('  ' + op.left + ' = ' + op.right);
        });
    });
    console.log();
});

// ===== Step 4: Identify the main paths =====
console.log('=== Key Paths ===\n');

// Path from entry 21867
console.log('Entry path (21867):');
walkState(21867, 50).forEach(function(step) {
    step.ops.forEach(function(op) { console.log('  ' + op.left + ' = ' + op.right); });
});

console.log('\nMain loop (16974→164→...):');
walkState(16974, 100).forEach(function(step) {
    step.ops.forEach(function(op) { console.log('  ' + op.left + ' = ' + op.right); });
});

// ===== Step 5: Build Python template =====
console.log('\n=== Building Python Algorithm ===\n');

var pythonLines = [];
pythonLines.push('def generate_token(seed, ts):');
pythonLines.push('    """');
pythonLines.push('    Boss直聘 __zp_stoken__ 纯算法 (VMP状态机还原)');
pythonLines.push('    """');
pythonLines.push('    # ===== Initialize =====');
pythonLines.push('    vars = {}');
pythonLines.push('    ');
pythonLines.push('    # Seed and timestamp');
pythonLines.push('    vars["arguments"] = [seed, ts]');
pythonLines.push('    ');

// Map VMP variable names to Python-safe names
function pyName(name) {
    if (name === 'arguments[1]') return 'ts';
    if (name === 'arguments[2]') return 'seed';
    if (name === 'arguments[0]') return 'entry_state';
    // Single uppercase letters → var_<letter>
    return 'v_' + name;
}

function pyValue(right) {
    if (right.match(/^"[\s\S]*"$/)) return right;
    if (right.match(/^\d+$/)) return right;
    if (right === 'void 0') return 'None';
    if (right === 'window') return "'window'";
    if (right === 'Math') return "'Math'";
    if (right === 'true') return 'True';
    if (right === 'false') return 'False';
    if (right === 'arguments[1]') return 'ts';
    if (right === 'arguments[2]') return 'seed';
    // Binary operations: A + B
    var m = right.match(/^(\w+)\s*\+\s*(\w+)$/);
    if (m) return pyName(m[1]) + ' + ' + pyName(m[2]);
    if (right.indexOf('.call(') >= 0) return "'[call]'";
    if (right.indexOf('arguments') === 0) return "'args'";
    return "'" + right + "'";
}

// Process the 16974 → 10689 loop
var loopStates = [16974, 10689];
pythonLines.push('    # ===== Main Loop: 16974 ↔ 10689 (696+36 iterations) =====');
pythonLines.push('    for _ in range(36):  # 36 repetitions of [10689]');
pythonLines.push('        # 16974 path: build Selection checker');
walkState(16974, 50).forEach(function(step) {
    step.ops.forEach(function(op) {
        pythonLines.push('        ' + pyName(op.left) + ' = ' + pyValue(op.right));
    });
});
pythonLines.push('        ');
pythonLines.push('        # 10689 path: extract charCodeAt from Selection');
walkState(10689, 50).forEach(function(step) {
    step.ops.forEach(function(op) {
        pythonLines.push('        ' + pyName(op.left) + ' = ' + pyValue(op.right));
    });
});

pythonLines.push('    ');
pythonLines.push('    # ===== 2164 path: toLowerCase (392x) =====');
pythonLines.push('    for _ in range(392):');
walkState(2164, 30).forEach(function(step) {
    step.ops.forEach(function(op) {
        pythonLines.push('        ' + pyName(op.left) + ' = ' + pyValue(op.right));
    });
});

pythonLines.push('    ');
pythonLines.push('    # ===== 2273 path: Math/number ops (82x) =====');
pythonLines.push('    for _ in range(82):');
walkState(2273, 30).forEach(function(step) {
    step.ops.forEach(function(op) {
        pythonLines.push('        ' + pyName(op.left) + ' = ' + pyValue(op.right));
    });
});

pythonLines.push('    ');
pythonLines.push('    return "token_placeholder"');
pythonLines.push('');

var pyCode = pythonLines.join('\n');
fs.writeFileSync(__dirname + '/pure_algorithm.py', pyCode);
console.log('Saved pure_algorithm.py (' + pythonLines.length + ' lines)');

// ===== Step 6: Summary =====
console.log('\n=== Summary ===');
console.log('Browser states analyzed: ' + Object.keys(stateChains).length);
console.log('Total unique state chains: ' + Object.keys(allOps).length);

// Count unique operations
var uniqueOps = {};
Object.values(stateChains).forEach(function(chain) {
    chain.forEach(function(step) {
        step.ops.forEach(function(op) {
            var key = op.left + ' = ' + op.right;
            uniqueOps[key] = (uniqueOps[key] || 0) + 1;
        });
    });
});
console.log('Unique operations: ' + Object.keys(uniqueOps).length);
console.log('\nTop 30 operations by frequency:');
Object.entries(uniqueOps).sort(function(a,b) { return b[1] - a[1]; }).slice(0,30).forEach(function(e) {
    console.log('  x' + e[1] + ': ' + e[0]);
});
