# Boss直聘逆向工程

## 目录

```
Boss直聘/
├── iv8/                       # ✅ 当前方案：iv8 C++ V8 引擎
│   ├── boss_iv8.py            #    入口 + 核心实现
│   ├── zp_stoken.py           #    iv8 官方示例
│   ├── _canvas_png.txt        #    Canvas 指纹
│   └── ...
│
└── reverse_work/              # 📚 逆向全过程记录
    ├── README.md              #   完整时间线和技术总结
    ├── sign_boss_v1~v20.js    #   20 轮补环境迭代
    ├── config/                #   VMP 分析资产
    │   ├── traces/            #   浏览器 + Node.js 执行 trace
    │   ├── vmp_complete_map.json   # 9705 CER 状态表
    │   ├── vmp_full_map_2026.json  # 含 53 环境检查点
    │   ├── prop_access_log.json    # 22 VMP 检测点
    │   ├── pure_operations.json    # 4616 去重操作序列
    │   ├── extract_*.js       #   状态表提取工具
    │   └── build_*.js         #   纯算法构建工具
    ├── BossReverse_ref/       #   社区 7 步 AST 管线参考
    ├── rs-reverse/            #   瑞数逆向参考
    ├── boss_fixed_browser.py  #   Playwright+Chromium 方案
    └── main.py                #   curl_cffi API 流程
```

## 快速使用

```bash
pip install iv8 requests
cd iv8
python boss_iv8.py                   # 搜北京 Python（默认）
python boss_iv8.py 101010100 java        # 搜北京 Java
python boss_iv8.py 101280600 前端         # 搜深圳前端
```

## 原理

Boss直聘对每个 API 请求验证 `__zp_stoken__` cookie。
该 token 由混淆 JS（`11f5a2fc.js`）中的 `new ABC().z(seed, ts)` 生成，
其中 `ABC` 是一个 **3 层嵌套 switch 的 VMP 虚拟机**，
在执行过程中通过 `typeof`、原型链、属性访问等检测运行环境。

[iv8](https://github.com/HanZzzzz000/iv8) 在 C++ 层（V8 引擎内部）实现浏览器 API，
与真实浏览器的执行环境完全一致，VMP 无法检测到差异。
