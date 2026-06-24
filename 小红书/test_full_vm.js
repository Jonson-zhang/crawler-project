#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DATA_DIR = path.join(__dirname, 'data');
const noop = () => {};

class CanvasRenderingContext2D {
  constructor() { this.canvas = null; }
  getImageData() { return { data: new Uint8Array(4), width: 1, height: 1 }; }
  putImageData() {} fillRect() {} fillText() {} strokeText() {}
  measureText(t) { return { width: t.length * 8 }; }
  clearRect() {} beginPath() {} closePath() {} stroke() {} fill() {}
  moveTo() {} lineTo() {} arc() {} save() {} restore() {} scale() {} rotate() {}
  translate() {} transform() {} setTransform() {} drawImage() {}
  createLinearGradient() { return { addColorStop: noop }; }
  createRadialGradient() { return { addColorStop: noop }; }
  createPattern() { return null; }
  get font() { return '10px sans-serif'; } set font(v) {}
  get fillStyle() { return '#000000'; } set fillStyle(v) {}
  get strokeStyle() { return '#000000'; } set strokeStyle(v) {}
  get lineWidth() { return 1; } set lineWidth(v) {}
  get globalAlpha() { return 1; } set globalAlpha(v) {}
  get globalCompositeOperation() { return 'source-over'; } set globalCompositeOperation(v) {}
}

class HTMLCanvasElement {
  constructor() { this.width = 300; this.height = 150; }
  getContext(t) { return t === '2d' ? new CanvasRenderingContext2D() : null; }
  toDataURL() { return 'data:image/png;base64,'; }
}

function mkSandbox() {
  const s = {window:{},self:{},global:{},
    document:{cookie:'',createElement(tag){return tag==='canvas'?new HTMLCanvasElement():{};},querySelector:()=>null,getElementsByTagName:()=>[],addEventListener:noop,removeEventListener:noop,head:{appendChild:noop},body:{appendChild:noop},documentElement:{style:{}}},
    location:{href:'https://www.xiaohongshu.com/explore',host:'www.xiaohongshu.com',hostname:'www.xiaohongshu.com',protocol:'https:',origin:'https://www.xiaohongshu.com',pathname:'/explore'},
    navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',platform:'Win32',webdriver:false,plugins:[],languages:['zh-CN'],language:'zh-CN'},
    screen:{width:1920,height:1080,colorDepth:24,pixelDepth:24},
    history:{length:1,state:null,pushState:noop,replaceState:noop},
    console:{log:()=>{},error:()=>{},warn:()=>{},info:()=>{},debug:()=>{}},
    performance:{now:()=>Date.now(),timing:{navigationStart:Date.now()-1000}},
    setTimeout:(fn,ms,...a)=>{fn(...a);return 0;},setInterval:()=>0,clearTimeout:noop,clearInterval:noop,
    TextEncoder,TextDecoder,URL,URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'),btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent,decodeURIComponent,
    Blob:class{constructor(p){}},fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Headers:class{constructor(h){this._h=h||{};}set(k,v){this._h[k]=v;}get(k){return this._h[k];}},
    XMLHttpRequest:(()=>{function XHR(){this.readyState=0;this.status=0;this.responseText='';this._headers={};}XHR.prototype.open=function(m,u){this._method=m;this._url=u;this.readyState=1;};XHR.prototype.setRequestHeader=function(k,v){this._headers[k]=v;};XHR.prototype.send=function(){this.readyState=4;this.status=200;this.responseText='{}';if(this.onreadystatechange)this.onreadystatechange();};return XHR;})(),
    crypto:require('crypto').webcrypto,
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    parseInt,parseFloat,isNaN,isFinite,JSON,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,eval,
    AudioContext:class{constructor(){this.sampleRate=44100;this.destination={};}createOscillator(){return{connect:noop,start:noop,stop:noop,type:'sine',frequency:{value:440}};}close(){}},
    HTMLCanvasElement,CanvasRenderingContext2D,
    OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;}getContext(t){return new CanvasRenderingContext2D();}},
    Event:class{constructor(type){this.type=type;}},
    MessageChannel:class{constructor(){this.port1={postMessage:noop,onmessage:null,close:noop};this.port2={postMessage:noop,onmessage:null,close:noop};}},
    MutationObserver:class{constructor(fn){}observe(){}disconnect(){}},
    IntersectionObserver:class{constructor(fn){}observe(){}unobserve(){}disconnect(){}},
    PerformanceObserver:class{constructor(fn){}observe(){}disconnect(){}},
    Worker:class{constructor(){}postMessage(){}terminate(){}},
    WebSocket:class{constructor(){}send(){}close(){}},
    Image:class{constructor(){this.src='';this.onload=null;this.onerror=null;}},
    localStorage:{_data:{},getItem(k){return this._data[k]||null;},setItem(k,v){this._data[k]=String(v);},removeItem(k){delete this._data[k];},clear(){this._data={};},get length(){return Object.keys(this._data).length;},key(i){return Object.keys(this._data)[i];}},
    sessionStorage:{_data:{},getItem(k){return this._data[k]||null;},setItem(k,v){this._data[k]=String(v);},removeItem(k){delete this._data[k];},clear(){this._data={};},get length(){return Object.keys(this._data).length;},key(i){return Object.keys(this._data)[i];}},
    Symbol:Symbol,
  };
  s.self=s;s.window=s;s.global=s;s.document.location=s.location;
  s.require=function(id){if(id==='@lwjjike/xbsdom')return undefined;return require(id);};
  return s;
}

