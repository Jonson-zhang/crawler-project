/**
 * 完整 DOM 原型链补丁 — 小红书 mnsv2 VMP 环境
 * 按 Web IDL 规范重建 prototype chain
 */
"use strict";

const noop = () => {};

// ═══ Level 0: EventTarget ═══
function EventTarget() {}
EventTarget.prototype.addEventListener = noop;
EventTarget.prototype.removeEventListener = noop;
EventTarget.prototype.dispatchEvent = function(e) { return true; };

// ═══ Level 1: Node ═══
function Node() {}
Node.prototype = Object.create(EventTarget.prototype);
Node.prototype.constructor = Node;
Node.prototype.ELEMENT_NODE = 1;
Node.prototype.TEXT_NODE = 3;
Node.prototype.nodeType = 1;
Node.prototype.nodeName = '';
Node.prototype.appendChild = noop;
Node.prototype.removeChild = noop;
Node.prototype.insertBefore = noop;
Node.prototype.replaceChild = noop;
Node.prototype.cloneNode = noop;
Node.prototype.contains = () => false;
Node.prototype.hasChildNodes = () => false;

// ═══ Level 2: Element ═══
function Element() {}
Element.prototype = Object.create(Node.prototype);
Element.prototype.constructor = Element;
Element.prototype.tagName = '';
Element.prototype.getAttribute = () => null;
Element.prototype.setAttribute = noop;
Element.prototype.removeAttribute = noop;
Element.prototype.querySelector = () => null;
Element.prototype.querySelectorAll = () => [];
Element.prototype.getElementsByTagName = () => [];
Element.prototype.getElementsByClassName = () => [];
Element.prototype.classList = { add: noop, remove: noop, contains: () => false, toggle: noop };
Element.prototype.style = {};
Element.prototype.innerHTML = '';
Element.prototype.outerHTML = '';
Element.prototype.clientWidth = 0;
Element.prototype.clientHeight = 0;
Element.prototype.offsetWidth = 0;
Element.prototype.offsetHeight = 0;
Element.prototype.getBoundingClientRect = () => ({ x:0, y:0, width:0, height:0, top:0, right:0, bottom:0, left:0 });

// ═══ Level 3: HTMLElement ═══
function HTMLElement() {}
HTMLElement.prototype = Object.create(Element.prototype);
HTMLElement.prototype.constructor = HTMLElement;
HTMLElement.prototype.click = noop;
HTMLElement.prototype.focus = noop;
HTMLElement.prototype.blur = noop;
HTMLElement.prototype.title = '';
HTMLElement.prototype.hidden = false;
HTMLElement.prototype.lang = '';

// ═══ Level 4: HTMLHeadElement, HTMLBodyElement ═══
function HTMLHeadElement() {}
HTMLHeadElement.prototype = Object.create(HTMLElement.prototype);
HTMLHeadElement.prototype.constructor = HTMLHeadElement;
function HTMLBodyElement() {}
HTMLBodyElement.prototype = Object.create(HTMLElement.prototype);
HTMLBodyElement.prototype.constructor = HTMLBodyElement;

// ═══ HTMLCanvasElement ═══
function HTMLCanvasElement(width, height) {
  this.width = width || 300;
  this.height = height || 150;
}
HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype);
HTMLCanvasElement.prototype.constructor = HTMLCanvasElement;
HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === '2d') return new CanvasRenderingContext2D(this);
  if (type === 'webgl' || type === 'experimental-webgl') return new WebGLRenderingContext(this);
  if (type === 'webgl2') return null;
  return null;
};
HTMLCanvasElement.prototype.toDataURL = function() { return 'data:image/png;base64,'; };
HTMLCanvasElement.prototype.toBlob = function(cb) { if (cb) cb(new Blob([])); };

