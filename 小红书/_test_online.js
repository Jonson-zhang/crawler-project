var fs = require("fs");
var origLog = console.log;
console.log = function(){};

// Step 1: 1.md env
var lines = fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642, 2056).join("\n"));
origLog("env ok");

// Step 2: Fix bind/apply for FP
var oB = Function.prototype.bind, oA = Function.prototype.apply;
Function.prototype.bind = function(ctx){
  if(typeof this !== "function") return function(){};
  try { return oB.apply(this, arguments); } catch(e) { return function(){}; }
};
Function.prototype.apply = function(ctx, args){
  if(typeof this !== "function") return undefined;
  try { return oA.call(this, ctx, args || []); } catch(e) { return undefined; }
};

// Step 3: Load FP
eval(fs.readFileSync("data/fp_raw.js","utf8"));
origLog("fp ok");

// Step 4: Load ds_api
eval(fs.readFileSync("data/ds_api_raw.js","utf8"));
origLog("api ok");

// Step 5: Load ONLINE ds_v2 (formatted, with __$c bytecode)
var dsOnline = fs.readFileSync("data/ds_v2_6545c_online.js","utf8");

// Modify the init call: make env array Proxy-based with auto-fill stubs
var patched = dsOnline.replace(
  /glb\["_AUuXfEG27Xa3x"\]\(__\$c,\s*\[([\s\S]*?)\]\)/,
  function(m, envStr) {
    return "var __envArr = [" + envStr + "];" +
      "for(var __i=0;__i<200;__i++)if(__envArr[__i]===undefined){" +
        "__envArr[__i]=function(){this.name='stub_'+__i;};" +
      "}" +
      "glb['_AUuXfEG27Xa3x'](__$c, __envArr)";
  }
);

origLog("patched len:", patched.length, "replaced:", patched !== dsOnline);

try {
  eval(patched);
  origLog("ds_v2 online ok");
} catch(e) {
  origLog("ds_v2 ERR:", e.message.substring(0, 200));
  // Show stack
  var stk = (e.stack||"").split("\n").slice(0, 4);
  stk.forEach(function(l){ origLog("  " + l.trim().substring(0, 150)); });
}

Function.prototype.bind = oB;
Function.prototype.apply = oA;

origLog("mnsv2:", typeof mnsv2);

if (typeof mnsv2 === "function") {
  try {
    var r = mnsv2("test", "abc123abc123abc123abc123abc123ab", "def456def456def456def456def456de");
    origLog("RESULT:", r ? r.substring(0, 40) : "null");
    origLog("mns0301:", r ? String(r).startsWith("mns0301") : false);
    origLog("mns0201:", r ? String(r).startsWith("mns0201") : false);
  } catch(e) {
    origLog("mnsv2 call ERR:", e.message.substring(0, 150));
  }
}
