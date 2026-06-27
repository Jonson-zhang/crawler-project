/**
 * VMP Execution Path Extractor
 *
 * Strategy: Parse the VMP's 3-layer switch to build a p→code map,
 * then output the actual execution path in readable form.
 *
 * The VMP dispatcher:
 *   W = p & 31        → outer switch case
 *   j = (p>>5) & 31   → middle switch case
 *   F = (p>>10) & 31  → inner branch (not a switch, just if/ternary chain)
 *
 * Each leaf: ...code... ; p = N  or  ...code... ; p = cond ? A : B
 */

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// ===== Step 1: Find the VMP interpreter function =====
// It starts with: function l(){try{for(var p=arguments[0],a,_,c,...
var vmpStart = code.indexOf('function l(){try{for(var p=arguments[0]');
if (vmpStart < 0) {
    // Search more broadly
    vmpStart = code.indexOf('function l(){try{');
}
console.error('VMP function starts at position:', vmpStart);

// ===== Step 2: Build p→leaf-content map =====
// Parse the 3-layer structure manually using regex + bracket matching

function extractSwitchBody(text, switchVar) {
    // Given "switch(WSl){...}", extract the case blocks
    // Returns: { caseValue: bodyText }
    var result = {};

    // Find the opening { after switch(...){
    var idx = text.indexOf('switch(' + switchVar + ')');
    if (idx < 0) return result;

    // Find matching { }
    var braceStart = text.indexOf('{', idx);
    if (braceStart < 0) return result;

    // Find matching closing brace
    var depth = 0;
    var braceEnd = -1;
    for (var i = braceStart; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
    }
    if (braceEnd < 0) return result;

    var body = text.substring(braceStart + 1, braceEnd);

    // Split by "case N:" or "case N:" patterns
    // But we need to handle nested switches...
    // Simple approach: find "case N:" followed by break/continue
    var caseRegex = /case\s+(\d+):/g;
    var caseMatch;
    var caseStarts = [];
    while ((caseMatch = caseRegex.exec(body)) !== null) {
        caseStarts.push({ value: parseInt(caseMatch[1]), pos: caseMatch.index + caseMatch[0].length });
    }

    // Find the end of each case (the next "case N:" or "default:" or end of body)
    for (var i = 0; i < caseStarts.length; i++) {
        var start = caseStarts[i].pos;
        var end;
        if (i + 1 < caseStarts.length) {
            end = body.indexOf('case', caseStarts[i+1].pos - 10);
            if (end < 0) end = caseStarts[i+1].pos - 5;
        } else {
            // Last case - find the closing } of the switch (break; ... })
            end = body.lastIndexOf('break;');
            if (end < start) end = body.length;
        }
        var caseBody = body.substring(start, end).trim();
        // Strip trailing break; or }
        caseBody = caseBody.replace(/\}?\s*$/, '');
        result[caseStarts[i].value] = caseBody;
    }

    return result;
}

// Extract the full VMP function body
var vmpEnd = -1;
var depth = 0;
var funcStart = -1;
for (var i = vmpStart; i < code.length; i++) {
    if (code[i] === '{') {
        if (depth === 0) funcStart = i;
        depth++;
    } else if (code[i] === '}') {
        depth--;
        if (depth === 0) { vmpEnd = i + 1; break; }
    }
}
var vmpBody = code.substring(funcStart + 1, vmpEnd - 1);
console.error('VMP body length:', vmpBody.length);

// Find the main while loop
var whileIdx = vmpBody.indexOf('p!==void 0;){');
if (whileIdx < 0) whileIdx = vmpBody.indexOf('p!==void 0;)\n');
console.error('Main while loop at offset:', whileIdx);

var whileBody = vmpBody.substring(whileIdx);
// Extract the outer switch
var switchIdx = whileBody.indexOf('switch(WSl){');
console.error('Outer switch at offset:', switchIdx);

var outerSwitch = whileBody.substring(switchIdx);
// Get all outer cases (W = p&31)
var outerCases = extractSwitchBody(outerSwitch, 'WSl');
console.error('Outer cases:', Object.keys(outerCases).length);

// For each outer case, extract middle switches
var leafMap = {}; // p → { code: string, next: number[] }

