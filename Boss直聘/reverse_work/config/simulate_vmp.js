/**
 * Phase 2: VMP Simulator
 *
 * Uses the state map + browser trace to produce a linear sequence of operations.
 * The browser trace gives the exact state sequence; the map table gives what each
 * state does. By walking through both, we extract the pure algorithm.
 *
 * Usage: node simulate_vmp.js
 */
var fs = require('fs');

var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));
console.log('Loaded ' + Object.keys(stateMap).length + ' states');

// Browser state trace (first 50 + all unique states from earlier MCP run)
// Full browser trace collected from the MCP browser session
// But since we don't have the full trace stored, let's use the map to trace from entry

// Entry state from browser trace
var entryState = 21867;

// Simulate: walk from entry state using single-path next states
// For conditional states, use the first next value (naive simulation)
// Then compare with browser output

function simulate(startState, seed, tsStr) {
    var currentState = startState;
    var steps = 0;
    var operations = [];
    var visited = {};
    var path = [];

    while (currentState !== null && currentState !== undefined && steps < 2000) {
        var entry = stateMap[currentState];
        if (!entry) {
            console.error('State ' + currentState + ' not found in map at step ' + steps);
            break;
        }

        path.push(currentState);

        // Record operations
        if (entry.ops && entry.ops.length > 0) {
            operations.push({ step: steps, state: currentState, ops: entry.ops });
        }

        // Determine next state
        var nextList = entry.next || [];
        if (nextList.length === 0) {
            console.log('Terminal state ' + currentState + ' at step ' + steps);
            break;
        }

        if (nextList.length === 1) {
            currentState = nextList[0];
        } else {
            // Conditional branch — use first non-null value
            var chosen = null;
            for (var i = 0; i < nextList.length; i++) {
                if (nextList[i] !== null && typeof nextList[i] === 'number') {
                    chosen = nextList[i];
                    break;
                }
            }
            if (chosen === null) {
                console.log('All next states are null at step ' + steps + ', state=' + currentState);
                break;
            }
            currentState = chosen;
        }

        steps++;

        // Cycle detection
        var key = currentState + '';
        if (visited[key] > 5) {
            console.log('Cycle detected at state ' + currentState + ' (visited ' + visited[key] + ' times)');
            break;
        }
        visited[key] = (visited[key] || 0) + 1;
    }

    return { steps: steps, operations: operations, path: path };
}

console.log('\n=== Simulation from entry state ' + entryState + ' ===');
var result = simulate(entryState);

console.log('Total steps: ' + result.steps);
console.log('Operations collected: ' + result.operations.length);
console.log('Path length: ' + result.path.length);

// Show operations
console.log('\nOperation sequence (first 30):');
result.operations.slice(0, 30).forEach(function(op) {
    console.log('  Step ' + op.step + ' (state=' + op.state + '):');
    op.ops.forEach(function(o) {
        console.log('    ' + o.left + ' = ' + o.right);
    });
});

// Count operation types
var opTypes = {};
result.operations.forEach(function(op) {
    op.ops.forEach(function(o) {
        var key = o.left + ' = ' + o.right.substring(0, 50);
        opTypes[key] = (opTypes[key] || 0) + 1;
    });
});

console.log('\nUnique operations: ' + Object.keys(opTypes).length);
console.log('Top 20:');
Object.entries(opTypes).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 20).forEach(function(e) {
    console.log('  x' + e[1] + ': ' + e[0]);
});
