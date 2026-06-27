/**
 * 快速验证 isolated-vm 是否比 vm.createContext 更接近浏览器
 */
var ivm = require('isolated-vm');

async function main() {
    var isolate = new ivm.Isolate({ memoryLimit: 256 });
    var context = await isolate.createContext();
    var jail = context.global;

    // 设置最小浏览器环境
    await jail.set('_window', new ivm.Reference({}));
    await context.eval(`
        window = _window;
        window.document = { createElement: function() { return {}; }, body: {}, cookie: '' };
        window.navigator = { userAgent: 'Mozilla/5.0', platform: 'Win32' };
        window.location = { hostname: 'www.zhipin.com' };
        this.console = { log: function(){}, error: function(){}, warn: function(){} };
        this.Date = Date;
        this.Math = Math;
        this.parseInt = parseInt;
        this.JSON = JSON;
        this.Object = Object;
        this.Array = Array;
        this.Function = Function;
        this.String = String;
        this.Number = Number;
        this.RegExp = RegExp;
        this.Error = Error;
        this.Promise = Promise;
        this.Symbol = Symbol;
        this.Map = Map;
        this.Set = Set;
        this.ArrayBuffer = ArrayBuffer;
        this.Uint8Array = Uint8Array;
        this.Int32Array = Int32Array;
        this.NaN = NaN;
        this.Infinity = Infinity;
        this.undefined = undefined;
    `);

    // 尝试执行 security JS
    // 但 isolated-vm 的 eval 不能直接处理 300KB 的代码...
    // 先测试一个简单的：在 isolate 里 typeof navigator 等于什么？
    var result = await context.eval(`typeof navigator`);
    console.log('typeof navigator in ivm:', result);

    result = await context.eval(`typeof window.document.createElement`);
    console.log('typeof createElement:', result);

    // 检查是否有 Node.js 的全局
    result = await context.eval(`typeof process`);
    console.log('typeof process:', result);
    result = await context.eval(`typeof Buffer`);
    console.log('typeof Buffer:', result);
    result = await context.eval(`typeof require`);
    console.log('typeof require:', result);
}

main().catch(function(e) { console.error(e); });