Object.keys(outerCases).forEach(function(W) {
    var outerBody = outerCases[W];
    // Find the middle switch
    var msIdx = outerBody.indexOf('switch(jSl){');
    if (msIdx < 0) {
        // Might have only one jSl value handled
        // Check for function declaration instead
        if (outerBody.indexOf('var ') >= 0) {
            // This case has inner functions - extract differently
        }
        return;
    }

    var middleSwitch = outerBody.substring(msIdx);
    var middleCases = extractSwitchBody(middleSwitch, 'jSl');

    Object.keys(middleCases).forEach(function(j) {
        var middleBody = middleCases[j];
        // The inner part: "var a = function(){...}.apply(...); if(a) return a; break;"
        // Inside: "0===FSl?code;p=X:1===FSl?code;p=Y:..."

        // Extract the ternary chain: F=0→code;F=1→code;F=2→code...
        var trifRegex = /(\d+)===FSl\?[^:]*:|\d+===FSl\?/g;
        var matches = [];
        var m;
        while ((m = trifRegex.exec(middleBody)) !== null) {
            var fVal = parseInt(m[0]);
            // Find the full ternary branch
            var start = m.index + m[0].length;
            // Find the next : or end of ternary chain
            var end = middleBody.indexOf(':', start);
            if (end < 0) end = middleBody.length;

            // Look for p = NUMBER or p = cond ? A : B
            var branch = middleBody.substring(start, end);
            var nextP = [];
            var pAssignRegex = /p=(\d+)/g;
            var pa;
            while ((pa = pAssignRegex.exec(branch)) !== null) {
                nextP.push(parseInt(pa[1]));
            }
            // Also check conditional
            var pCondRegex = /p=.*?\?(\d+):(\d+)/g;
            var pc;
            while ((pc = pCondRegex.exec(branch)) !== null) {
                nextP.push(parseInt(pc[1]));
                nextP.push(parseInt(pc[2]));
            }

            var pValue = (parseInt(W) | (parseInt(j) << 5) | (fVal << 10));
            leafMap[pValue] = { W: parseInt(W), j: parseInt(j), F: fVal, code: branch.trim(), next: nextP };
        }
    });
});

console.error('Built leaf map with', Object.keys(leafMap).length, 'p-values');

// ===== Step 3: Trace the execution path from known entry points =====
// Find ABC.z entry: we know from earlier analysis that ABC constructor wrappers
// return l.apply(this, [ENTRY].concat(Array.prototype.slice.call(arguments)))
var entries = [];
var wrapperRe = /(\w+)=function\s+\w*\s*\(\s*\)\s*\{\s*return\s+l\.apply\s*\(\s*this\s*,\s*\[(\d+)\]\s*\.concat\s*\(\s*Array\.prototype\.slice\.call\s*\(\s*arguments\s*\)\s*\)\s*\)\s*\}/g;
var wm;
while ((wm = wrapperRe.exec(code)) !== null) {
    entries.push({ name: wm[1], entry: parseInt(wm[2]) });
}

console.error('Entry wrappers:', entries.filter(function(e) { return e.name.length <= 3; }).slice(0, 20).map(function(e) { return e.name + '=' + e.entry; }).join(', '));

// Find which entries relate to ABC
// From earlier analysis: Kl='yzABC' appears in p=4097
// and ABC constructor wrappers use p=1219, 5285, 13760
var abcEntries = entries.filter(function(e) { return [1219, 5285, 13760, 8813].indexOf(e.entry) >= 0; });
console.error('ABC-related entries:', abcEntries.map(function(e) { return e.name + '=' + e.entry; }));

// ===== Step 4: For a p-value, extract the full code path recursively =====
function tracePath(startP, maxDepth) {
    maxDepth = maxDepth || 10000;
    var visited = new Set();
    var path = [];
    var current = startP;

    while (current !== undefined && path.length < maxDepth) {
        if (visited.has(current)) {
            // Cycle detected
            break;
        }
        visited.add(current);

        var leaf = leafMap[current];
        if (!leaf) {
            path.push({ p: current, code: '// Unknown state ' + current, W: current&31, j: (current>>5)&31, F: (current>>10)&31 });
            break;
        }

        path.push({ p: current, code: leaf.code, W: leaf.W, j: leaf.j, F: leaf.F });

        // Determine next p from the code
        // Simple approach: find the first p assignment
        var nextMatch = leaf.code.match(/p=(\d+)/);
        if (nextMatch) {
            current = parseInt(nextMatch[1]);
        } else {
            // Check conditional: p = cond ? A : B
            var condMatch = leaf.code.match(/p=.*?\?(\d+):(\d+)/);
            if (condMatch) {
                // We can't know which branch - just pick the first
                current = parseInt(condMatch[1]);
            } else {
                current = undefined; // end of chain
            }
        }
    }

    return path;
}

// ===== Step 5: Output the execution path for analysis =====
// For now, just dump the structure of key entries
if (abcEntries.length > 0) {
    var entry = abcEntries[0].entry;
    console.error('\nTracing from entry p=' + entry + ':');
    var path = tracePath(entry, 50);
    path.forEach(function(step, i) {
        if (step.code.length > 120) step.code = step.code.substring(0, 120) + '...';
        console.error('  [' + i + '] p=' + step.p + ' W=' + step.W + ' j=' + step.j + ' F=' + step.F + ': ' + step.code);
    });
}

// Output the full leaf map as JSON for Python analysis
console.log(JSON.stringify({
    totalStates: Object.keys(leafMap).length,
    entries: entries.filter(function(e) { return e.name.length <= 3; }),
    leafMap: leafMap
}));
