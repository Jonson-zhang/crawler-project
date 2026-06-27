/**
 * Build PURE ALGORITHM from browser trace + state map
 *
 * For each state in the browser trace:
 *   1. Decode p → CER = (p&31, (p>>5)&31, (p>>10)&31)
 *   2. Look up in vmp_complete_map.json
 *   3. If found: extract the operations (everything before "p = N")
 *   4. If not found: mark as "unknown"
 *
 * The "ops" are all the variable assignments and function calls
 * that happen BEFORE the p = N transition.
 *
 * Output: pure_operations.json — flattened list of operations
 */
var fs = require('fs');

// Load browser trace
var browserTraceRaw = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8');
var browserTrace = browserTraceRaw.split('\n')
    .filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Load state map
var stateData = JSON.parse(fs.readFileSync(__dirname + '/vmp_complete_map.json', 'utf8'));
var stateMap = stateData.map;

console.log('Trace states:', browserTrace.length);
console.log('State map entries:', Object.keys(stateMap).length);

// Categorize each trace state
var results = [];
var found = 0;
var notFound = 0;
var skipP = new Set();  // states where ops is just "p = N" (no useful operations)

// Track unique CER keys
var seenCER = {};

browserTrace.forEach(function(p, idx) {
    var Cbl = p & 31;
    var Ebl = (p >> 5) & 31;
    var Rbl = (p >> 10) & 31;
    var key = Cbl + '_' + Ebl + '_' + Rbl;

    if (stateMap[key]) {
        var entry = stateMap[key];
        var ops = entry.code;

        // Extract the "business logic" (everything before p = N)
        // Pattern: "varName = value, p = N" → "varName = value"
        var businessOps = ops;

        // Remove trailing "p = N" or ", p = N" part
        var pMatch = businessOps.match(/,?\s*p\s*=\s*\d+\s*$/);
        if (pMatch) {
            businessOps = businessOps.substring(0, businessOps.length - pMatch[0].length).replace(/,\s*$/, '');
        }

        // Remove leading "p = N, " or entire "p = N"
        var purePAssign = businessOps.match(/^p\s*=\s*\d+\s*$/);
        if (purePAssign) {
            businessOps = '[PASS:' + entry.next + ']';
        }

        if (businessOps.length > 0 && businessOps !== '[PASS:' + entry.next + ']') {
            if (!seenCER[key]) seenCER[key] = [];
            seenCER[key].push(idx);

            results.push({
                idx: idx,
                p: p,
                cer: key,
                next: entry.next,
                ops: businessOps
            });
            found++;
        } else {
            skipP.add(p);
        }
    } else {
        notFound++;
        if (notFound <= 20) {
            console.log('NOT FOUND: p=' + p + ' CER=' + key);
        }
    }
});

console.log('\n=== Results ===');
console.log('With business ops:', found);
console.log('Not found in map:', notFound);
console.log('Pure p-assign (skipped):', skipP.size);

// Deduplicate: remove consecutive identical ops (the VMP cycles)
var deduped = [];
results.forEach(function(r) {
    var last = deduped[deduped.length - 1];
    if (last && last.ops === r.ops && last.cer === r.cer) {
        // Duplicate cycle — skip
        return;
    }
    deduped.push(r);
});

console.log('After dedup:', deduped.length);

// Save detailed results
var output = {
    meta: {
        totalTraceSteps: browserTrace.length,
        totalOps: found,
        notFound: notFound,
        dedupedOps: deduped.length,
        source: 'browser_vmp_trace.txt',
        seed: 'testXYZ (hardcoded in test)',
    },
    operations: deduped.map(function(r) {
        return { p: r.p, cer: r.cer, ops: r.ops };
    }),
};

fs.writeFileSync(__dirname + '/pure_operations.json', JSON.stringify(output, null, 2));
console.log('Saved pure_operations.json');

// Also generate a flat JS file
var flatLines = [];
flatLines.push('// Auto-generated pure algorithm from browser VMP trace');
flatLines.push('// ' + deduped.length + ' unique operations');
flatLines.push('');
flatLines.push('function generateToken(seed, ts) {');
flatLines.push('  var p, a, _, c, e, t, y, o, v, r, n, i, s, d, h, u, m, g, f, S, b, C, E, R, T, A, M, D, L, G, x, N, P, V, w, I, B, O, k, W, j, F, z, H, U, J, Z, K, X, Q, q, Y, $;');
flatLines.push('  // Variables from VMP (with longer names)');
flatLines.push('');

// Group by CER pattern to identify loops
var opGroups = [];
var currentGroup = null;
deduped.forEach(function(r, i) {
    if (!currentGroup || currentGroup.cer !== r.cer || i === deduped.length - 1) {
        if (currentGroup) opGroups.push(currentGroup);
        currentGroup = { cer: r.cer, count: 1, firstIdx: r.idx, ops: r.ops };
    } else {
        currentGroup.count++;
    }
});
if (currentGroup) opGroups.push(currentGroup);

console.log('\n=== Top repeated CER operations ===');
opGroups.sort(function(a, b) { return b.count - a.count; });
opGroups.slice(0, 20).forEach(function(g) {
    console.log('  CER=' + g.cer + ' x' + g.count + ': ' + g.ops.substring(0, 80));
});

// Generate clean code
deduped.forEach(function(r) {
    if (!r.ops.startsWith('[PASS:')) {
        flatLines.push('  ' + r.ops + ';');
    }
});

flatLines.push('');
flatLines.push('  // TODO: Generate token from final state');
flatLines.push('  return "PLACEHOLDER";');
flatLines.push('}');
flatLines.push('');
flatLines.push('module.exports = { generateToken };');

fs.writeFileSync(__dirname + '/pure_algo_flat.js', flatLines.join('\n'));
console.log('Saved pure_algo_flat.js (' + flatLines.length + ' lines)');
