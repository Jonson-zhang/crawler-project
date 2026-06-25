var fs = require("fs");
var CryptoJS = require("crypto-js");

// Load 1.md env + ds_script
var lines = fs.readFileSync("1.md", "utf8").split("\n");
console.log = function(){}; // silence watch() noise
eval(lines.slice(1642, 2056).join("\n"));
eval(lines.slice(137, 1638).join("\n"));

// Base64 setup
var u = [], m = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
for (var w = 0, C = m.length; w < C; ++w) u[w] = m[w];
function tripletToBase64(e) { return u[e >> 18 & 63] + u[e >> 12 & 63] + u[e >> 6 & 63] + u[63 & e]; }
function encodeChunk(e, a, s) { for (var u, m1 = [], w = a; w < s; w += 3) u = (e[w] << 16 & 0xff0000) + (e[w + 1] << 8 & 65280) + (255 & e[w + 2]), m1.push(tripletToBase64(u)); return m1.join(""); }
function b64Encode(e) { for (var a, s = e.length, m1 = s % 3, w = [], C = 16383, R = 0, P = s - m1; R < P; R += C) w.push(encodeChunk(e, R, R + C > P ? P : R + C)); return 1 === m1 ? (a = e[s - 1], w.push(u[a >> 2] + u[a << 4 & 63] + "==")) : 2 === m1 && (a = (e[s - 2] << 8) + e[s - 1], w.push(u[a >> 10] + u[a >> 4 & 63] + u[a << 2 & 63] + "=")), w.join(""); }
function encodeUtf8(e) { for (var a = encodeURIComponent(e), s = [], u1 = 0; u1 < a.length; u1++) { var m1 = a.charAt(u1); if ("%" === m1) { var w = parseInt(a.charAt(u1 + 1) + a.charAt(u1 + 2), 16); s.push(w); u1 += 2; } else s.push(m1.charCodeAt(0)); } return s; }

function seccore_signv2(e, a) {
    var u1 = e;
    u1 += JSON.stringify(a);
    var m1 = CryptoJS.MD5([u1].join("")).toString(),
        w1 = CryptoJS.MD5(e).toString(),
        C = window.mnsv2(u1, m1, w1),
        P = { x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: C, x4: "object" };
    return "XYS_" + b64Encode(encodeUtf8(JSON.stringify(P)));
}

// Test signing
var url = "/api/sns/web/v1/homefeed";
var body = '{"cursor_score":"","num":5,"refresh_type":1,"note_index":0}';
var x_s = seccore_signv2(url, body);
var x_t = String(Date.now());

process.stdout.write("X-s prefix: " + x_s.substring(0, 50) + "\n");
process.stdout.write("mnsv2 test: " + window.mnsv2("test", "abc123abc123abc123abc123abc123ab", "def456def456def456def456def456de").substring(0, 30) + "\n");

// Make API request
var https = require("https");
var data = JSON.stringify({ cursor_score: "", num: 5, refresh_type: 1, note_index: 0 });
var opts = {
    hostname: "edith.xiaohongshu.com",
    path: url,
    method: "POST",
    headers: {
        "content-type": "application/json;charset=UTF-8",
        "x-s": x_s,
        "x-t": x_t,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "cookie": "a1=19efc525fddhh84dtljig2i1j5qjrx6s8nlhbz1r450000193048; webId=e6582fbb6ae4a5da7604c32658d62cc4; web_session=0400698ff4288f56c204adc809384bd612dec8; abRequestId=c7aefa42-8672-5985-a35f-670c8415e29c; webBuild=6.24.0; xsecappid=xhs-pc-web; gid=yjdiS2JKy2YWyjdiS2J2iIuyffxxY4f91V3k1F4J3yV2Ax28VFCKMD888yjq84Y8yifY2Ydy"
    }
};

var req = https.request(opts, function(r) {
    var d = "";
    r.on("data", function(c) { d += c; });
    r.on("end", function() {
        try {
            var j = JSON.parse(d);
            process.stdout.write("HTTP:" + r.statusCode + " code:" + j.code + " success:" + j.success + " msg:" + (j.msg || "").substring(0, 60) + " notes:" + ((j.data || {}).notes || []).length + "\n");
            var notes = ((j.data || {}).notes || []).slice(0, 3);
            notes.forEach(function(n) {
                var nc = n.note_card || n;
                process.stdout.write("  - " + (nc.display_title || "").substring(0, 60) + "\n");
            });
        } catch (e) {
            process.stdout.write("RAW: " + d.substring(0, 500) + "\n");
        }
    });
});
req.write(data);
req.end();
