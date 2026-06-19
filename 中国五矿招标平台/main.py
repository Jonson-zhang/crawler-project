"""
中国五矿招标平台 - 采购信息数据获取
从 https://ecuat.minmetals.com.cn/open/home/purchase-info 获取招标公告数据

手动切换 tab：修改下面的 TAB_INDEX 即可
  (tabIndex 从 TABS 列表中取值，顺序与页面 tab 一一对应)
"""

import json
import sys
from typing import Any

import requests

from encrypt_utils import (
    _COMMON_HEADERS,
    build_encrypted_param,
    build_params,
    fetch_public_key,
    get_api_url,
)

# ─── 当前要抓取的 tab（改这个数字即可切换到其他 tab）─────────────────
TAB_INDEX = 0

# ─── Tab 参照表（顺序与页面 tabIndex 一致）───────────────────────────
#  0: 招标公告       ZBGG      /zbs/by-lx-page
#  1: 澄清公告       CQGG      /zbs/by-lx-page
#  2: 招标终止公告    ZBZZGG    /zbs/by-lx-page
#  3: 预审澄清公告    ZGYSCQ    /zbs/by-lx-page
#  4: 资格预审       ZGYS      /zbs/by-lx-page
#  5: 中标候选人公示  ZBJG      /zbs/by-lx-page
#  6: 中标结果公告    ZBGS      /zbs/by-lx-page
#  7: 采购公告       CGGG      /cgxj/by-lx-page
#  8: 采购澄清       XJCQGG    /cgxj/by-lx-page
#  9: 采购结果       CGJG      /cgxj/by-lx-page
# 10: 竞价公告       JPGG      /jps/by-lx-page
# 11: 竞价澄清       JPCQ      /jps/by-lx-page
# 12: 竞价结果       JPJG      /jps/by-lx-page
# ────────────────────────────────────────────────────────────────────
TABS: list[dict[str, str]] = [
    {"name": "招标公告",       "lx": "ZBGG"},
    {"name": "澄清公告",       "lx": "CQGG"},
    {"name": "招标终止公告",    "lx": "ZBZZGG"},
    {"name": "预审澄清公告",    "lx": "ZGYSCQ"},
    {"name": "资格预审",       "lx": "ZGYS"},
    {"name": "中标候选人公示",  "lx": "ZBJG"},
    {"name": "中标结果公告",    "lx": "ZBGS"},
    {"name": "采购公告",       "lx": "CGGG"},
    {"name": "采购澄清",       "lx": "XJCQGG"},
    {"name": "采购结果",       "lx": "CGJG"},
    {"name": "竞价公告",       "lx": "JPGG"},
    {"name": "竞价澄清",       "lx": "JPCQ"},
    {"name": "竞价结果",       "lx": "JPJG"},
]


def fetch_tab_data(
    session: requests.Session,
    public_key: str,
    lx: str,
    page_index: int = 1,
) -> dict[str, Any] | None:
    """获取指定 LX 代码的采购数据"""
    params = build_params(lx=lx, page_index=page_index)
    encrypted = build_encrypted_param(params, public_key)
    url = get_api_url(lx)
    resp = session.post(url, json={"param": encrypted}, headers=_COMMON_HEADERS)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    """主流程：获取指定 tab 的 1 页数据，输出到控制台"""

    tab = TABS[TAB_INDEX]
    lx = tab["lx"]
    name = tab["name"]

    BAR = "=" * 60
    print(BAR)
    print("中国五矿招标平台 - 采购信息数据获取")
    print(f"Tab: {name}  (tabIndex={TAB_INDEX}, lx={lx})")
    print(BAR)

    # 使用 Session 管理 cookie
    session = requests.Session()

    # 获取公钥
    print("\n[1] 正在获取 RSA 公钥...")
    try:
        public_key = fetch_public_key(session)
        print(f"    公钥获取成功（长度: {len(public_key)} 字符）")
    except Exception as exc:
        print(f"    公钥获取失败: {exc}")
        sys.exit(1)

    # 获取数据
    print(f"\n[2] 正在获取 {name} 数据...")
    try:
        data = fetch_tab_data(session, public_key, lx, page_index=1)
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

        # 完整 JSON 输出
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
