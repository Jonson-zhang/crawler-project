/**
 * For each state in the browser trace, extract what operation it performs
 * by finding the corresponding W/j/F case body in the security-live.js file.
 */
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-live.js', 'utf8');

function decode(p) {
    return { W: p & 31, j: (p >> 5) & 31, F: (p >> 10) & 31 };
}

// Browser states (sorted by frequency, most frequent first)
var states = [16974, 2164, 2273, 10689, 15635, 3218, 1481, 22017, 1219, 2096, 6319, 7279, 7299, 20975, 3208, 16420, 20843, 397, 1194, 1709, 2310, 2527, 3216, 3432, 3655, 4037, 6798, 8436, 10734, 12144, 15122, 15984, 16058, 16834, 18784, 20492, 20754, 20842, 21058, 21065, 21649, 21783, 21867, 22059, 24916, 25624, 26712, 31589];

// For each state, find the operation
states.forEach(function(state) {
    var d = decode(state);
    console.log('\n=== State ' + state + ' (W=' + d.W + ' j=' + d.j + ' F=' + d.F + ') ===');

    // Find WSl case d.W
    var wCaseRE = new RegExp('case ' + d.W + ':([\\s\\S]*?)(?=case ' + (d.W + 1) + ':|case ' + (d.W) + ':|default:)');
    var wMatch = wCaseRE.exec(code);
    if (!wMatch) {
        // Try from the switch(WSl)
        var switchPos = code.indexOf('switch (WSl) {');
        var section = code.substring(switchPos);
        var caseStr = '\\n            case ' + d.W + ':';
        var casePos = section.indexOf(caseStr);
        if (casePos < 0) casePos = section.indexOf('case ' + d.W + ':');
        if (casePos >= 0) {
            // Find next case
            var rest = section.substring(casePos + ('case ' + d.W + ':').length);
            var nextCase = rest.search(/case \d+:/);
            wMatch = [null, rest.substring(0, nextCase >= 0 ? nextCase : rest.length)];
        }
    }

    if (!wMatch || !wMatch[1]) {
        console.log('  WSl case NOT FOUND');
        return;
    }

    var wBody = wMatch[1];

    // Find jSl case d.j
    var jCaseRE = new RegExp('case ' + d.j + ':', 'g');
    var jMatch;
    var found = false;

    // Search for jSl case with FSl check on d.F
    // Pattern: F === d.F ? (operation, p = next) :
    var fPattern = d.F + ' === FSl';

    while ((jMatch = jCaseRE.exec(wBody)) !== null) {
        var jPos = jMatch.index;
        // Check if this case references FSl
        var afterCase = wBody.substring(jPos, jPos + 500);
        if (afterCase.indexOf(fPattern) >= 0) {
            // Extract the operation
            var opStart = afterCase.indexOf(fPattern);
            var opSection = afterCase.substring(opStart, opStart + 300);

            // Extract: ? ((X = Y), (p = next)) : or ? (p = next) :
            var opMatch = opSection.match(/\?\s*(\(.*?\)\s*,\s*)?\s*\(p\s*=\s*(\d+)\)/);
            var nextState = opMatch ? parseInt(opMatch[2]) : null;

            // Extract what's before , (p = next)
            var ops = [];
            if (opMatch && opMatch[1]) {
                var opStr = opMatch[1].replace(/^\(|\)$/g, ''); // remove outer parens
                ops = opStr.split(',').map(function(o) { return o.trim(); }).filter(function(o) { return o && !o.startsWith('p ='); });
            }

            console.log('  Operations: ' + (ops.length > 0 ? ops.join('; ') : '(none)'));
            console.log('  Next state: ' + nextState);
            found = true;
            break;
        }
    }

    if (!found) {
        // Try simpler pattern: case j: that has no FSl switch (FSl independent)
        jCaseRE.lastIndex = 0;
        while ((jMatch = jCaseRE.exec(wBody)) !== null) {
            var after = wBody.substring(jMatch.index, jMatch.index + 200);
            if (after.indexOf('FSl') < 0) {
                // FSl independent - extract operation
                var pMatch = after.match(/\(p\s*=\s*(\d+)\)/);
                var nextState = pMatch ? parseInt(pMatch[1]) : null;

                // Extract operation before p assignment
                var before = after.substring(0, after.indexOf('(p ='));
                // Clean up
                before = before.replace(/case \d+:\s*/, '').replace(/\(\(/, '(').trim();

                console.log('  FSl-independent operation');
                console.log('  Code: ' + before.substring(0, 150).trim());
                console.log('  Next state: ' + nextState);
                found = true;
                break;
            }
        }
    }

    if (!found) {
        console.log('  Operation NOT FOUND');
    }
});
