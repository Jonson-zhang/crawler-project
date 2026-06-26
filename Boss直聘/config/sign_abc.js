/**
 * sign_abc.js - Boss直聘 __zp_stoken__ 生成器 (v2 - 完整补环境)
 * 用法: node sign_abc.js <__a_token> <__c_ts> <seed> <ts>
 *
 * 参数:
 *   __a_token: __a cookie 值
 *   __c_ts:    __c cookie 值
 *   seed:      服务端返回的种子
 *   ts:        服务端返回的时间戳
 *
 * 输出: __zp_stoken__ token 值
 */

// 注入运行时状态（必须在 env.js 之前设置，env.js 的 document.cookie getter 会读取）
global._zp_a = process.argv[2];
global._zp_ts = process.argv[3];

require('./env');
eval(require('fs').readFileSync(__dirname + '/security-7c91433f.js', 'utf8'));

var seed = process.argv[4];
var ts = parseInt(process.argv[5]);
process.stdout.write(new ABC().z(seed, ts));
