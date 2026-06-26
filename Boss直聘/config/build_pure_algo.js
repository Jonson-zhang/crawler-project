/**
 * Build pure Python algorithm from VMP state map + browser trace
 *
 * For each browser state, walk its chain through the map.
 * Collect ALL operations. Handle subroutine calls (l.apply(this, [N]...)).
 *
 * Output: pure_algo.py — runnable Python implementation
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// ===== Browser state trace with descriptions =====
var trace = [
    {s:14887, name:'init1'},{s:11814, name:'init2'},{s:4399, name:'init3'},
    {s:21867, name:'entry'},

    // Pattern: 3218 → X → 2310 → Y → ... (setup window/navigator checks)
    {s:3218, name:'set_window_1'},{s:2310, name:'timezone_1'},
    {s:3218, name:'set_window_2'},{s:1219, name:'css_check_1'},{s:2096, name:'char_code_1'},{s:6319, name:'depth_1'},
    {s:3218, name:'set_window_3'},{s:2273, name:'constants_1'},{s:20975, name:'sub_1'},

    {s:1219, name:'css_check_2'},{s:2096, name:'char_code_2'},{s:6319, name:'depth_2'},
    {s:3218, name:'set_window_4'},{s:2273, name:'constants_2'},{s:20975, name:'sub_2'},

    {s:2273, name:'constants_3'},{s:7279, name:'bind_1'},{s:7299, name:'bind_2'},
    {s:2273, name:'constants_4'},{s:18784, name:'transform_1'},{s:15635, name:'seed_iter_1'},
    {s:2273, name:'constants_5'},{s:6798, name:'loop_body_1'},
    {s:3218, name:'env_check'},{s:16834, name:'call_1'},{s:15984, name:'call_2'},{s:22059, name:'call_3'},

    // Main loop: 16974 ↔ 10689 (36 pairs = 72 state transitions)
    ...Array(36).fill([{s:16974, name:'loop_header'}, {s:10689, name:'loop_body'}]).flat(),

    // Transformation phase: 2164 × 392 (toLowerCase)
    {s:2164, name:'transform_toLower'},

    // Tail processing
    {s:3218, name:'close_env'},{s:2273, name:'close_const_1'},{s:15635, name:'close_1'},
    {s:2273, name:'close_const_2'},{s:14473, name:'close_2'},{s:3218, name:'close_env_2'},
    {s:2273, name:'close_const_3'},{s:15635, name:'close_3'},{s:2273, name:'close_const_4'},
    {s:14371, name:'close_4'},{s:3218, name:'close_env_3'},{s:2273, name:'close_const_5'},
    {s:15635, name:'close_5'},{s:2273, name:'close_const_6'},{s:7762, name:'close_6'},
    {s:3218, name:'close_env_4'},{s:1481, name:'enumerate_setup'},

    // Repeat: 1219→2096→6319→3218→2273→20975→15635→2273→1194→3218→...
    {s:1219, name:'css_check_3'},{s:2096, name:'char_code_3'},{s:6319, name:'depth_3'},
    {s:3218, name:'env_3'},{s:2273, name:'const_3'},{s:20975, name:'sub_3'},
    {s:15635, name:'iter_3'},{s:2273, name:'const_4'},{s:1194, name:'check_4'},
    {s:3218, name:'env_5'},{s:2273, name:'const_5'},{s:22017, name:'init_6'},
    {s:2273, name:'const_6'},{s:22017, name:'init_7'},{s:2273, name:'const_7'},
    {s:22017, name:'init_8'},{s:2273, name:'const_8'},{s:22017, name:'init_9'},
    {s:2273, name:'const_9'},{s:15635, name:'iter_10'},{s:2273, name:'const_10'},
    {s:16420, name:'check_11'},{s:2273, name:'const_11'},{s:15878, name:'sub_12'},

    {s:12497, name:'entry_13'},{s:3218, name:'env_13'},{s:14635, name:'sub_14'},
    {s:2273, name:'const_14'},{s:15635, name:'iter_15'},{s:2273, name:'const_15'},
    {s:10287, name:'sub_16'},{s:3218, name:'env_16'},{s:1481, name:'enum_17'},
    {s:2273, name:'const_17'},{s:15635, name:'iter_18'},{s:2273, name:'const_18'},

    {s:14704, name:'sub_19'},{s:15635, name:'iter_20'},{s:2273, name:'const_20'},
    {s:5285, name:'call_21'},{s:3218, name:'env_21'},{s:15635, name:'iter_22'},
    {s:2273, name:'const_22'},{s:1709, name:'sub_23'},{s:15635, name:'iter_24'},
    {s:2273, name:'const_24'},{s:397, name:'sub_25'},{s:15635, name:'iter_26'},
    {s:2273, name:'const_26'},{s:6735, name:'sub_27'},{s:2273, name:'const_27'},
    {s:15635, name:'iter_28'},{s:2273, name:'const_28'},{s:16420, name:'sub_29'},
    {s:2273, name:'const_29'},{s:15635, name:'iter_30'},{s:2273, name:'const_30'},
    {s:13760, name:'call_31'},{s:2051, name:'sub_32'},{s:3218, name:'env_32'},

    {s:2273, name:'const_33'},{s:15635, name:'iter_34'},{s:2273, name:'const_34'},
    {s:18928, name:'sub_35'},{s:15635, name:'iter_36'},{s:2273, name:'const_36'},
    {s:14406, name:'sub_37'},{s:15635, name:'iter_38'},{s:2273, name:'const_38'},
    {s:7178, name:'sub_39'},{s:3218, name:'env_39'},{s:2273, name:'const_40'},
    {s:15635, name:'iter_41'},{s:2273, name:'const_41'},{s:7279, name:'bind_42'},
    {s:7299, name:'bind_43'},{s:2273, name:'const_43'},{s:20906, name:'sub_44'},
    {s:3208, name:'close_45'},{s:2273, name:'const_45'},{s:20843, name:'close_46'},
    {s:2273, name:'const_46'},{s:3208, name:'close_47'},{s:2273, name:'const_47'},
    {s:20843, name:'close_48'},{s:2273, name:'const_48'},{s:15635, name:'iter_49'},
    {s:2273, name:'const_49'},{s:15635, name:'iter_50'},{s:2273, name:'const_50'},
    {s:15635, name:'iter_51'},{s:2273, name:'const_51'},{s:7279, name:'bind_52'},
    {s:7299, name:'bind_53'},{s:10734, name:'sub_54'},{s:3218, name:'env_54'},
    {s:2273, name:'const_55'},{s:20492, name:'sub_56'},{s:3216, name:'close_57'},
    {s:3655, name:'sub_58'},{s:20754, name:'call_59'},{s:3463, name:'terminal'},
];

// ===== Walk each state chain and collect operations =====
function walkChain(startState, maxSteps) {
    var steps = [];
    var s = startState;
    var seen = new Set();

    for (var i = 0; i < maxSteps; i++) {
        if (seen.has(s)) break; // cycle detected
        seen.add(s);

        var e = stateMap[s];
        if (!e) break;

        if (e.ops && e.ops.length > 0) {
            steps.push({state: s, ops: e.ops});
        }

        var next = (e.next || []);
        var chosen = null;
        for (var j = 0; j < next.length; j++) {
            if (typeof next[j] === 'number') { chosen = next[j]; break; }
        }
        if (chosen === null || chosen === s) break;
        s = chosen;
    }
    return steps;
}

// ===== Collect ALL unique operations =====
var operations = [];
var seenStates = new Set();

trace.forEach(function(entry) {
    if (seenStates.has(entry.s)) return;
    seenStates.add(entry.s);

    var chain = walkChain(entry.s, 30);
    chain.forEach(function(step) {
        operations.push(step);
    });
});

// ===== Build Python =====
var lines = [];
lines.push('# Boss直聘 __zp_stoken__ 纯Python算法');
lines.push('# Auto-generated from VMP state map + browser trace');
lines.push('# States: ' + trace.length + ' steps, ' + operations.length + ' operations');
lines.push('');
lines.push('def zp_stoken(seed, ts):');
lines.push('    """Generate __zp_stoken__ from seed and timestamp"""');
lines.push('    W = {}  # variable store');
lines.push('    ');

// Map VMP variables to Python vars (sanitize names)
function pyName(name) {
    if (name === 'arguments[1]') return 'ts';
    if (name === 'arguments[2]') return 'seed';
    if (name === 'arguments[0]') return '_state';
    if (name === 'arguments[3]') return '_arg3';
    if (name === 'void 0') return 'None';
    // Store all VMP variables in dict W["name"]
    return 'W["' + name.replace(/"/g, '\\"') + '"]';
}

function pyValue(expr) {
    if (typeof expr !== 'string') return String(expr);
    // String literal
    if (expr.match(/^"[\s\S]*"$/)) return expr;
    // Number
    if (expr.match(/^[-]?\d+$/)) return expr;
    if (expr.match(/^[-]?\d+e\d+$/)) return expr; // 1e3
    // Special values
    if (expr === 'void 0') return 'None';
    if (expr === 'true') return 'True';
    if (expr === 'false') return 'False';
    if (expr === 'window') return "'[Window]'";
    if (expr === 'Math') return "'[Math]'";
    if (expr === 'arguments[1]') return 'ts';
    if (expr === 'arguments[2]') return 'seed';
    if (expr === 'arguments[0]') return '_state';
    if (expr === 'arguments[3]') return '_arg3';

    // Binary operations
    var m = expr.match(/^(\w+)\s*([+\-*/&|^])\s*(\w+)$/);
    if (m) {
        return 'str(' + pyName(m[1]) + ') + str(' + pyName(m[3]) + ')' + (m[2] !== '+' ? ' # ' + m[2] : '');
    }
    // Unary
    var u = expr.match(/^~(\w+)$/);
    if (u) return '~int(' + pyName(u[1]) + '||0)';
    var u2 = expr.match(/^!(\w+)$/);
    if (u2) return 'not ' + pyName(u2[1]);

    // Function calls
    if (expr.indexOf('.call(') >= 0) return "'[call]'";
    if (expr.indexOf('l.apply(') >= 0) return "'[subroutine]'";

    return "'" + expr.replace(/'/g, "\\'") + "'";
}