// ═══ CanvasRenderingContext2D ═══
function CanvasRenderingContext2D(canvas) {
  this.canvas = canvas;
}
CanvasRenderingContext2D.prototype = Object.create(Object.prototype);
CanvasRenderingContext2D.prototype.constructor = CanvasRenderingContext2D;
// 核心属性
CanvasRenderingContext2D.prototype.canvas = null;
CanvasRenderingContext2D.prototype.fillStyle = '#000000';
CanvasRenderingContext2D.prototype.strokeStyle = '#000000';
CanvasRenderingContext2D.prototype.lineWidth = 1;
CanvasRenderingContext2D.prototype.lineCap = 'butt';
CanvasRenderingContext2D.prototype.lineJoin = 'miter';
CanvasRenderingContext2D.prototype.globalAlpha = 1;
CanvasRenderingContext2D.prototype.globalCompositeOperation = 'source-over';
CanvasRenderingContext2D.prototype.font = '10px sans-serif';
CanvasRenderingContext2D.prototype.textAlign = 'start';
CanvasRenderingContext2D.prototype.textBaseline = 'alphabetic';
CanvasRenderingContext2D.prototype.shadowBlur = 0;
CanvasRenderingContext2D.prototype.shadowColor = 'rgba(0,0,0,0)';
CanvasRenderingContext2D.prototype.shadowOffsetX = 0;
CanvasRenderingContext2D.prototype.shadowOffsetY = 0;
CanvasRenderingContext2D.prototype.filter = 'none';
CanvasRenderingContext2D.prototype.imageSmoothingEnabled = true;
// 状态
CanvasRenderingContext2D.prototype.save = noop;
CanvasRenderingContext2D.prototype.restore = noop;
// 变换
CanvasRenderingContext2D.prototype.scale = noop;
CanvasRenderingContext2D.prototype.rotate = noop;
CanvasRenderingContext2D.prototype.translate = noop;
CanvasRenderingContext2D.prototype.transform = noop;
CanvasRenderingContext2D.prototype.setTransform = noop;
CanvasRenderingContext2D.prototype.resetTransform = noop;
// 路径
CanvasRenderingContext2D.prototype.beginPath = noop;
CanvasRenderingContext2D.prototype.closePath = noop;
CanvasRenderingContext2D.prototype.moveTo = noop;
CanvasRenderingContext2D.prototype.lineTo = noop;
CanvasRenderingContext2D.prototype.arc = noop;
CanvasRenderingContext2D.prototype.arcTo = noop;
CanvasRenderingContext2D.prototype.bezierCurveTo = noop;
CanvasRenderingContext2D.prototype.quadraticCurveTo = noop;
CanvasRenderingContext2D.prototype.rect = noop;
CanvasRenderingContext2D.prototype.ellipse = noop;
CanvasRenderingContext2D.prototype.clip = noop;
// 绘制
CanvasRenderingContext2D.prototype.stroke = noop;
CanvasRenderingContext2D.prototype.fill = noop;
CanvasRenderingContext2D.prototype.clearRect = noop;
CanvasRenderingContext2D.prototype.fillRect = noop;
CanvasRenderingContext2D.prototype.strokeRect = noop;
CanvasRenderingContext2D.prototype.fillText = noop;
CanvasRenderingContext2D.prototype.strokeText = noop;
CanvasRenderingContext2D.prototype.drawImage = noop;
CanvasRenderingContext2D.prototype.putImageData = noop;
CanvasRenderingContext2D.prototype.createImageData = function(w, h) { return { data: new Uint8Array(w * h * 4), width: w, height: h }; };
CanvasRenderingContext2D.prototype.getImageData = function() { return { data: new Uint8Array(4), width: 1, height: 1, colorSpace: 'srgb' }; };
CanvasRenderingContext2D.prototype.measureText = function(text) {
  return { width: (text || '').length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 10, fontBoundingBoxDescent: 2 };
};
// 渐变/图案
CanvasRenderingContext2D.prototype.createLinearGradient = function() { return new CanvasGradient(); };
CanvasRenderingContext2D.prototype.createRadialGradient = function() { return new CanvasGradient(); };
CanvasRenderingContext2D.prototype.createPattern = function() { return null; };
CanvasRenderingContext2D.prototype.createConicGradient = function() { return new CanvasGradient(); };
// 如果 VMP 检查了特定属性
CanvasRenderingContext2D.prototype.isPointInPath = () => false;
CanvasRenderingContext2D.prototype.isPointInStroke = () => false;

function CanvasGradient() {}
CanvasGradient.prototype.addColorStop = noop;

