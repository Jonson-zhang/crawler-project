var fs = require("fs");
var origLog = console.log; console.log = function(){};

// Extract bytecodes
var ds1md = fs.readFileSync("ds_1md.js","utf8");
var dsOnline = fs.readFileSync("ds_v2_raw.js","utf8");

// Find bytecode boundaries
var hdr1 = "56544b424251464d00283e";
var hdr2 = "56544b424251464d00102a";

var start1 = ds1md.indexOf(hdr1);
var start2 = dsOnline.indexOf(hdr2);

origLog("1.md bc start:", start1, "total len:", ds1md.length);
origLog("online bc start:", start2, "total len:", dsOnline.length);

// Extract bytecodes
function getBytecodeEnd(txt, start) {
  for (var i = start; i < txt.length; i++) {
    if (txt[i] === "'") {
      var after = txt.substring(i+1, i+20).trim();
      if (after.startsWith(";var") || after.startsWith(";") || after.startsWith("var glb") || after.length < 3) {
        return i;
      }
    }
  }
  return -1;
}

var end1 = getBytecodeEnd(ds1md, start1);
var end2 = getBytecodeEnd(dsOnline, start2);
origLog("bc1: " + start1 + "-" + end1 + " = " + (end1 - start1) + " chars");
origLog("bc2: " + start2 + "-" + end2 + " = " + (end2 - start2) + " chars");

if (end1 < 0 || end2 < 0) { origLog("Could not find bytecode end"); process.exit(1); }

var bc1 = ds1md.substring(start1, end1);
var bc2 = dsOnline.substring(start2, end2);

// Create hybrid
var hybrid = ds1md.replace(bc1, bc2);
origLog("hybrid replaced: " + (hybrid !== ds1md) + " size: " + hybrid.length);

// Load env from 1.md
var lines = fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642, 2056).join("\n"));

// Fix bind/apply
var oB = Function.prototype.bind, oA = Function.prototype.apply;
Function.prototype.bind = function(ctx) {
  if (typeof this !== "function") return function(){};
  try { return oB.apply(this, arguments); } catch(e) { return function(){}; }
};
Function.prototype.apply = function(ctx, args) {
  if (typeof this !== "function") return undefined;
  try { return oA.call(this, ctx, args || []); } catch(e) { return undefined; }
};

// Load FP + ds_api
eval(fs.readFileSync("data/fp_raw.js","utf8"));
eval(fs.readFileSync("data/ds_api_raw.js","utf8"));

// Load hybrid
try {
  eval(hybrid);
  origLog("HYBRID LOADED OK");
} catch(e) {
  origLog("HYBRID ERR: " + e.message.substring(0, 200));
}

Function.prototype.bind = oB;
Function.prototype.apply = oA;

if (typeof mnsv2 === "function") {
  var r = mnsv2("test","abc123abc123abc123abc123abc123ab","def456def456def456def456def456de");
  origLog("PREFIX: " + r.substring(0,35) + " 0301:" + r.startsWith("mns0301") + " 0201:" + r.startsWith("mns0201"));
} else {
  origLog("mnsv2 NOT FOUND: " + typeof mnsv2);
}
