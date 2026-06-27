/**
 * ELIMINATE ENVIRONMENT CHECKS from security-11f5a2fc.js
 *
 * Strategy: Find all typeof / property-access operations that the VMP
 * uses to check the environment, and replace them with browser values.
 *
 * The browser values come from the VMP trace — we know exactly what
 * value each variable had at each step.
 *
 * Phase 1: Identity all environment check CERs from resolved_ops.json
 * Phase 2: For each check, find the browser's value (from trace context)
 * Phase 3: Replace the check in the source code with the literal value
 *
 * Output: security-env-resolved.js
 */
var fs = require('fs');

// ===== Load resolved operations =====
var resolvedOps = JSON.parse(fs.readFileSync(__dirname + '/resolved_ops.json', 'utf8'));

// ===== Load browser trace =====
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]) });

// ===== Load state map =====
var mapData = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8'));
var stateMap = mapData.map;

// ===== Phase 1: Identify env checks =====
// An env check is an operation that:
//   - Uses typeof, navigator, document, window, screen, etc.
//   - Has a conditional p = X ? A : B where different envs produce different p

var envChecks = [];
var parser = require('@babel/parser');
var generator = require('@babel/generator').default;
function gen(n) { return generator(n).code; }

// Load source
var source = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

// ===== Phase 2: Build p-to-next mapping from browser trace =====
var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

// ===== Phase 3: For each trace step, determine variable values =====
// We walk the trace and execute the state map operations in a virtual machine
// to track variable values

var varValues = {};  // variable name → resolved value
var traceDecisions = [];  // for each conditional, which branch was taken

// Simulate VMP execution using state map + browser trace
trace.forEach(function(p, idx) {
    var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;
    var entry = stateMap[key];
    if (!entry) return;

    var code = entry.code;

    // Extract the operation (before p = N)
    var ops = code.replace(/,\s*p\s*=\s*(\d+)\s*$/, '')
                  .replace(/^p\s*=\s*(\d+)\s*$/, '')
                  .replace(/^p\s*=\s*(\d+)\s*,\s*/, '');

    // Handle conditionals: p = X ? A : B
    var condMatch = ops.match(/^p\s*=\s*(\w+)\s*\?\s*(\d+)\s*:\s*(\d+)$/);
    if (condMatch) {
        var condVar = condMatch[1];
        var pTrue = parseInt(condMatch[2]);
        var pFalse = parseInt(condMatch[3]);
        var actualNext = nextMap[p];

        // Record which branch was taken AND what the value was
        traceDecisions.push({
            p: p, cer: key, variable: condVar,
            pTrue: pTrue, pFalse: pFalse, actual: actualNext,
            // Determine the value: if browser chose pTrue, varValue was truthy
            browserValue: actualNext === pTrue ? 'truthy' :
                          actualNext === pFalse ? 'falsy' : 'other'
        });
    }

    // Parse variable assignments: varName = value
    var assignMatch = ops.match(/^(\w+)\s*=\s*(.+)$/);
    if (assignMatch && !assignMatch[2].includes('function')) {
        var varName = assignMatch[1];
        var rhs = assignMatch[2].trim();

        // Try to evaluate
        if (/^".*"$/.test(rhs)) {
            varValues[varName] = JSON.parse(rhs);
        } else if (/^\d+$/.test(rhs)) {
            varValues[varName] = parseInt(rhs);
        } else if (rhs.startsWith('typeof ')) {
            var target = rhs.substring(7);
            varValues[varName] = 'browser_value'; // placeholder
        }
    }
});

// ===== Phase 4: Categorize env checks =====
// Find all typeof operations
var typeofChecks = [];
traceDecisions.forEach(function(d) {
    if (d.browserValue === 'other') return;

    // Look up this CER's operation for context
    var entry = stateMap[d.cer.split('_').join('_')]; // reconstruct key
    // Actually need to look at the raw code
});

// Count decision stats
var truthyDecisions = traceDecisions.filter(function(d) { return d.browserValue === 'truthy'; });
var falsyDecisions = traceDecisions.filter(function(d) { return d.browserValue === 'falsy'; });
console.log('Conditional decisions in trace:');
console.log('  Truthy branches:', truthyDecisions.length);
console.log('  Falsy branches:', falsyDecisions.length);
console.log('  Other (no match):', traceDecisions.length - truthyDecisions.length - falsyDecisions.length);

// Show the decisions
console.log('\n=== Conditional decisions (first 30) ===');
traceDecisions.slice(0, 30).forEach(function(d) {
    console.log('  p=' + d.p + ' [' + d.cer + '] ' + d.variable + ' → ' +
                d.browserValue + ' (T=' + d.pTrue + ' F=' + d.pFalse + ' actual=' + d.actual + ')');
});

// ===== Phase 5: The key insight =====
// If we can determine the value of each conditional variable,
// we can replace the conditional with a direct p assignment.
//
// The browser trace tells us which branch was taken at each p.
// We need to go one level deeper: what VALUE did the variable have?
//
// For example: p = hg ? 19472 : 4433
//   Browser chose p=19472 → hg was truthy
//   We need to find what CER set hg and what value it had
//
// This is the same as constant propagation!

// Find all assignments to hg (the variable from our first divergence point)
console.log('\n=== Tracing variable hg ===');
Object.keys(stateMap).forEach(function(k) {
    var e = stateMap[k];
    if (e.code.includes('hg')) {
        console.log('  ' + k + ': ' + e.code.substring(0, 120));
    }
});

// Now trace the full variable dependency chain for a few key conditionals
console.log('\n=== Top 10 conditionals with var context ===');
traceDecisions.slice(0, 10).forEach(function(d) {
    console.log('\n--- Decision at p=' + d.p + ' [' + d.cer + '] ---');
    console.log('  Variable: ' + d.variable);
    console.log('  Browser chose: ' + d.browserValue + ' → p=' + d.actual);

    // Find what set this variable
    Object.keys(stateMap).forEach(function(k) {
        var e = stateMap[k];
        var assignRegex = new RegExp('\\b' + d.variable + '\\s*=\\s*');
        if (assignRegex.test(e.code)) {
            console.log('  Set at ' + k + ': ' + e.code.substring(0, 100));
        }
    });
});