// ═══ WebGLRenderingContext ═══
function WebGLRenderingContext(canvas) { this.canvas = canvas; }
WebGLRenderingContext.prototype = Object.create(Object.prototype);
WebGLRenderingContext.prototype.constructor = WebGLRenderingContext;
WebGLRenderingContext.prototype.canvas = null;
WebGLRenderingContext.prototype.drawingBufferWidth = 300;
WebGLRenderingContext.prototype.drawingBufferHeight = 150;
WebGLRenderingContext.prototype.getParameter = function(p) {
  // Return common values
  if (p === 0x1F02) return 'WebGL 1.0 (ANGLE Intel)'; // RENDERER
  if (p === 0x1F01) return 'WebKit WebGL'; // VENDOR
  if (p === 0x1F00) return 'WebGL 1.0'; // VERSION
  if (p === 0x8B8C) return 'WebGL GLSL ES 1.0'; // SHADING_LANGUAGE_VERSION
  if (p === 0x8872) return 8; // MAX_TEXTURE_SIZE
  if (p === 0x0D33) return 16; // MAX_TEXTURE_IMAGE_UNITS
  if (p === 0x8B4A) return 8; // MAX_VERTEX_TEXTURE_IMAGE_UNITS
  if (p === 0x8869) return 16; // MAX_VERTEX_ATTRIBS
  if (p === 0x8DFB) return 512; // MAX_COMBINED_TEXTURE_IMAGE_UNITS
  if (p === 0x8B4C) return 8; // MAX_VARYING_VECTORS
  if (p === 0x8B4B) return 8; // MAX_VERTEX_UNIFORM_VECTORS
  if (p === 0x8B49) return 8; // MAX_FRAGMENT_UNIFORM_VECTORS
  if (p === 0x8B8D) return null; // CURRENT_PROGRAM
  if (p === 0x9245) return ['EXT_texture_filter_anisotropic', 'OES_texture_float', 'WEBGL_debug_renderer_info'];
  return 0;
};
WebGLRenderingContext.prototype.getExtension = function(name) {
  if (name === 'WEBGL_debug_renderer_info') return { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 };
  return null;
};
WebGLRenderingContext.prototype.createShader = noop;
WebGLRenderingContext.prototype.shaderSource = noop;
WebGLRenderingContext.prototype.compileShader = noop;
WebGLRenderingContext.prototype.getShaderParameter = () => true;
WebGLRenderingContext.prototype.createProgram = () => ({});
WebGLRenderingContext.prototype.attachShader = noop;
WebGLRenderingContext.prototype.linkProgram = noop;
WebGLRenderingContext.prototype.useProgram = noop;
WebGLRenderingContext.prototype.getProgramParameter = () => true;
WebGLRenderingContext.prototype.getAttribLocation = () => 0;
WebGLRenderingContext.prototype.enableVertexAttribArray = noop;
WebGLRenderingContext.prototype.disableVertexAttribArray = noop;
WebGLRenderingContext.prototype.bindBuffer = noop;
WebGLRenderingContext.prototype.bufferData = noop;
WebGLRenderingContext.prototype.createBuffer = () => ({});
WebGLRenderingContext.prototype.vertexAttribPointer = noop;
WebGLRenderingContext.prototype.drawArrays = noop;
WebGLRenderingContext.prototype.clear = noop;
WebGLRenderingContext.prototype.clearColor = noop;
WebGLRenderingContext.prototype.viewport = noop;
WebGLRenderingContext.prototype.getShaderInfoLog = () => '';
WebGLRenderingContext.prototype.getProgramInfoLog = () => '';
WebGLRenderingContext.prototype.getError = () => 0; // NO_ERROR
WebGLRenderingContext.prototype.getSupportedExtensions = () => [];
WebGLRenderingContext.prototype.getContextAttributes = () => ({ alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default' });

// ═══ OffscreenCanvas ═══
function OffscreenCanvas(w, h) { this.width = w; this.height = h; }
OffscreenCanvas.prototype = Object.create(Object.prototype);
OffscreenCanvas.prototype.constructor = OffscreenCanvas;
OffscreenCanvas.prototype.getContext = function(t) {
  return t === '2d' ? new CanvasRenderingContext2D(this) : null;
};
OffscreenCanvas.prototype.convertToBlob = function() { return Promise.resolve(new Blob([])); };

// ═══ AudioContext ═══
function AudioContext() {
  this.sampleRate = 44100;
  this.destination = {};
  this.state = 'running';
}
AudioContext.prototype = Object.create(Object.prototype);
AudioContext.prototype.constructor = AudioContext;
AudioContext.prototype.destination = { maxChannelCount: 2 };
AudioContext.prototype.state = 'running';
AudioContext.prototype.sampleRate = 44100;
AudioContext.prototype.baseLatency = 0.01;
AudioContext.prototype.outputLatency = 0.01;
AudioContext.prototype.createOscillator = function() {
  return new OscillatorNode(this);
};
AudioContext.prototype.createGain = function() {
  return { connect: noop, disconnect: noop, gain: { value: 1, defaultValue: 1 } };
};
AudioContext.prototype.createAnalyser = function() {
  return { connect: noop, disconnect: noop, frequencyBinCount: 1024, fftSize: 2048, getByteFrequencyData: noop, getByteTimeDomainData: noop, getFloatFrequencyData: noop, getFloatTimeDomainData: noop };
};
AudioContext.prototype.createBuffer = function(ch, len, rate) {
  return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: function(i) { return new Float32Array(len); }, copyFromChannel: noop, copyToChannel: noop };
};
AudioContext.prototype.createBufferSource = function() {
  return { connect: noop, disconnect: noop, start: noop, stop: noop, buffer: null, playbackRate: { value: 1 }, detune: { value: 0 }, loop: false };
};
AudioContext.prototype.createScriptProcessor = function(bufSize, inCh, outCh) {
  return { connect: noop, disconnect: noop, bufferSize: bufSize, onaudioprocess: null };
};
AudioContext.prototype.createDynamicsCompressor = function() {
  return { connect: noop, disconnect: noop, threshold: { value: -24 }, knee: { value: 30 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 } };
};
AudioContext.prototype.createBiquadFilter = function() {
  return { connect: noop, disconnect: noop, type: 'lowpass', frequency: { value: 350 }, Q: { value: 1 }, gain: { value: 0 } };
};
AudioContext.prototype.createChannelMerger = function() { return { connect: noop, disconnect: noop }; };
AudioContext.prototype.createChannelSplitter = function() { return { connect: noop, disconnect: noop }; };
AudioContext.prototype.createDelay = function() { return { connect: noop, disconnect: noop, delayTime: { value: 0 } }; };
AudioContext.prototype.createMediaStreamSource = function() { return { connect: noop, disconnect: noop }; };
AudioContext.prototype.createStereoPanner = function() { return { connect: noop, disconnect: noop, pan: { value: 0 } }; };
AudioContext.prototype.createWaveShaper = function() { return { connect: noop, disconnect: noop, curve: null }; };
AudioContext.prototype.close = noop;
AudioContext.prototype.decodeAudioData = function(buf, success, error) {
  if (success) {
    setTimeout(function() {
      success({ numberOfChannels: 1, length: 44100, sampleRate: 44100, duration: 1, getChannelData: function() { return new Float32Array(44100); } });
    }, 0);
  }
};

function OscillatorNode(ctx) {
  this.context = ctx;
  this.frequency = { value: 440, defaultValue: 440, minValue: -22050, maxValue: 22050 };
  this.detune = { value: 0 };
  this.type = 'sine';
}
OscillatorNode.prototype = Object.create(Object.prototype);
OscillatorNode.prototype.constructor = OscillatorNode;
OscillatorNode.prototype.connect = noop;
OscillatorNode.prototype.disconnect = noop;
OscillatorNode.prototype.start = noop;
OscillatorNode.prototype.stop = noop;

// ═══ XMLHttpRequest ═══
function XMLHttpRequest() {
  this.readyState = 0;
  this.status = 0;
  this.statusText = '';
  this.responseText = '';
  this.responseXML = null;
  this.response = null;
  this.responseType = '';
  this.timeout = 0;
  this.withCredentials = false;
  this._headers = {};
  this._method = '';
  this._url = '';
  this._requestHeaders = {};
  this.UNSENT = 0;
  this.OPENED = 1;
  this.HEADERS_RECEIVED = 2;
  this.LOADING = 3;
  this.DONE = 4;
}
XMLHttpRequest.prototype = Object.create(Object.prototype);
XMLHttpRequest.prototype.constructor = XMLHttpRequest;
XMLHttpRequest.prototype.UNSENT = 0;
XMLHttpRequest.prototype.OPENED = 1;
XMLHttpRequest.prototype.HEADERS_RECEIVED = 2;
XMLHttpRequest.prototype.LOADING = 3;
XMLHttpRequest.prototype.DONE = 4;
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
  this._method = method;
  this._url = url;
  this.readyState = 1;
  if (this.onreadystatechange) this.onreadystatechange();
};
XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
  this._requestHeaders[key] = value;
};
XMLHttpRequest.prototype.send = function(body) {
  this.readyState = 4;
  this.status = 200;
  this.statusText = 'OK';
  this.responseText = '{}';
  if (this.onreadystatechange) this.onreadystatechange();
  if (this.onload) this.onload();
};
XMLHttpRequest.prototype.abort = noop;
XMLHttpRequest.prototype.getAllResponseHeaders = function() { return ''; };
XMLHttpRequest.prototype.getResponseHeader = function(name) { return null; };
XMLHttpRequest.prototype.overrideMimeType = noop;

