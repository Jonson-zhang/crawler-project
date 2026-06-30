---
name: config-block-convention
description: 最终交付代码必须使用 CONFIG 块而非 CLI 参数 — 国家医保局实战教训
metadata:
  type: feedback
---

**所有逆向完成后的最终交付脚本，必须使用顶部 CONFIG 块配置参数，禁止强依赖 CLI 参数。**

## 硬性要求

```python
# ═══════════════════════════════════════════════════════════════
# 配置区 — 修改这里即可，无需命令行参数
# ═══════════════════════════════════════════════════════════════
CONFIG = {
    "keyword": "",          # 医疗机构名称
    "pages": 5,             # 获取页数
    "page_size": 10,        # 每页条数
    "json_output": False,   # True=JSON, False=表格
}
# ═══════════════════════════════════════════════════════════════
```

运行方式必须是 `python xxx.py`，无需任何 CLI 参数。

## 为什么禁止纯 CLI 方案

| 问题 | CLI (argparse) | CONFIG 块 |
|------|----------------|-----------|
| 修改参数 | 每次输入长命令 | 改一个值 |
| 重复执行 | 上箭头翻史命令 | `python xxx.py` |
| 分享给他人 | 需要解释参数 | 打开文件即懂 |
| 自动化 | 需拼接命令行 | 直接 `subprocess.run(["python", "xxx.py"])` |
| 默认值 | 分散在 add_argument | 集中一目了然 |

**CLI 可为辅助（覆盖 CONFIG 中的值），但绝不能是唯一入口。**

## 容许的 CLI 用法

如果确实需要 CLI，只允许覆盖 CONFIG 中的默认值：

```python
parser.add_argument("--pages", type=int, default=None, help="覆盖 CONFIG['pages']")
args = parser.parse_args()
pages = args.pages if args.pages is not None else CONFIG["pages"]
```

**Why:** 国家医保局项目中，每次测试都要打 `python nhsa_client_final.py --regn 110000 --pages 5 --size 10`，反复测试效率极低。改成 CONFIG 块后只需 `python nhsa_client_final.py`，改参数直接编辑 `pages: 5`。

**How to apply:** 每个逆向项目最终交付的主脚本，必须包含顶部 `CONFIG` 块（用醒目的分隔线标注），`python xxx.py` 即可运行。
