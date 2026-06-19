"""
中国五矿招标平台 - 采购信息数据获取 (MCP 逆向版)
使用 js-reverse MCP 直接从浏览器运行时逆向，获取招标公告数据

MCP 逆向过程：
  1. MCP navigate_page → 打开 https://ecuat.minmetals.com.cn/logonAction.do
  2. MCP save_script_source → 获取 index.js + vendors.js 格式化源码
  3. MCP Grep → 定位 encryptLong (index.js:2339)、hex2b64 (vendors.js:209486)、
                RSA encrypt (vendors.js:211051) 的完整函数定义
  4. MCP break_on_xhr → 设置 XHR 断点，拦截 /zbs/by-lx-page 请求
  5. MCP get_paused_info → 确认 Payload 格式: {"param": "684位加密字符串"}
  6. MCP list_network_requests(reqid=115) → 确认响应结构
"""

import json
import sys

import requests

from mcp_encrypt_utils import (
    _COMMON_HEADERS,
    build_encrypted_param,
    build_params,
    fetch_public_key,
)

# MCP reqid=115 确认的 API 端点
_BY_LX_PAGE_URL = "https://ecuat.minmetals.com.cn/open/homepage/zbs/by-lx-page"

# Tab 参照表（MCP 从 index.js 格式化源码中提取的 purchase-info-index 组件 tabs 属性）
# tabIndex=0 → "招标公告" (lx=ZBGG)
# 改下面这个值即可切换
TAB_INDEX = 0

TABS: list[dict[str, str]] = [
    {"name": "招标公告", "lx": "ZBGG"},
    {"name": "澄清公告", "lx": "CQGG"},
    {"name": "招标终止公告", "lx": "ZBZZGG"},
    {"name": "预审澄清公告", "lx": "ZGYSCQ"},
    {"name": "资格预审", "lx": "ZGYS"},
    {"name": "中标候选人公示", "lx": "ZBJG"},
    {"name": "中标结果公告", "lx": "ZBGS"},
    {"name": "采购公告", "lx": "CGGG"},
    {"name": "采购澄清", "lx": "XJCQGG"},
    {"name": "采购结果", "lx": "CGJG"},
    {"name": "竞价公告", "lx": "JPGG"},
    {"name": "竞价澄清", "lx": "JPCQ"},
    {"name": "竞价结果", "lx": "JPJG"},
]


def main() -> None:
    tab = TABS[TAB_INDEX]
    lx = tab["lx"]
    name = tab["name"]

    BAR = "=" * 60
    print(BAR)
    print("中国五矿招标平台 - 采购信息数据获取 (MCP 逆向版)")
    print(f"Tab: {name}  (tabIndex={TAB_INDEX}, lx={lx})")
    print(BAR)

    session = requests.Session()  # MCP 确认需要 Session 保持 cookie

    # Step 1: 获取公钥（MCP reqid=114 确认）
    print("\n[1] 正在获取 RSA 公钥...")
    try:
        public_key = fetch_public_key(session)
        print(f"    公钥获取成功（长度: {len(public_key)} 字符）")
    except Exception as exc:
        print(f"    公钥获取失败: {exc}")
        sys.exit(1)

    # Step 2: 加密并请求数据（MCP reqid=115 确认）
    print(f"\n[2] 正在获取 {name} 数据...")
    try:
        params = build_params(lx=lx, page_index=1)
        encrypted = build_encrypted_param(params, public_key)
        print(f"    加密参数长度: {len(encrypted)} 字符（MCP 拦截确认为 684）")

        payload = {"param": encrypted}  # MCP get_paused_info 确认的格式
        resp = session.post(_BY_LX_PAGE_URL, json=payload, headers=_COMMON_HEADERS)
        resp.raise_for_status()

        data = resp.json()
        item_list = data.get("list", [])
        count = len(item_list)

        print(f"    本页返回: {count} 条\n")
        if count > 0:
            print("    --- 前 3 条记录预览 ---")
            for i, item in enumerate(item_list[:3]):
                mc = item.get("mc", "N/A")
                rq = item.get("rq", "N/A")
                dwmc = item.get("dwmc", "N/A")
                print(f"    [{i+1}] {mc}")
                print(f"        日期: {rq}  单位: {dwmc}")
            if count > 3:
                print(f"    ... 还有 {count - 3} 条")

        print("\n    --- 完整响应 ---")
        print(json.dumps(data, ensure_ascii=False, indent=2))

    except Exception as exc:
        print(f"    请求失败: {exc}")
        sys.exit(1)

    print(f"\n{BAR}")
    print("数据获取完成")
    print(BAR)


if __name__ == "__main__":
    main()
