/**
 * Find the exact code block for state CER (15,5,21) in security-11f5a2fc.js
 * This is the FIRST divergence point between Browser and Node.js paths
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

// Find function l()
function findL(node, d) {
    if (d > 15 || !node) return null;
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'l') {
        var b = node.body.body;
        if (b && b[0] && b[0].type === 'TryStatement') {
            var tb = b[0].block.body;
            if (tb && tb[0] && tb[0].type === 'ForStatement') return node;
        }
    }
    var skip = ['type','start','end','loc','leadingComments','trailingComments','innerComments','extra','raw','rawValue'];
    for (var k in node) {
        if (skip.indexOf(k) >= 0) continue;
        if (node[k] && typeof node[k] === 'object') {
            if (Array.isArray(node[k])) {
                for (var i = 0; i < Math.min(node[k].length, 100); i++) {
                    var r = findL(node[k][i], d + 1);
                    if (r) return r;
                }
            } else {
                var r = findL(node[k], d + 1);
                if (r) return r;
            }
        }
    }
    return null;
}

var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
var lFunc = findL(ast.program, 0);
if (!lFunc) { console.error('l() not found'); process.exit(1); }

var forBody = lFunc.body.body[0].block.body[0].body.body;

// Find the main switch(Cbl)
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}

// Find Cbl case 15
var case15 = null;
for (var i = 0; i < wSwitch.cases.length; i++) {
    var c = wSwitch.cases[i];
    if (c.test && t.isNumericLiteral(c.test) && c.test.value === 15) {
        case15 = c;
        break;
    }
}

if (!case15) { console.error('Cbl case 15 not found'); process.exit(1); }
console.log('=== Cbl case 15 ===');
console.log(gen(case15).substring(0, 300));

// Inside case 15: look for var declaration with function() containing switch(Ebl)
var c15Body = case15.consequent;
for (var si = 0; si < c15Body.length; si++) {
    var stmt = c15Body[si];
    if (!t.isVariableDeclaration(stmt)) continue;

    for (var di = 0; di < stmt.declarations.length; di++) {
        var decl = stmt.declarations[di];
        if (!decl.init || !t.isCallExpression(decl.init)) continue;
        var callee = decl.init.callee;
        if (!t.isMemberExpression(callee) || callee.property.name !== 'apply') continue;
        var fn = callee.object;
        if (!t.isFunctionExpression(fn)) continue;

        // Inside fn: switch(Ebl)
        var fnBody = fn.body.body;
        var eSwitch = null;
        for (var fi = 0; fi < fnBody.length; fi++) {
            if (t.isSwitchStatement(fnBody[fi])) { eSwitch = fnBody[fi]; break; }
        }
        if (!eSwitch) continue;

        // Find Ebl case 5
        var case5 = null;
        for (var ei = 0; ei < eSwitch.cases.length; ei++) {
            var ec = eSwitch.cases[ei];
            if (ec.test && t.isNumericLiteral(ec.test) && ec.test.value === 5) {
                case5 = ec;
                break;
            }
        }

        if (!case5) {
            console.log('Ebl case 5 not found in this Cbl=15 slot');
            // Print ALL E cases available
            console.log('Available E cases:');
            eSwitch.cases.forEach(function(ec) {
                if (ec.test && t.isNumericLiteral(ec.test))
                    console.log('  Ebl=', ec.test.value);
            });
            continue;
        }

        console.log('\n=== Ebl case 5 found! ===');
        console.log(gen(case5).substring(0, 500));

        // Inside E case 5: find var declaration with function() containing switch(Rbl)
        var e5Body = case5.consequent;
        for (var ei5 = 0; ei5 < e5Body.length; ei5++) {
            var e5stmt = e5Body[ei5];
            if (!t.isVariableDeclaration(e5stmt)) continue;

            for (var e5di = 0; e5di < e5stmt.declarations.length; e5di++) {
                var e5decl = e5stmt.declarations[e5di];
                if (!e5decl.init || !t.isCallExpression(e5decl.init)) continue;
                var e5callee = e5decl.init.callee;
                if (!t.isMemberExpression(e5callee) || e5callee.property.name !== 'apply') continue;
                var e5fn = e5callee.object;
                if (!t.isFunctionExpression(e5fn)) continue;

                // Inside e5fn: switch(Rbl)
                var e5fnBody = e5fn.body.body;
                var rSwitch = null;
                for (var rfi = 0; rfi < e5fnBody.length; rfi++) {
                    if (t.isSwitchStatement(e5fnBody[rfi])) { rSwitch = e5fnBody[rfi]; break; }
                }
                if (!rSwitch) continue;

                console.log('\n=== Rbl cases found ===');
                console.log('Total R cases:', rSwitch.cases.length);

                // Find Rbl case 21
                var case21 = null;
                for (var ri = 0; ri < rSwitch.cases.length; ri++) {
                    var rc = rSwitch.cases[ri];
                    if (rc.test && t.isNumericLiteral(rc.test) && rc.test.value === 21) {
                        case21 = rc;
                        break;
                    }
                }

                if (case21) {
                    console.log('\n$$$ Rbl=21 CASE BODY (THE DIVERGENCE POINT) $$$');
                    console.log(gen(case21));
                    console.log('\n=== Full R case21 details ===');
                    case21.consequent.forEach(function(s, i) {
                        console.log('\n--- Stmt', i, ':', s.type, '---');
                        console.log(gen(s));
                    });
                } else {
                    console.log('Rbl=21 not found! Available R cases:');
                    rSwitch.cases.forEach(function(rc) {
                        if (rc.test && t.isNumericLiteral(rc.test))
                            console.log('  Rbl=', rc.test.value);
                    });
                }
            }
        }
    }
}
