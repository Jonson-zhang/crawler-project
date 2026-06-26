---
name: proxy-config
description: 网络代理配置（GitHub/外网被墙时使用）
metadata:
  type: reference
---

## 代理地址

```
127.0.0.1:10808
```

## 使用方式

### curl
```bash
curl -x http://127.0.0.1:10808 https://...
```

### git
```bash
git config http.proxy http://127.0.0.1:10808
git config https.proxy http://127.0.0.1:10808
```

### pip / uv
```bash
set HTTPS_PROXY=http://127.0.0.1:10808
set HTTP_PROXY=http://127.0.0.1:10808
```

### node (通过环境变量)
```bash
set HTTP_PROXY=http://127.0.0.1:10808
set HTTPS_PROXY=http://127.0.0.1:10808
```

**Why:** 国内访问 GitHub/外网被墙时使用 Thierry 代理，避免 fetch 超时。
