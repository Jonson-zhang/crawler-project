var fs = require("fs");
var origLog = console.log;
console.log = function(){};

var lines = fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642, 2056).join("\n"));
origLog("env ok");

var oB = Function.prototype.bind, oA = Function.prototype.apply;
Function.prototype.bind = function(ctx){
  if(typeof this !== "function") return function(){};
  try { return oB.apply(this, arguments); } catch(e) { return function(){}; }
};
Function.prototype.apply = function(ctx, args){
  if(typeof this !== "function") return undefined;
  try { return oA.call(this, ctx, args || []); } catch(e) { return undefined; }
};

eval(fs.readFileSync("data/fp_raw.js","utf8"));
eval(fs.readFileSync("data/ds_api_raw.js","utf8"));
origLog("fp+api ok");

// HYBRID: 1.md VMP interpreter + online bytecode
var ds1md = lines.slice(137, 1638).join("\n");
var onlineBc = fs.readFileSync("data/online_bc.txt","utf8");

// 1.md bytecode: var __$c = '56544b...378760...';  (233K chars, single-quoted)
var si = ds1md.indexOf("var __$c = ");
var bcStart = ds1md.indexOf("56544b424251464d00283e", si);
var bcEnd = ds1md.indexOf("';", bcStart);  // ends with single-quote-semicolon
if (bcEnd < 0) bcEnd = ds1md.indexOf("\";", bcStart);
if (bcEnd < 0) bcEnd = ds1md.lastIndexOf("';"); // fallback
origLog("1.md bc:", "start=" + bcStart, "end=" + bcEnd, "len=" + (bcEnd - bcStart));

var hybrid = ds1md.substring(0, bcStart) + onlineBc + ds1md.substring(bcEnd);
origLog("hybrid:", hybrid.length, "changed:", hybrid !== ds1md);

// Proxy env array fix: wrap init call to fill missing env slots
var initCall = "glb[\"_AUuXfEG27Xa3x\"](__$c,";
var initIdx = hybrid.indexOf(initCall);
var arrStart = hybrid.indexOf("[", initIdx);
var arrEnd = hybrid.indexOf("]);", arrStart);
if (arrEnd > arrStart) {
  var envStr = hybrid.substring(arrStart + 1, arrEnd).trim();
  var before = hybrid.substring(0, arrStart);
  var after = hybrid.substring(arrEnd + 2);
  var newCode = "var __envArr=[" + envStr + "];" +
    "for(var __i=0;__i<200;__i++)if(__envArr[__i]===undefined){" +
      "__envArr[__i]=function(){this.name=\"stub_\"+__i;};" +
    "}" +
    "glb[\"_AUuXfEG27Xa3x\"](__$c, __envArr)";
  hybrid = before + newCode + after;
  origLog("env replaced, new len:", hybrid.length);
} else {
  origLog("env replace FAILED, initIdx:", initIdx, "arrEnd:", arrEnd);
}

try {
  eval(hybrid);
  origLog("HYBRID ok, mnsv2:", typeof mnsv2);
  if (typeof mnsv2 === "function") {
    var r = mnsv2("test","abc123abc123abc123abc123abc123ab","def456def456def456def456def456de");
    origLog("RESULT:", r ? r.substring(0, 45) : "null");
    origLog("mns0301:", String(r).startsWith("mns0301"));
    origLog("mns0201:", String(r).startsWith("mns0201"));
  }
} catch(e) {
  origLog("HYBRID ERR:", e.message.substring(0, 200));
  var stk = (e.stack||"").split("\n").slice(0, 4);
  stk.forEach(function(l){ origLog("  " + l.trim().substring(0, 150)); });
}

Function.prototype.bind = oB;
Function.prototype.apply = oA;