// ═══ Headers (Fetch API) ═══
function Headers(init) { this._h = {}; if (init) { for (var k in init) this._h[k] = init[k]; } }
Headers.prototype = Object.create(Object.prototype);
Headers.prototype.constructor = Headers;
Headers.prototype.append = function(k, v) { this._h[k] = v; };
Headers.prototype.set = function(k, v) { this._h[k] = v; };
Headers.prototype.get = function(k) { return this._h[k]; };
Headers.prototype.has = function(k) { return k in this._h; };
Headers.prototype.delete = function(k) { delete this._h[k]; };
Headers.prototype.forEach = function(cb) { for (var k in this._h) cb(this._h[k], k, this); };

// ═══ Blob ═══
function Blob(parts, options) { this.size = parts ? parts.join('').length : 0; this.type = options && options.type || ''; }
Blob.prototype = Object.create(Object.prototype);
Blob.prototype.constructor = Blob;
Blob.prototype.arrayBuffer = function() { return Promise.resolve(new ArrayBuffer(0)); };
Blob.prototype.text = function() { return Promise.resolve(''); };
Blob.prototype.stream = function() { return null; };
Blob.prototype.slice = function() { return new Blob([], { type: this.type }); };

// ═══ File ═══
function File(parts, name, options) {
  Blob.call(this, parts, options);
  this.name = name || '';
  this.lastModified = (options && options.lastModified) || Date.now();
}
File.prototype = Object.create(Blob.prototype);
File.prototype.constructor = File;
File.prototype.name = '';
File.prototype.lastModified = 0;

