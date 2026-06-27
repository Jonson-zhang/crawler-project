/**
 * Playwright Stealth Patches for Boss直聘
 * Overrides navigator/detection vectors at prototype level
 */
module.exports = async function (page) {
    await page.addInitScript(`
        // === 1. Remove webdriver from prototype ===
        Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
            get: () => undefined,
            set: () => {},
            configurable: true, enumerable: true
        });
        // Also delete from instance
        delete navigator.__proto__.webdriver;
        delete Object.getPrototypeOf(navigator).webdriver;

        // === 2. Override UA (remove HeadlessChrome) ===
        Object.defineProperty(Object.getPrototypeOf(navigator), 'userAgent', {
            get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            configurable: true, enumerable: true
        });

        // === 3. Mock plugins ===
        const PluginArray = function() {};
        PluginArray.prototype = Object.create(Array.prototype);
        PluginArray.prototype.item = function(i) { return this[i] || null; };
        PluginArray.prototype.namedItem = function(n) { return null; };
        PluginArray.prototype.refresh = function() {};
        PluginArray.prototype.length = 5;
        const plugins = new PluginArray();
        for (let i = 0; i < 5; i++) {
            plugins[i] = {
                name: ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'][i],
                filename: 'internal-pdf-viewer',
                description: 'Portable Document Format',
                length: 1,
                item: function(){ return null },
                namedItem: function(){ return null }
            };
        }
        Object.defineProperty(Object.getPrototypeOf(navigator), 'plugins', {
            get: () => plugins, configurable: true, enumerable: true
        });

        // === 4. Mock mimeTypes ===
        const MimeTypeArray = function(){};
        MimeTypeArray.prototype = Object.create(Array.prototype);
        MimeTypeArray.prototype.item = function(i) { return this[i] || null; };
        MimeTypeArray.prototype.namedItem = function(n) { return null; };
        MimeTypeArray.prototype.length = 2;
        const mts = new MimeTypeArray();
        mts[0] = { type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: plugins[0] };
        mts[1] = { type: 'text/pdf', suffixes: 'pdf', description: '', enabledPlugin: plugins[0] };
        Object.defineProperty(Object.getPrototypeOf(navigator), 'mimeTypes', {
            get: () => mts, configurable: true, enumerable: true
        });

        // === 5. Mock chrome.runtime ===
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // === 6. Hide automation ===
        delete window.__playwright;
        delete window.__pw_manual;
        delete window.__PW_inspect;

        // === 7. Fix languages ===
        Object.defineProperty(Object.getPrototypeOf(navigator), 'languages', {
            get: () => ['zh-CN', 'zh'],
            configurable: true, enumerable: true
        });

        // === 8. Fix permissions ===
        if (navigator.permissions) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (params) =>
                params.name === 'notifications'
                    ? Promise.resolve({state: 'prompt', onchange: null})
                    : origQuery(params);
        }
    `);
};
