/**
 * Inject VMP state tracing into security-11f5a2fc.js
 * Logs every state transition (p → Cbl.Ebl.Rbl) during execution
 *
 * Modifies: adds console.log at every 'p = N' assignment to trace flow
 */
var parser = require('@babel/parser');
var traverse = require('@babel/traverse').default;
var t = require('@babel/types');
var generator = require('@babel/generator').default;
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK,', code.length, 'bytes');

var injectionCount = 0;

traverse(ast, {
    // Find all p = <number> assignments inside function l()
    AssignmentExpression: function(path) {
        var node = path.node;
        if (!t.isIdentifier(node.left) || node.left.name !== 'p') return;
        if (!t.isNumericLiteral(node.right)) return;

        var parent = path.parent;
        var parentParent = path.parentPath ? path.parentPath.node : null;

        // Only inject if inside l() function (not MD5 module)
        var ancestor = path.parentPath;
        var insideL = false;
        while (ancestor) {
            if (ancestor.node && ancestor.node.type === 'FunctionDeclaration' &&
                ancestor.node.id && ancestor.node.id.name === 'l') {
                insideL = true;
                break;
            }
            ancestor = ancestor.parentPath;
        }
        if (!insideL) return;

        var nextP = node.right.value;

        // Replace: p = N  →  (console.log("VMP:"+N), p = N)
        if (t.isExpressionStatement(parent)) {
            var logCall = t.callExpression(
                t.memberExpression(t.identifier('console'), t.identifier('log')),
                [t.binaryExpression('+', t.stringLiteral('VMP:'), t.numericLiteral(nextP))]
            );
            var assignExpr = t.assignmentExpression('=', t.identifier('p'), t.numericLiteral(nextP));
            var seqExpr = t.sequenceExpression([logCall, assignExpr]);
            path.parentPath.replaceWith(t.expressionStatement(seqExpr));
            injectionCount++;
        }

        // Also handle: (op, p = N) → (op, console.log("VMP:"+N), p = N)
        if (t.isSequenceExpression(parent)) {
            var exprs = parent.expressions;
            // Find which index has the p=N assignment
            for (var i = 0; i < exprs.length; i++) {
                if (exprs[i] === node) {
                    var logCall = t.callExpression(
                        t.memberExpression(t.identifier('console'), t.identifier('log')),
                        [t.binaryExpression('+', t.stringLiteral('VMP:'), t.numericLiteral(nextP))]
                    );
                    exprs.splice(i, 0, logCall);
                    injectionCount++;
                    break;
                }
            }
        }
    }
});

var output = generator(ast).code;
fs.writeFileSync(__dirname + '/security-traced-2026.js', output);
console.log('Injected', injectionCount, 'trace points');
console.log('Output:', output.length, 'bytes → security-traced-2026.js');