// ═══ FileReader ═══
function FileReader() {}
FileReader.prototype = Object.create(Object.prototype);
FileReader.prototype.constructor = FileReader;
FileReader.prototype.readAsArrayBuffer = function(blob) {
  this.result = new ArrayBuffer(blob.size || 0);
  if (this.onload) this.onload();
};
FileReader.prototype.readAsText = function(blob) {
  this.result = '';
  if (this.onload) this.onload();
};
FileReader.prototype.readAsDataURL = function(blob) {
  this.result = 'data:text/plain;base64,';
  if (this.onload) this.onload();
};
FileReader.prototype.abort = noop;

// ═══ FormData ═══
function FormData() { this._data = []; }
FormData.prototype = Object.create(Object.prototype);
FormData.prototype.constructor = FormData;
FormData.prototype.append = function(k, v) { this._data.push([k, v]); };
FormData.prototype.delete = function(k) { this._data = this._data.filter(function(e) { return e[0] !== k; }); };
FormData.prototype.get = function(k) { var e = this._data.find(function(e) { return e[0] === k; }); return e ? e[1] : null; };
FormData.prototype.getAll = function(k) { return this._data.filter(function(e) { return e[0] === k; }).map(function(e) { return e[1]; }); };
FormData.prototype.has = function(k) { return this._data.some(function(e) { return e[0] === k; }); };
FormData.prototype.set = function(k, v) { this.delete(k); this.append(k, v); };

// ═══ URLSearchParams ═══
// Use the native one but with proper prototype

// ═══ MutationObserver ═══
function MutationObserver(callback) { this._cb = callback; }
MutationObserver.prototype = Object.create(Object.prototype);
MutationObserver.prototype.constructor = MutationObserver;
MutationObserver.prototype.observe = noop;
MutationObserver.prototype.disconnect = noop;
MutationObserver.prototype.takeRecords = function() { return []; };

// ═══ IntersectionObserver ═══
function IntersectionObserver(cb, opts) { this._cb = cb; }
IntersectionObserver.prototype = Object.create(Object.prototype);
IntersectionObserver.prototype.constructor = IntersectionObserver;
IntersectionObserver.prototype.observe = noop;
IntersectionObserver.prototype.unobserve = noop;
IntersectionObserver.prototype.disconnect = noop;
IntersectionObserver.prototype.takeRecords = function() { return []; };

// ═══ ResizeObserver ═══
function ResizeObserver(cb) { this._cb = cb; }
ResizeObserver.prototype = Object.create(Object.prototype);
ResizeObserver.prototype.constructor = ResizeObserver;
ResizeObserver.prototype.observe = noop;
ResizeObserver.prototype.unobserve = noop;
ResizeObserver.prototype.disconnect = noop;

// ═══ PerformanceObserver ═══
function PerformanceObserver(cb) {}
PerformanceObserver.prototype = Object.create(Object.prototype);
PerformanceObserver.prototype.constructor = PerformanceObserver;
PerformanceObserver.prototype.observe = noop;
PerformanceObserver.prototype.disconnect = noop;
PerformanceObserver.prototype.takeRecords = function() { return []; };

// ═══ Event ═══
function Event(type, opts) {
  this.type = type;
  this.bubbles = !!(opts && opts.bubbles);
  this.cancelable = !!(opts && opts.cancelable);
  this.composed = !!(opts && opts.composed);
  this.defaultPrevented = false;
  this.target = null;
  this.timeStamp = Date.now();
}
Event.prototype = Object.create(Object.prototype);
Event.prototype.constructor = Event;
Event.prototype.preventDefault = function() { this.defaultPrevented = true; };
Event.prototype.stopPropagation = noop;
Event.prototype.stopImmediatePropagation = noop;
Event.prototype.composedPath = function() { return []; };

// ═══ CustomEvent ═══
function CustomEvent(type, opts) {
  Event.call(this, type, opts);
  this.detail = (opts && opts.detail) || null;
}
CustomEvent.prototype = Object.create(Event.prototype);
CustomEvent.prototype.constructor = CustomEvent;

