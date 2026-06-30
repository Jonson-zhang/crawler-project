# 密钥提取指南

获取国家医保局 API 加密密钥的步骤：

## 前提条件
- 已安装 Claude Code + Camoufox MCP
- 网络可访问 fuwu.nhsa.gov.cn

## 提取步骤

### 1. 启动浏览器并导航
在 Claude Code 中执行:
```
/mcp__camoufox-reverse__launch_browser
/mcp__camoufox-reverse__navigate url=https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical
```

### 2. 提取密钥

以下 JS 代码在页面上下文中执行，用于提取 SM4 密钥:

```javascript
// 在 evaluate_js 中执行
(() => {
    // 方法1: 拦截 XHR 获取完整签名
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        console.log('[CAPTURED]', {
            url: this._url || 'unknown',
            body: body,
        });
        return origSend.call(this, body);
    };
    return 'Hook installed - now trigger a search';
})()
```

### 3. 触发搜索并捕获
- 在搜索框输入任意关键词
- 点击"查询"
- 查看 console 输出

### 4. 分析密钥

已知信息:
- **appCode**: T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ
- **encType**: SM4 (CBC 模式, PKCS7 填充)
- **signType**: SM2 (标准 SM2 签名)
- **x-tif-signature**: SHA-256 (64 hex)
- **nonce**: 8 位随机字母数字
- **timestamp**: Unix 时间戳 (秒)

需要提取:
- **SM4 密钥** (16 字节)
- **SM2 密钥对** (用于 signData)
- **x-tif-signature 算法** (SHA-256 的输入)

## 备选方案

如果无法提取密钥，可以使用 CDP 桥接方案:

```python
from cdp_bridge import search_medical
result = search_medical(keyword="北京协和医院")
```
