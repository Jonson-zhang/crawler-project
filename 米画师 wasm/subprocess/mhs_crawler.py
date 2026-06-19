"""
米画师 (mihuashi.com) 漫画素材爬虫 (subprocess 版)

通过 requests 直接调用 API，使用 mhs_sign 模块生成 M-S 请求签名。
数据在控制台显示，不存盘。

使用方式:
    python mhs_crawler.py

依赖:
    pip install requests
    + mhs_sign.py, sign_tool.js, mhs_fe_sign_bg.wasm (同目录)
"""

import sys
import io
import requests
from mhs_sign import get_request_headers

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

API_BASE = "https://www.mihuashi.com"

# ============================================================
# 配置区 —— 修改下面两个参数即可
# ============================================================
#
# 分类 ID 速查表（来自 /api/v1/configure/art_categories/stall）：
#   id=16   头像        (Q版、正比、男性、女性、双人、有背景、黑白、像素…)
#   id=28   Q版全身     (男性、女性、双人、有背景、像素、色块、小动物…)
#   id=29   半身像      (Q版、正比、男性、女性、双人、有背景、日系、横插…)
#   id= 3   立绘        (Q版、正比、男性、女性、有背景、日系、古风、小动物…)
#   id=30   组合页      (Q版、正比、男性、女性、像素、小动物)
#   id=32   服设        (Q版、正比、男性、女性、安头、日常、lolita)
#   id=17   壁纸        (Q版、正比、男性、女性、双人、古风、横插、竖插…)
#   id=31   表情包      (Q版、正比、小动物、动图、可爱、搞笑、模板)
#   id=21   Live2d      (Q版、正比、男性、女性、日系、小动物、立绘、拆分…)
#   id=33   平面设计    (水印、签名、字体设计、LOGO、排版、周边制品)
# ============================================================

CATEGORY = 29  # 分类 ID，设为 None 则先列出全部分类再手动选择
PAGE_COUNT = 1  # 爬取页数，设为 None 则爬取该分类全部页（最多 50）

# ============================================================


def fetch_categories():
    """从 API 获取分类列表（无需签名）。"""
    resp = requests.get(f"{API_BASE}/api/v1/configure/art_categories/stall", timeout=10)
    resp.raise_for_status()
    data = resp.json()
    categories = []
    for c in data.get("art_categories", []):
        categories.append(
            {
                "id": c["id"],
                "name": c["name"],
                "tags": [t["name"] for t in c.get("tags", [])],
            }
        )
    return categories


def list_categories(categories):
    """在控制台打印分类列表。"""
    print("\n可用分类：")
    print("-" * 60)
    for c in categories:
        tags_str = "、".join(c["tags"][:6])
        if len(c["tags"]) > 6:
            tags_str += "…"
        print(f"  id={c['id']:>2}   {c['name']:<8}  ({tags_str})")
    print("-" * 60)


def resolve_category(categories):
    """根据 CATEGORY 常量决定使用哪个分类。"""
    if CATEGORY is not None:
        name = next(
            (c["name"] for c in categories if c["id"] == CATEGORY), f"id={CATEGORY}"
        )
        print(f"分类: {name} (id={CATEGORY})")
        return CATEGORY

    list_categories(categories)
    while True:
        choice = input("\n输入分类 ID: ").strip()
        if choice.isdigit():
            cid = int(choice)
            if any(c["id"] == cid for c in categories):
                return cid
        print("无效的 ID，请重新输入")


def resolve_page_count(category):
    """根据 PAGE_COUNT 常量决定爬取页数。"""
    if PAGE_COUNT is not None:
        print(f"将爬取 {PAGE_COUNT} 页")
        return PAGE_COUNT

    try:
        data = fetch_stalls(category, page=1, per=20)
        total = min(data.get("total_pages", 1), 50)
        print(f"总共 {data.get('total_pages', 1)} 页，将爬取全部 {total} 页")
        return total
    except Exception as e:
        print(f"获取总页数失败: {e}")
        return 0


def fetch_stalls(category, page=1, per=20, order=2):
    """获取商品列表。签名仅对路径签名，查询参数通过 params 传递。"""
    url_path = "/api/v1/stalls"
    params = {
        "category": category,
        "only_fast": "false",
        "order": order,
        "page": page,
        "per": per,
        "state": "forsale",
    }

    headers = get_request_headers(url_path)

    resp = requests.get(
        f"{API_BASE}{url_path}",
        params=params,
        headers=headers,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("error"):
        raise RuntimeError(f"API 错误: {data.get('msg', data['error'])}")

    return data


def main():
    print("=" * 80)
    print("米画师 - 漫画素材爬虫")
    print("=" * 80)

    # 1. 获取分类列表（无需签名），选择分类
    categories = fetch_categories()
    category = resolve_category(categories)

    # 2. 确定爬取页数
    page_count = resolve_page_count(category)
    if page_count <= 0:
        return

    # 3. 爬取
    seen_ids = set()
    item_count = 0

    for page in range(1, page_count + 1):
        print(f"\n--- 第 {page} 页 ---\n")

        try:
            data = fetch_stalls(category, page=page, per=20)
        except Exception as e:
            print(f"  请求失败: {e}")
            break

        stalls = data.get("stalls", [])
        if not stalls:
            print("  没有更多数据")
            break

        for stall in stalls:
            stall_id = stall.get("id")
            if stall_id in seen_ids:
                continue
            seen_ids.add(stall_id)

            title = stall.get("name", "无标题")
            owner = stall.get("owner", {}) or {}
            author = owner.get("name", "未知作者")
            price = stall.get("price", "未知价格")
            image_url = stall.get("cover_url", "")
            sales = stall.get("sales", 0)

            item_count += 1
            print(f"  [{item_count}] {title}")
            print(f"      作者: {author}")
            print(f"      价格: ¥{price}")
            print(f"      销量: {sales}")
            print(f"      图片: {image_url}")
            print()

        total_pages = data.get("total_pages", 1)
        print(f"  当前页: {page}/{total_pages}")

        if page >= total_pages:
            break

    print()
    print("=" * 80)
    print(f"共获取 {item_count} 个商品")


if __name__ == "__main__":
    main()
