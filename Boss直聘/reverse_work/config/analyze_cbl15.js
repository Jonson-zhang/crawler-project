/**
 * Direct analysis of Cbl=15 structure in VMP
 * Goal: find what Ebl=5, Rbl=21 dispatches to
 */
var parser = require('@babel/parser'), t = require('@babel/types');
var gen = function(n) { return require('@babel/generator').default(n).code; };
var fs = require('fs');
var s = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(s, { sourceType: 'script', errorRecovery: true });

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
    for (var k in node) {
        if (['type','start','end','loc','leadingComments','trailingComments','innerComments','extra','raw','rawValue'].indexOf(k) >= 0) continue;
        if (node[k] && typeof node[k] === 'object') {
            if (Array.isArray(node[k])) {
                for (var i = 0; i < Math.min(node[k].length, 100); i++) {
                    var r = findL(node[k][i], d + 1); if (r) return r;
                }
            } else { var r = findL(node[k], d + 1); if (r) return r; }
        }
    }
    return null;
}
var lFunc = findL(ast.program, 0);
var forBody = lFunc.body.body[0].block.body[0].body.body;

// Find outer switch(Cbl)
var wSwitch = null;
for (var i = 0; i < forBody.length; i++) {
    if (t.isSwitchStatement(forBody[i])) { wSwitch = forBody[i]; break; }
}

// Find ALL case 15: in the outer switch AND count them
var c15matches = [];
wSwitch.cases.forEach(function(c, idx) {
    if (c.test && t.isNumericLiteral(c.test) && c.test.value === 15) {
        c15matches.push({ idx: idx, node: c });
    }
});
console.log('Found', c15matches.length, 'Cbl=15 case(s) in outer switch');

c15matches.forEach(function(m) {
    var body = m.node.consequent;
    console.log('\n=== Cbl case 15 at index', m.idx, '===');

    // Print each statement
    body.forEach(function(stmt, si) {
        console.log('\n--- Stmt', si, ':', stmt.type, '---');
        var code = gen(stmt);
        console.log(code.substring(0, 300));

        // If it's a var decl with function, extract switch structure
        if (t.isVariableDeclaration(stmt)) {
            stmt.declarations.forEach(function(decl) {
                if (decl.init && t.isCallExpression(decl.init)) {
                    var callee = decl.init.callee;
                    if (t.isMemberExpression(callee) && callee.property.name === 'apply') {
                        var fn = callee.object;
                        if (t.isFunctionExpression(fn)) {
                            console.log('\n    >>> Inner function body:');
                            fn.body.body.forEach(function(ifn, ifi) {
                                console.log('    [' + ifi + ']', ifn.type);
                                if (t.isSwitchStatement(ifn)) {
                                    console.log('        Switch discriminant:', gen(ifn.discriminant));
                                    ifn.cases.forEach(function(sc) {
                                        var label = sc.test ? gen(sc.test) : 'default';
                                        console.log('        case', label, ': body_stmts=', sc.consequent.length);
                                    });
                                } else {
                                    console.log('        Code:', gen(ifn).substring(0, 150));
                                }
                            });
                        }
                    }
                }
            });
        }
    });
});
