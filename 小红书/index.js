require('./env')
require('./ds_script')
const CryptoJS = require('crypto-js');
 
 
// ==================== Base64 编码（自定义码表）====================
var u = [], m = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
for (var w = 0, C = m.length; w < C; ++w) u[w] = m[w];
 
function tripletToBase64(e) {
    return u[e >> 18 & 63] + u[e >> 12 & 63] + u[e >> 6 & 63] + u[63 & e];
}
 
function encodeChunk(e, a, s) {
    for (var u, m = [], w = a; w < s; w += 3)
        u = (e[w] << 16 & 0xff0000) + (e[w + 1] << 8 & 65280) + (255 & e[w + 2]),
        m.push(tripletToBase64(u));
    return m.join("");
}
 
function b64Encode(e) {
    for (var a, s = e.length, m = s % 3, w = [], C = 16383, R = 0, P = s - m; R < P; R += C)
        w.push(encodeChunk(e, R, R + C > P ? P : R + C));
    return 1 === m ? (a = e[s - 1], w.push(u[a >> 2] + u[a << 4 & 63] + "=="))
        : 2 === m && (a = (e[s - 2] << 8) + e[s - 1], w.push(u[a >> 10] + u[a >> 4 & 63] + u[a << 2 & 63] + "=")),
        w.join("");
}
 
function encodeUtf8(e) {
    for (var a = encodeURIComponent(e), s = [], u = 0; u < a.length; u++) {
        var m = a.charAt(u);
        if ("%" === m) {
            var w = parseInt(a.charAt(u + 1) + a.charAt(u + 2), 16);
            s.push(w);
            u += 2;
        } else
            s.push(m.charCodeAt(0));
    }
    return s;
}
 
// ==================== 签名函数 ====================
function seccore_signv2(e, a) {
    var u = e;
    u += JSON.stringify(a);
    var m = CryptoJS.MD5([u].join("")).toString(),
        w = CryptoJS.MD5(e).toString(),
        C = window.mnsv2(u, m, w),
        P = {
            x0: "4.3.5",
            x1: "xhs-pc-web",
            x2: "Windows",
            x3: C,
            x4: "object"
        };
     
    console.log("\n===== 签名详细输出 =====");
    console.log("C 值 (window.mnsv2 返回值):", C);
    console.log("C 值类型:", typeof C);
    console.log("C 值长度:", C ? C.length : 0);
    console.log("=========================\n");
 
    return "XYS_" + b64Encode(encodeUtf8(JSON.stringify(P)));
}
 
// ==================== 执行签名 ====================
q = "/api/sns/web/v1/homefeed";
//
// w = {
//     "cursor_score": "",
//     "num": 24,
//     "refresh_type": 1,
//     "note_index": 19,
//     "unread_begin_note_id": "",
//     "unread_end_note_id": "",
//     "unread_note_count": 0,
//     "category": "homefeed.cosmetics_v3",
//     "search_key": "",
//     "need_num": 4,
//     "image_formats": ["jpg", "webp", "avif"],
//     "need_filter_image": false
// };
w=process.argv[2]
 
console.log("\n===== 小红书签名结果 =====");
const result = seccore_signv2(q, w);
console.log("X-s:", result);
console.log("===========================\n");