// ═══ MessageChannel ═══
function MessageChannel() {
  var ch = this;
  var port1Msg = null, port2Msg = null;
  this.port1 = {
    postMessage: function(data) { port2Msg = data; if (ch.port2.onmessage) { var e = { data: data, ports: [] }; ch.port2.onmessage(e); } },
    onmessage: null,
    close: noop,
    start: noop,
    addEventListener: noop,
    removeEventListener: noop,
  };
  this.port2 = {
    postMessage: function(data) { port1Msg = data; if (ch.port1.onmessage) { var e = { data: data, ports: [] }; ch.port1.onmessage(e); } },
    onmessage: null,
    close: noop,
    start: noop,
    addEventListener: noop,
    removeEventListener: noop,
  };
}

// ═══ Worker ═══
function Worker(url) {
  this.onmessage = null;
  this.onerror = null;
}
Worker.prototype = Object.create(Object.prototype);
Worker.prototype.constructor = Worker;
Worker.prototype.postMessage = noop;
Worker.prototype.terminate = noop;
Worker.prototype.addEventListener = noop;
Worker.prototype.removeEventListener = noop;

// ═══ WebSocket ═══
function WebSocket(url, protocols) {
  this.url = url;
  this.readyState = 0; // CONNECTING
  this.bufferedAmount = 0;
  this.onopen = null;
  this.onmessage = null;
  this.onclose = null;
  this.onerror = null;
}
WebSocket.prototype = Object.create(Object.prototype);
WebSocket.prototype.constructor = WebSocket;
WebSocket.prototype.CONNECTING = 0;
WebSocket.prototype.OPEN = 1;
WebSocket.prototype.CLOSING = 2;
WebSocket.prototype.CLOSED = 3;
WebSocket.prototype.send = noop;
WebSocket.prototype.close = noop;
WebSocket.prototype.addEventListener = noop;
WebSocket.prototype.removeEventListener = noop;

// ═══ Image (HTMLImageElement) ═══
function Image(width, height) {
  this.width = width || 0;
  this.height = height || 0;
  this.src = '';
  this.alt = '';
  this.naturalWidth = 0;
  this.naturalHeight = 0;
  this.complete = false;
  this.onload = null;
  this.onerror = null;
}
Image.prototype = Object.create(HTMLElement.prototype);
Image.prototype.constructor = Image;

// ═══ Performance ═══
function Performance() {
  this.timeOrigin = Date.now() - 1000;
}
Performance.prototype = Object.create(Object.prototype);
Performance.prototype.constructor = Performance;
Performance.prototype.now = function() { return Date.now() - this.timeOrigin; };
Performance.prototype.toJSON = function() { return { timeOrigin: this.timeOrigin }; };
Performance.prototype.getEntriesByType = function() { return []; };
Performance.prototype.getEntriesByName = function() { return []; };
Performance.prototype.getEntries = function() { return []; };
Performance.prototype.clearMarks = noop;
Performance.prototype.clearMeasures = noop;
Performance.prototype.clearResourceTimings = noop;
Performance.prototype.mark = noop;
Performance.prototype.measure = noop;
Performance.prototype.setResourceTimingBufferSize = noop;

function PerformanceTiming() {}
PerformanceTiming.prototype = Object.create(Object.prototype);
PerformanceTiming.prototype.constructor = PerformanceTiming;
PerformanceTiming.prototype.navigationStart = 0;
PerformanceTiming.prototype.unloadEventStart = 0;
PerformanceTiming.prototype.unloadEventEnd = 0;
PerformanceTiming.prototype.redirectStart = 0;
PerformanceTiming.prototype.redirectEnd = 0;
PerformanceTiming.prototype.fetchStart = 0;
PerformanceTiming.prototype.domainLookupStart = 0;
PerformanceTiming.prototype.domainLookupEnd = 0;
PerformanceTiming.prototype.connectStart = 0;
PerformanceTiming.prototype.connectEnd = 0;
PerformanceTiming.prototype.secureConnectionStart = 0;
PerformanceTiming.prototype.requestStart = 0;
PerformanceTiming.prototype.responseStart = 0;
PerformanceTiming.prototype.responseEnd = 0;
PerformanceTiming.prototype.domLoading = 0;
PerformanceTiming.prototype.domInteractive = 0;
PerformanceTiming.prototype.domContentLoadedEventStart = 0;
PerformanceTiming.prototype.domContentLoadedEventEnd = 0;
PerformanceTiming.prototype.domComplete = 0;
PerformanceTiming.prototype.loadEventStart = 0;
PerformanceTiming.prototype.loadEventEnd = 0;
PerformanceTiming.prototype.toJSON = function() { return {}; };

function PerformanceNavigation() {}
PerformanceNavigation.prototype = Object.create(Object.prototype);
PerformanceNavigation.prototype.constructor = PerformanceNavigation;
PerformanceNavigation.prototype.TYPE_NAVIGATE = 0;
PerformanceNavigation.prototype.TYPE_RELOAD = 1;
PerformanceNavigation.prototype.TYPE_BACK_FORWARD = 2;
PerformanceNavigation.prototype.TYPE_RESERVED = 255;
PerformanceNavigation.prototype.type = 1;
PerformanceNavigation.prototype.redirectCount = 0;
PerformanceNavigation.prototype.toJSON = function() { return { type: 1, redirectCount: 0 }; };