const sandbox = mkSandbox();
const ctx = vm.createContext(sandbox);

// Load in the correct order
const files = [
  { name: 'ds_api.js', timeout: 60000 },
  { name: 'ds_6545c.js', timeout: 60000 },
  { name: 'vendor_6f49.js', timeout: 120000 },
  { name: 'vendor-dynamic.js', timeout: 180000 },
  { name: 'bf7d4e.js', timeout: 30000 },
  { name: 'index_46f7b.js', timeout: 180000 },
  { name: 'signer_04b29_formatted.js', timeout: 180000 },
];

let success = 0;
for (const f of files) {
  const filePath = path.join(DATA_DIR, f.name);
  if (!fs.existsSync(filePath)) {
    console.log('[SKIP] ' + f.name + ' (not found)');
    continue;
  }
  try {
    vm.runInContext(fs.readFileSync(filePath, 'utf-8'), ctx, { filename: f.name, timeout: f.timeout });
    console.log('[OK] ' + f.name);
    success++;
  } catch(e) {
    console.log('[ERR] ' + f.name + ': ' + e.message.slice(0, 150));
    const stack = (e.stack || '').split('\n');
    for (const line of stack.slice(1, 5)) console.log('  ' + line.trim());
  }
}

console.log('\n=== Loaded: ' + success + '/' + files.length + ' ===');

// Check if XHR got hooked
const xhrCheck = vm.runInContext(`
  (() => {
    const proto = XMLHttpRequest.prototype;
    return {
      openStr: proto.open.toString().slice(0, 150),
      setRHStr: proto.setRequestHeader.toString().slice(0, 150),
      sendStr: proto.send.toString().slice(0, 150),
      hasSabo: typeof _webmsxyw,
      webpackChunkLen: webpackChunkxhs_pc_web ? webpackChunkxhs_pc_web.length : 0,
    };
  })()
`, ctx);
console.log('\nXHR state:');
console.log(JSON.stringify(xhrCheck, null, 2));

// Try XHR request
console.log('\n=== Test XHR to homefeed ===');
const testResult = vm.runInContext(`
  (() => {
    const captured = {};
    const xhr = new XMLHttpRequest();

    const origSetRH = xhr.setRequestHeader;
    xhr.setRequestHeader = function(key, value) {
      captured[key] = value;
      return origSetRH.call(this, key, value);
    };

    xhr.open('POST', 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed', true);
    xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify({cursor_score:'', num:20, refresh_type:1, note_index:0}));

    // Check for sign headers
    const signHeaders = {};
    for (const k of Object.keys(captured)) {
      if (k.startsWith('x-')) signHeaders[k] = captured[k].slice(0, 100);
    }

    return {
      status: xhr.status,
      headerCount: Object.keys(captured).length,
      signHeaders: signHeaders,
      // Check key existing properties
      hasWebmsxyw: typeof _webmsxyw !== 'undefined',
    };
  })()
`, ctx);
console.log(JSON.stringify(testResult, null, 2));
