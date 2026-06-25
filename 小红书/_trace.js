// 断点溯源：用1.md能跑的env+ds为基础，替换成在线__$c bytecode
var fs = require("fs");
var origLog = console.log; console.log = function(){};

// Step 1: 1.md env (verified working)
var lines = fs.readFileSync("1.md", "utf8").split("\n");
eval(lines.slice(1642, 2056).join("\n"));
origLog("[1] 1.md env loaded");

// Step 2: Load FP + ds_api (provides VMP runtime)
var oB = Function.prototype.bind, oA = Function.prototype.apply;
Function.prototype.bind = function(ctx){if(typeof this!=="function")return function(){};try{return oB.apply(this,arguments);}catch(e){return function(){}};};
Function.prototype.apply = function(ctx,args){if(typeof this!=="function")return undefined;try{return oA.call(this,ctx,args||[]);}catch(e){return undefined};};

try { eval(fs.readFileSync("data/fp_raw.js","utf8")); origLog("[2] FP loaded"); }
catch(e) { origLog("[2] FP ERR: " + e.message.substring(0,100)); }

try { eval(fs.readFileSync("data/ds_api_raw.js","utf8")); origLog("[3] ds_api loaded"); }
catch(e) { origLog("[3] ds_api ERR: " + e.message.substring(0,100)); }

// Step 3: Intercept _AUuXfEG27Xa3x to log env accesses
var realAu = undefined;
var accessLog = [];
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function(){ return realAu; },
  set: function(fn){
    if (typeof fn === "function") {
      // Wrap env array with Proxy to log accesses
      realAu = function(bytecode, envArr) {
        // Proxy the env array to log what indices are accessed
        var logged = {};
        var envProxy = new Proxy(envArr, {
          get: function(t, p) {
            var v = t[p];
            if (v === undefined) {
              if (!logged[p]) { logged[p]=true; origLog("  ENV["+p+"] MISSING"); }
              // Return a constructor stub
              var stub = function(){ this.name = "env_"+p; };
              t[p] = stub;
              return stub;
            }
            return v;
          }
        });
        origLog("[4] _AUuXfEG27Xa3x called, bc len=" + bytecode.length + ", env len=" + envArr.length);
        var result = fn.call(this, bytecode, envProxy);
        origLog("[4] VMP init done");
        return result;
      };
    }
  },
  configurable: true, enumerable: true
});
origLog("[3] _AUuXfEG27Xa3x hook set");

// Step 4: Load 1.md ds_script with ONLINE __$c bytecode swapped in
var ds1md = lines.slice(137, 1638).join("\n");
var onlineBc = fs.readFileSync("data/online_bc.txt", "utf8");

// Replace bytecode: 1.md's __$c (233K) -> online __$c (7.5K)
var bcStart = ds1md.indexOf("56544b424251464d00283e");
var bcEnd = ds1md.indexOf("';", bcStart);
if (bcEnd < 0) bcEnd = ds1md.indexOf("\";", bcStart);
if (bcEnd < 0) bcEnd = ds1md.lastIndexOf("';");
origLog("[4] 1.md bc: start=" + bcStart + " end=" + bcEnd + " len=" + (bcEnd-bcStart));

var hybrid = ds1md.substring(0, bcStart) + onlineBc + ds1md.substring(bcEnd);
origLog("[4] hybrid built: " + hybrid.length + " chars, changed=" + (hybrid !== ds1md));

try {
  eval(hybrid);
  origLog("[4] hybrid eval OK");
} catch(e) {
  origLog("[4] hybrid ERR: " + e.message.substring(0,200));
  var stk = (e.stack||"").split("\n").filter(function(l){return l.indexOf("at ")>-1;}).slice(0,5);
  stk.forEach(function(l){ origLog("  " + l.trim().substring(0,150)); });
  Function.prototype.bind=oB; Function.prototype.apply=oA;
  origLog("mnsv2: " + typeof mnsv2);
  process.exit(1);
}

Function.prototype.bind = oB;
Function.prototype.apply = oA;

// Step 5: Check result
origLog("=== RESULT ===");
origLog("mnsv2: " + typeof mnsv2);
if (typeof mnsv2 === "function") {
  var r = mnsv2("test","abc123abc123abc123abc123abc123ab","def456def456def456def456def456de");
  origLog("prefix: " + (r||"").substring(0,40));
  origLog("mns0301: " + String(r||"").startsWith("mns0301"));
  origLog("mns0201: " + String(r||"").startsWith("mns0201"));
  origLog("total len: " + String(r||"").length);
}