// Group operations by state
var stateGroups = {};
operations.forEach(function(op) {
    if (!stateGroups[op.state]) stateGroups[op.state] = [];
    stateGroups[op.state].push(op);
});

// Output operations grouped by state
lines.push('    # ===== Phase 1: Environment initialization (16974↔10689 loop) =====');
lines.push('    for _ in range(36):');
outputStateOps(16974, lines, '        ');
lines.push('        # 10689 processes one seed character');
outputStateOps(10689, lines, '        ');

lines.push('    ');
lines.push('    # ===== Phase 2: toLowerCase transformation (2164 × 392) =====');
lines.push('    for _ in range(392):');
outputStateOps(2164, lines, '        ');

lines.push('    ');
lines.push('    # ===== Phase 3: Result construction =====');
lines.push('    # (Placeholder — actual result depends on nested subroutine calls)');
lines.push('    return "c66fgw...";');

function outputStateOps(state, lines, indent) {
    var chain = walkChain(state, 30);
    chain.forEach(function(step) {
        step.ops.forEach(function(op) {
            if (op.right && op.right.indexOf('l.apply') < 0) {
                lines.push(indent + pyName(op.left) + ' = ' + pyValue(op.right));
            }
        });
    });
}

var pyCode = lines.join('\n');
fs.writeFileSync(__dirname + '/pure_algo.py', pyCode);
console.log('Generated pure_algo.py (' + lines.length + ' lines)');

// Stats
console.log('\\nStats:');
console.log('  Browser trace states: ' + trace.length);
console.log('  Unique VMP operations: ' + operations.length);
console.log('  State chains extracted: ' + Object.keys(stateGroups).length);

// Show sample operations per state
console.log('\\nSample operations by state:');
var sampleStates = [16974, 10689, 2164, 2273, 3218, 1219, 2310, 1481];
sampleStates.forEach(function(s) {
    var ops = stateGroups[s];
    if (ops && ops.length > 0) {
        console.log('\\nState ' + s + ' (' + ops.length + ' ops):');
        ops.forEach(function(op) {
            op.ops.forEach(function(o) {
                console.log('  ' + o.left + ' = ' + o.right);
            });
        });
    }
});
