/**
 * VMP Final Executor — Browser trace-driven execution
 *
 * For each browser-trace p:
 *   CER = (p&31, p>>5&31, p>>10&31) → stateMap[CER] → {code}
 *   Extract business ops (skip "p = N") → execute → move to next trace p
 *
 * Handles function definitions (def) separately from immediate ops (exec).
 */
var fs = require('fs');

var mapData = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8'));
var stateMap = mapData.map;
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(l => l.startsWith('VMP:'))
    .map(l => parseInt(l.split(':')[1]));

// For each unique p, extract its operation
var pToOps = {};
var pToNext = {};

trace.forEach(function(p, idx) {
    if (pToOps[p]) return;
    var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;
    var entry = stateMap[key];
    if (!entry) { pToOps[p] = ''; pToNext[p] = trace[idx + 1]; return; }

    var code = entry.code;
    // Strip p = N suffix
    var ops = code.replace(/,\s*p\s*=\s*(\d+)\s*$/, '')
                  .replace(/^p\s*=\s*(\d+)\s*,\s*/, '')
                  .replace(/,?\s*p\s*=\s*void\s+0\s*$/, '')
                  .trim();

    // Handle conditional: p = X ? A : B
    var condM = ops.match(/^p\s*=\s*(\w+)\s*\?\s*(\d+)\s*:\s*(\d+)$/);
    if (condM) {
        var nextP = trace[idx + 1];
        ops = '// [' + condM[1] + '] chosen p=' + (nextP || 'end');
    }

    // Handle: return [X];  or  return X;
    if (/^return\s/.test(ops)) {
        ops = '// ' + ops + ' (handled by caller)';
    }

    pToOps[p] = ops;
    pToNext[p] = trace[idx + 1];
});

// ===== Generate JS =====
var lines = [];
lines.push('var generateToken = function(_seed, _ts) {');
lines.push('"use strict";');
lines.push('  // Minimal env stubs — branch choices already hardcoded via browser trace');
lines.push('  var window = {}, navigator = {}, document = {}, screen = {};');
lines.push('');

// Extract ACTUAL VMP variables from the state map operations
var RESERVED = ['do','if','in','of','for','var','let','new','try','int','byte','char','case','void','with','this'];
var allVars = {};
Object.keys(stateMap).forEach(function(k) {
    var code = stateMap[k].code;
    // Match variable assignments: varName =
    var matches = code.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g);
    if (matches) {
        matches.forEach(function(m) {
            var v = m.replace(/\s*=/, '');
            if (RESERVED.indexOf(v) < 0 && v.length <= 3) allVars[v] = true;
        });
    }
    // Also match references on RHS
    var refs = code.match(/[^a-zA-Z0-9_$]([a-zA-Z_$][a-zA-Z_$]{0,2})(?=[^a-zA-Z0-9_$]|$)/g);
    if (refs) {
        refs.forEach(function(m) {
            var v = m.substring(1);
            if (RESERVED.indexOf(v) < 0 && v.length <= 3 && !/^\d/.test(v)) allVars[v] = true;
        });
    }
});
var twoChars = Object.keys(allVars).sort();
console.log('Extracted', twoChars.length, 'VMP variable names');

lines.push('  var ' + twoChars.join(',') + ';');
lines.push('');

// Build the switch + for loop
var uniqueP = Object.keys(pToOps).map(Number).sort((a,b) => a-b);
lines.push('  var __p = ' + trace[0] + ';');
lines.push('  var __i = 0;');
lines.push('  for (; __p !== void 0; ) {');
lines.push('    switch (__p) {');

uniqueP.forEach(function(pVal) {
    var ops = pToOps[pVal];
    var next = pToNext[pVal];

    lines.push('      case ' + pVal + ':');
    if (ops && !ops.startsWith('//')) {
        // Check if it's a function definition (contains "function" and "return l.apply")
        if (ops.includes('function') && ops.includes('return l.apply')) {
            // This is a function factory — wrap to capture
            var fnName = ops.match(/^(\w+)\s*=/);
            if (fnName) {
                lines.push('        ' + fnName[0] + ' function() { return null; }; // stub');
            } else {
                lines.push('        ' + ops + ';');
            }
        } else {
            // Regular operation
            lines.push('        ' + ops + ';');
        }
    } else if (ops) {
        lines.push('        ' + ops + ';');
    }
    if (next != null && next !== undefined) {
        lines.push('        __p = ' + next + ';');
    } else {
        lines.push('        __p = void 0;');
    }
    lines.push('        break;');
});

lines.push('      default: __p = void 0; break;');
lines.push('    }');
lines.push('    if (++__i > 20000) { __p = void 0; }'); // safety
lines.push('  }');
lines.push('');
lines.push('  return pp || "";');
lines.push('}');
lines.push('');
lines.push('if (typeof module !== "undefined") module.exports = { generateToken: generateToken };');

lines.push('  return generateToken;');
lines.push('})');
var output = '(function() {\n' + lines.join('\n');
fs.writeFileSync(__dirname + '/vmp_executor_final.js', output);
console.log('Generated vmp_executor_final.js');
console.log('  States:', uniqueP.length);
console.log('  Lines:', lines.length);
console.log('  Size:', output.length, 'bytes');

// ===== Test =====
console.log('\nTesting...');
try {
    var fn = eval('(' + output + ')()');
} catch(e) {
    console.error('Parse error:', e.message);
    process.exit(1);
}
var t0 = Date.now();
var token = fn('testXYZ', 1700000000000);
var t1 = Date.now();
console.log('Token type:', typeof token);
console.log('Token value:', String(token).substring(0, 100));
console.log('Time:', (t1-t0), 'ms');
if (token) fs.writeFileSync(__dirname + '/vmp_final_token.txt', token);