var performance = new Performance();
// Add timing as proper PerformanceTiming instance
var perfTiming = new PerformanceTiming();
var now = Date.now();
perfTiming.navigationStart = now - 1000;
perfTiming.fetchStart = now - 900;
perfTiming.domainLookupStart = now - 850;
perfTiming.domainLookupEnd = now - 840;
perfTiming.connectStart = now - 830;
perfTiming.connectEnd = now - 800;
perfTiming.secureConnectionStart = now - 810;
perfTiming.requestStart = now - 750;
perfTiming.responseStart = now - 500;
perfTiming.responseEnd = now - 400;
perfTiming.domLoading = now - 350;
perfTiming.domInteractive = now - 200;
perfTiming.domContentLoadedEventStart = now - 100;
perfTiming.domContentLoadedEventEnd = now - 50;
perfTiming.domComplete = now - 10;
perfTiming.loadEventStart = now - 5;
perfTiming.loadEventEnd = now;
performance.timing = perfTiming;
performance.navigation = new PerformanceNavigation();

// ═══ Screen ═══
var screen = {
  width: 1920,
  height: 1080,
  availWidth: 1920,
  availHeight: 1040,
  colorDepth: 24,
  pixelDepth: 24,
  availLeft: 0,
  availTop: 0,
  orientation: { type: 'landscape-primary', angle: 0 },
};

// ═══ Navigator ═══
var navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  platform: 'Win32',
  language: 'zh-CN',
  languages: ['zh-CN', 'zh', 'en'],
  hardwareConcurrency: 16,
  deviceMemory: 8,
  maxTouchPoints: 0,
  webdriver: false,
  cookieEnabled: true,
  doNotTrack: null,
  vendor: 'Google Inc.',
  vendorSub: '',
  productSub: '20030107',
  appCodeName: 'Mozilla',
  appName: 'Netscape',
  appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  plugins: [],
  mimeTypes: [],
  onLine: true,
  pdfViewerEnabled: true,
};

// ═══ Location ═══
var location = {
  href: 'https://www.xiaohongshu.com/explore',
  protocol: 'https:',
  host: 'www.xiaohongshu.com',
  hostname: 'www.xiaohongshu.com',
  port: '',
  pathname: '/explore',
  search: '',
  hash: '',
  origin: 'https://www.xiaohongshu.com',
  ancestorOrigins: {},
};

// ═══ History ═══
var history = {
  length: 1,
  state: null,
  scrollRestoration: 'auto',
};
history.pushState = noop;
history.replaceState = noop;
history.back = noop;
history.forward = noop;
history.go = noop;

// ═══ Document ═══
var document = {
  cookie: '',
  referrer: 'https://www.xiaohongshu.com/',
  title: '小红书',
  characterSet: 'UTF-8',
  charset: 'UTF-8',
  contentType: 'text/html',
  readyState: 'complete',
  hidden: false,
  visibilityState: 'visible',
  domain: 'www.xiaohongshu.com',
  URL: 'https://www.xiaohongshu.com/explore',
  documentURI: 'https://www.xiaohongshu.com/explore',
  baseURI: 'https://www.xiaohongshu.com/',
  compatMode: 'CSS1Compat',
  designMode: 'off',
  dir: 'ltr',
  all: [],
  forms: [],
  images: [],
  links: [],
  scripts: [],
  styleSheets: [],
  createElement: function(tag) {
    tag = (tag || '').toLowerCase();
    if (tag === 'canvas') return new HTMLCanvasElement();
    if (tag === 'div') return new HTMLElement();
    if (tag === 'img') return new Image();
    if (tag === 'a') { var a = new HTMLElement(); a.href = ''; return a; }
    if (tag === 'script') { var s = new HTMLElement(); s.src = ''; s.text = ''; s.type = ''; return s; }
    if (tag === 'style') return new HTMLElement();
    if (tag === 'iframe') { var f = new HTMLElement(); f.contentWindow = {}; f.contentDocument = {}; return f; }
    return new HTMLElement();
  },
  createEvent: function(type) { return new Event(type); },
  createTextNode: function(text) { return { nodeType: 3, textContent: text, nodeValue: text }; },
  createDocumentFragment: function() { return { nodeType: 11, appendChild: noop }; },
  getElementById: function() { return null; },
  getElementsByTagName: function() { return []; },
  getElementsByClassName: function() { return []; },
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; },
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: noop,
  head: Object.create(HTMLHeadElement.prototype),
  body: Object.create(HTMLBodyElement.prototype),
  documentElement: Object.create(HTMLElement.prototype),
  location: location,
};
document.head.appendChild = noop;
document.body.appendChild = noop;
document.documentElement.style = {};

