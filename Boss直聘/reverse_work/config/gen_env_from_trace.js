/**
 * Generate environment patch from browser trace
 *
 * For each conditional p = X ? A : B in the trace:
 *   1. Look at what the NEXT p was → that tells us the choice
 *   2. Find what set X to determine the env value
 *   3. Generate a patch that forces these values
 *
 * Strategy: instead of patching individual env properties,
 * DIRECTLY patch the VMP variables that are checked in conditionals.
 */
var fs = require('fs');

var mapData = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8'));
var stateMap = mapData.map;
var trace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build: for each conditional, what choice did the browser make?
var nextMap = {};
for (var i = 0; i < trace.length - 1; i++) {
    if (!(trace[i] in nextMap)) nextMap[trace[i]] = trace[i + 1];
}

// Extract ALL conditional decisions
var decisions = [];
trace.forEach(function(p) {
    var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;
    var entry = stateMap[key];
    if (!entry) return;

    var code = entry.code;
    // Match: p = <var> ? <n1> : <n2>
    var m = code.match(/^p\s*=\s*(\w+)\s*\?\s*(\d+)\s*:\s*(\d+)\s*$/);
    if (!m) return;

    var condVar = m[1];
    var pTrue = parseInt(m[2]);
    var pFalse = parseInt(m[3]);
    var actualNext = nextMap[p];

    if (actualNext === pTrue) {
        decisions.push({ p: p, cer: key, var: condVar, choice: 'truthy', value: 'truthy' });
    } else if (actualNext === pFalse) {
        decisions.push({ p: p, cer: key, var: condVar, choice: 'falsy', value: 'falsy' });
    } else {
        decisions.push({ p: p, cer: key, var: condVar, choice: 'other:' + actualNext, value: 'unknown' });
    }
});

// Now trace BACK from each decision to find what set the condition variable
// We want to know the FIRST assignment to each variable that isn't a pure data assignment
var varSources = {};
decisions.forEach(function(d) {
    if (d.choice === 'truthy' || d.choice === 'falsy') {
        var varName = d.var;
        if (varSources[varName]) return; // already know

        // Search backward through the trace for the last assignment to this var
        for (var i = trace.length - 1; i >= 0; i--) {
            var p = trace[i];
            var Cbl = p & 31, Ebl = (p >> 5) & 31, Rbl = (p >> 10) & 31;
            var key = Cbl + '_' + Ebl + '_' + Rbl;
            var entry = stateMap[key];
            if (!entry) continue;

            // Match: <varName> = <something> (after stripping p=N suffix)
            var cleanCode = code.replace(/,\s*p\s*=\s*\d+\s*$/, '').replace(/\s+$/, '');
            var assignRegex = new RegExp('^' + varName + '\\s*=\\s*(.+)$');
            var am = cleanCode.match(assignRegex);
            if (!am) continue;

            var rhs = am[1].trim();
            // Clean p=N suffix
            rhs = rhs.replace(/,\s*p\s*=\s*\d+\s*$/, '');

            // If this is a typeof/property check, record it
            if (rhs.startsWith('typeof ') || rhs.includes('.') || rhs.match(/^!/) || rhs.match(/[<>=!]=/)) {
                varSources[varName] = {
                    var: varName,
                    assignedAt: key,
                    expr: rhs,
                    pValue: p,
                };
                break; // found it
            }

            // If it's a string concatenation, this is likely the env check
            if (rhs.includes('+')) {
                varSources[varName] = {
                    var: varName,
                    assignedAt: key,
                    expr: rhs,
                    pValue: p,
                    type: 'string_concat'
                };
                break;
            }
            // Otherwise keep looking (data assignment, not env check)
        }
    }
});

console.log('Total conditional decisions:', decisions.length);
console.log('Traceable var sources:', Object.keys(varSources).length);

// Print the key decisions with their sources
console.log('\n=== Decisions with traceable sources ===');
Object.keys(varSources).forEach(function(v) {
    var s = varSources[v];
    // Find what decision this affects
    var affected = decisions.filter(function(d) { return d.var === v; });
    console.log('\n[' + v + '] assigned at ' + s.assignedAt + ' (p=' + s.pValue + '):');
    console.log('  expr: ' + s.expr);
    console.log('  type: ' + (s.type || 'direct'));
    affected.forEach(function(d) {
        console.log('  → conditional at p=' + d.p + ': browser chose ' + d.choice);
    });
});

// Now generate the env patch
console.log('\n=== ENVIRONMENT PATCH ===');
console.log('// Add these to Node.js env:');
Object.keys(varSources).forEach(function(v) {
    var s = varSources[v];
    var expr = s.expr;

    // Determine the browser value
    var affected = decisions.filter(function(d) { return d.var === v; });
    var browserChose = affected.length > 0 ? affected[0].choice : 'unknown';

    // For typeof checks, the browser value determines the result
    if (expr.startsWith('typeof ')) {
        console.log('  // ' + v + ' = ' + expr + ' → browser got ' + browserChose);
    } else if (expr.match(/^!/)) {
        console.log('  // ' + v + ' = ' + expr + ' → browser got ' + browserChose);
    } else {
        console.log('  // ' + v + ' = ' + expr + ' → needs env value');
    }
});

// Save
fs.writeFileSync(__dirname + '/env_decisions.json', JSON.stringify({
    decisions: decisions,
    sources: varSources
}, null, 2));
console.log('\nSaved env_decisions.json');
