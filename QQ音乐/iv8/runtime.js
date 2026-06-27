!(function (e) {
  function t(t) {
    for (var a, n, d = t[0], c = t[1], i = t[2], l = 0, s = []; l < d.length; l++)
      ((n = d[l]), Object.prototype.hasOwnProperty.call(o, n) && o[n] && s.push(o[n][0]), (o[n] = 0));
    for (a in c) Object.prototype.hasOwnProperty.call(c, a) && (e[a] = c[a]);
    for (b && b(t); s.length; ) s.shift()();
    return (f.push.apply(f, i || []), r());
  }
  function r() {
    for (var e, t = 0; t < f.length; t++) {
      for (var r = f[t], a = !0, n = 1; n < r.length; n++) {
        var c = r[n];
        0 !== o[c] && (a = !1);
      }
      a && (f.splice(t--, 1), (e = d((d.s = r[0]))));
    }
    return e;
  }
  var a = {},
    n = { 23: 0 },
    o = { 23: 0 },
    f = [];
  function d(t) {
    if (!e[t]) { console.error('[STUB] Missing webpack module:', t, '- returning empty stub'); return {}; }
    if (a[t]) return a[t].exports;
    var r = (a[t] = { i: t, l: !1, exports: {} });
    return (e[t].call(r.exports, r, r.exports, d), (r.l = !0), r.exports);
  }
  ((d.e = function (e) {
    var t = [];
    n[e]
      ? t.push(n[e])
      : 0 !== n[e] &&
        {
          1: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
          10: 1,
          11: 1,
          12: 1,
          13: 1,
          14: 1,
          15: 1,
          16: 1,
          17: 1,
          18: 1,
          19: 1,
          20: 1,
          21: 1,
          22: 1,
          24: 1,
          25: 1,
          26: 1,
          27: 1,
          28: 1,
        }[e] &&
        t.push(
          (n[e] = new Promise(function (t, r) {
            for (
              var a =
                  "css/" +
                  ({
                    1: "common",
                    3: "album",
                    4: "albumDetail",
                    5: "album_mall",
                    6: "category",
                    7: "cmtpage",
                    8: "download_detail",
                    9: "index",
                    10: "msg_center",
                    11: "mv",
                    12: "mvList",
                    13: "mv_toplist",
                    14: "notfound",
                    15: "player",
                    16: "player_radio",
                    17: "playlist",
                    18: "playlist_edit",
                    19: "profile",
                    20: "putao_store",
                    21: "qqmusic_skills",
                    22: "radio",
                    24: "search",
                    25: "singer",
                    26: "singer_list",
                    27: "songDetail",
                    28: "toplist",
                  }[e] || e) +
                  "." +
                  {
                    1: "64dc5ff3b6abe6d95769",
                    3: "5cf0d69eaf29bcab23d2",
                    4: "798353db5b0eb05d5358",
                    5: "df4c243f917604263e58",
                    6: "20d532d798099a44bc88",
                    7: "e3bedf2b5810f8db0684",
                    8: "97dcff32a4f360d398bc",
                    9: "7a0372154752bda76bd4",
                    10: "020422608fe8bfb1719a",
                    11: "8bdb1df6c5436b790baa",
                    12: "47ce9300786df1b70584",
                    13: "4aee33230ba2d6b81dce",
                    14: "e6f63b0cf57dd029fbd6",
                    15: "662de90eaaf6404101dd",
                    16: "d893492de07ce97d8048",
                    17: "9484fde660fe93d9f9f0",
                    18: "67fb85e7f96455763c83",
                    19: "de1a1f4f35ff76dd018e",
                    20: "19180bc6a9878c8971e4",
                    21: "cca66877b58dd9f30709",
                    22: "3befd83c10b19893ec66",
                    24: "b2d11f89ea6a512a2302",
                    25: "c7a38353c5f4ebb47491",
                    26: "96c0e73e083c3abb967e",
                    27: "4c080567e394fd45608b",
                    28: "8edb142553f97482e00f",
                  }[e] +
                  ".chunk.css?max_age=2592000",
                o = d.p + a,
                f = document.getElementsByTagName("link"),
                c = 0;
              c < f.length;
              c++
            ) {
              var i = (b = f[c]).getAttribute("data-href") || b.getAttribute("href");
              if ("stylesheet" === b.rel && (i === a || i === o)) return t();
            }
            var l = document.getElementsByTagName("style");
            for (c = 0; c < l.length; c++) {
              var b;
              if ((i = (b = l[c]).getAttribute("data-href")) === a || i === o) return t();
            }
            var s = document.createElement("link");
            ((s.rel = "stylesheet"),
              (s.type = "text/css"),
              (s.onload = t),
              (s.onerror = function (t) {
                var a = (t && t.target && t.target.src) || o,
                  f = new Error("Loading CSS chunk " + e + " failed.\n(" + a + ")");
                ((f.code = "CSS_CHUNK_LOAD_FAILED"), (f.request = a), delete n[e], s.parentNode.removeChild(s), r(f));
              }),
              (s.href = o),
              0 !== s.href.indexOf(window.location.origin + "/") && (s.crossOrigin = "anonymous"),
              document.getElementsByTagName("head")[0].appendChild(s));
          }).then(function () {
            n[e] = 0;
          })),
        );
    var r = o[e];
    if (0 !== r)
      if (r) t.push(r[2]);
      else {
        var a = new Promise(function (t, a) {
          r = o[e] = [t, a];
        });
        t.push((r[2] = a));
        var f,
          c = document.createElement("script");
        ((c.charset = "utf-8"),
          (c.timeout = 120),
          d.nc && c.setAttribute("nonce", d.nc),
          (c.src = (function (e) {
            return (
              d.p +
              "js/" +
              ({
                1: "common",
                3: "album",
                4: "albumDetail",
                5: "album_mall",
                6: "category",
                7: "cmtpage",
                8: "download_detail",
                9: "index",
                10: "msg_center",
                11: "mv",
                12: "mvList",
                13: "mv_toplist",
                14: "notfound",
                15: "player",
                16: "player_radio",
                17: "playlist",
                18: "playlist_edit",
                19: "profile",
                20: "putao_store",
                21: "qqmusic_skills",
                22: "radio",
                24: "search",
                25: "singer",
                26: "singer_list",
                27: "songDetail",
                28: "toplist",
              }[e] || e) +
              ".chunk." +
              {
                1: "cf0b8c39b26ec1ef4097",
                3: "a767324aebece8c24b44",
                4: "a650f7bf51f249f444b5",
                5: "711e8ffd7a50ea82b73a",
                6: "e3dd9bc0b18fa621726d",
                7: "e268359c144109496f43",
                8: "2b4f5631869cb2a557d2",
                9: "790dded2150906eee369",
                10: "5434011f5e3324a28dc9",
                11: "7f77e1f721b76e58bbe9",
                12: "4836d4bae051b7f37646",
                13: "41dc9f930f0d9c1a5eb5",
                14: "06f0b02f27123e7f72ef",
                15: "e0c0b98ed6b82987f4d8",
                16: "3286a9c0a4695594304c",
                17: "331ad28f0fe98b3dbfc3",
                18: "e0c1026159e095223bd4",
                19: "3a536e98455a1e0a9b8d",
                20: "ff37f9aec036018848e3",
                21: "21e540ad2455fdd706ed",
                22: "c6b155a500443c74b113",
                24: "764118ff4c935aa619e3",
                25: "e319dccb62faf067df41",
                26: "bdc270d991e578b50b95",
                27: "ffa3be96be5e90f5bf9c",
                28: "f60e6591b7a007921ff3",
              }[e] +
              ".js?max_age=2592000"
            );
          })(e)),
          0 !== c.src.indexOf(window.location.origin + "/") && (c.crossOrigin = "anonymous"));
        var i = new Error();
        f = function (t) {
          ((c.onerror = c.onload = null), clearTimeout(l));
          var r = o[e];
          if (0 !== r) {
            if (r) {
              var a = t && ("load" === t.type ? "missing" : t.type),
                n = t && t.target && t.target.src;
              ((i.message = "Loading chunk " + e + " failed.\n(" + a + ": " + n + ")"),
                (i.name = "ChunkLoadError"),
                (i.type = a),
                (i.request = n),
                r[1](i));
            }
            o[e] = void 0;
          }
        };
        var l = setTimeout(function () {
          f({ type: "timeout", target: c });
        }, 12e4);
        ((c.onerror = c.onload = f), document.head.appendChild(c));
      }
    return Promise.all(t);
  }),
    (d.m = e),
    (d.c = a),
    (d.d = function (e, t, r) {
      d.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: r });
    }),
    (d.r = function (e) {
      ("undefined" !== typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
        Object.defineProperty(e, "__esModule", { value: !0 }));
    }),
    (d.t = function (e, t) {
      if ((1 & t && (e = d(e)), 8 & t)) return e;
      if (4 & t && "object" === typeof e && e && e.__esModule) return e;
      var r = Object.create(null);
      if ((d.r(r), Object.defineProperty(r, "default", { enumerable: !0, value: e }), 2 & t && "string" != typeof e))
        for (var a in e)
          d.d(
            r,
            a,
            function (t) {
              return e[t];
            }.bind(null, a),
          );
      return r;
    }),
    (d.n = function (e) {
      var t =
        e && e.__esModule
          ? function () {
              return e.default;
            }
          : function () {
              return e;
            };
      return (d.d(t, "a", t), t);
    }),
    (d.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    }),
    (d.p = "/ryqq/"),
    // Patch d.e to prevent dynamic chunk loading in Node.js
    (d.e = function() { return Promise.resolve(); }),
    (window.__webpack_require__ = d),
    (globalThis.__wp = d),
    (d.oe = function (e) {
      throw e;
    }));
  var c = (window.webpackJsonp = window.webpackJsonp || []),
    i = c.push.bind(c);
  ((c.push = t), (c = c.slice()));
  for (var l = 0; l < c.length; l++) t(c[l]);
  var b = i;
  r();
})([]);
