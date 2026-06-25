var fs = require("fs");
var ds1md = fs.readFileSync("ds_script.js","utf8");
var dsFmt = fs.readFileSync("data/ds_v2_6545c_online.js","utf8");

function findBc(t, hdr) {
  var i = t.indexOf("var __$c");
  if (i<0) return {len:0, found:false};
  var start = t.indexOf(hdr, i);
  if (start<0) return {len:0, found:false};
  var end = start;
  while (end < t.length) {
    if ((t[end] === '"' || t[end] === "'") && end > start + 100) {
      var after = t.substring(end+1, end+20).trim();
      if (after.startsWith(";") || after.length < 3) {
        return {len: end - start, found: true, first20: t.substring(start, start+20), last20: t.substring(end-20, end)};
      }
    }
    end++;
  }
  return {len: end - start, found: true};
}

console.log("=== 1.md ds_script (mns0201) ===");
console.log(JSON.stringify(findBc(ds1md, "56544b424251464d00283e")));

console.log("\n=== online formatted ds_v2 ===");
console.log(JSON.stringify(findBc(dsFmt, "56544b424251464d00102a")));

// Also check inline_26_online.js
var inline = fs.readFileSync("data/inline_26_online.js","utf8");
console.log("\n=== inline_26 format ===");
console.log("size:", inline.length);
console.log("has __$c:", inline.indexOf("__$c") >= 0);