// ═══ localStorage / sessionStorage ═══
function createStorage() {
  var data = {};
  var storage = {
    getItem: function(k) { return data.hasOwnProperty(k) ? data[k] : null; },
    setItem: function(k, v) { data[k] = String(v); },
    removeItem: function(k) { delete data[k]; },
    clear: function() { data = {}; },
    key: function(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
  };
  return storage;
}
var localStorage = createStorage();
var sessionStorage = createStorage();

// ═══ Console ═══
var console = {
  log:   function() {},
  error: function() {},
  warn:  function() {},
  info:  function() {},
  debug: function() {},
  trace: function() {},
  dir:   function() {},
  table: function() {},
  time:  function() {},
  timeEnd: function() {},
  count: function() {},
  clear: function() {},
  group: function() {},
  groupEnd: function() {},
  assert: function() {},
};

// ═══ Navigator (with proper prototype) ═══
// navigator already defined above as plain object; wrap it
// Navigator is not directly constructable, but VMP might check navigator's constructor

// ═══ Document (base class) ═══
function Document() {}
Document.prototype = Object.create(Node.prototype);
Document.prototype.constructor = Document;
Document.prototype.nodeType = 9;
Document.prototype.characterSet = 'UTF-8';
Document.prototype.readyState = 'complete';
Document.prototype.visibilityState = 'visible';
Document.prototype.hidden = false;
Document.prototype.title = '';
Document.prototype.cookie = '';
Document.prototype.referrer = '';
Document.prototype.URL = 'https://www.xiaohongshu.com/explore';
Document.prototype.domain = 'www.xiaohongshu.com';

// ═══ HTMLDocument (extends Document) ═══
function HTMLDocument() {}
HTMLDocument.prototype = Object.create(Document.prototype);
HTMLDocument.prototype.constructor = HTMLDocument;
// Patch document to use HTMLDocument prototype
Object.setPrototypeOf(document, HTMLDocument.prototype);

// ═══ Navigator (proper class for instanceof checks) ═══
function Navigator() {}
Navigator.prototype = Object.create(Object.prototype);
Navigator.prototype.constructor = Navigator;
// Copy properties from navigator plain object
for (var k in navigator) {
  if (typeof navigator[k] !== 'function') {
    Navigator.prototype[k] = navigator[k];
  }
}
// Set up Symbol.hasInstance for VMP checks
// navigator is a singleton, so we can make it pass `instanceof Navigator`
Object.defineProperty(Navigator, Symbol.hasInstance, {
  value: function(instance) { return instance === navigator; }
});

// ═══ Screen class ═══
function Screen() {}
Screen.prototype = Object.create(Object.prototype);
Screen.prototype.constructor = Screen;
for (var sk in screen) { Screen.prototype[sk] = screen[sk]; }

// ═══ Location class ═══
function Location() {}
Location.prototype = Object.create(Object.prototype);
Location.prototype.constructor = Location;
Location.prototype.href = '';
Location.prototype.protocol = '';
Location.prototype.host = '';
Location.prototype.hostname = '';
Location.prototype.port = '';
Location.prototype.pathname = '';
Location.prototype.search = '';
Location.prototype.hash = '';
Location.prototype.origin = '';
Location.prototype.assign = noop;
Location.prototype.replace = noop;
Location.prototype.reload = noop;
Location.prototype.toString = function() { return this.href; };

// ═══ History class ═══
function History() {}
History.prototype = Object.create(Object.prototype);
History.prototype.constructor = History;
History.prototype.length = 1;
History.prototype.state = null;
History.prototype.scrollRestoration = 'auto';
History.prototype.pushState = noop;
History.prototype.replaceState = noop;
History.prototype.back = noop;
History.prototype.forward = noop;
History.prototype.go = noop;

// ═══ Exports ═══
module.exports = {
  EventTarget, Node, Element, HTMLElement,
  HTMLHeadElement, HTMLBodyElement, Document, HTMLDocument,
  HTMLCanvasElement,
  CanvasRenderingContext2D, CanvasGradient,
  WebGLRenderingContext,
  OffscreenCanvas,
  AudioContext, OscillatorNode,
  XMLHttpRequest,
  Headers, Blob, File, FileReader, FormData,
  MutationObserver,
  IntersectionObserver,
  ResizeObserver,
  PerformanceObserver,
  Performance, PerformanceTiming, PerformanceNavigation,
  Event, CustomEvent,
  MessageChannel, Worker, WebSocket,
  Navigator, Screen, Location, History,
  Image,
  performance, screen, navigator, location, history,
  document, localStorage, sessionStorage, console,
  noop,
};
