"""
欧冶钢材网 - 瑞数逆向求解器（浏览器代理版）

=== 原理 ===
欧冶网站使用瑞数反爬系统：
1. 首次访问返回 202 → 加载动态 JS 挑战 → 验证通过后设置 Cookie
2. 已验证的 HTTP/2 连接不需要 K5nOZLud 参数即可调用 API
3. 外部请求（curl/httpx）会返回 202，因为无共享 HTTP2 连接

=== 方案 ===
使用 Camoufox 反检测浏览器保持有效会话，
通过浏览器上下文（evaluate_js）发起 API 调用，
实现绕过瑞数保护。

=== 使用方式 ===
方式 1: 通过 Claude Code MCP 使用（推荐）
  在 Claude Code 对话中使用 /ouyeel_search 或通过 MCP 调用

方式 2: 独立运行（需要 Camoufox Python SDK）
  python solver.py

方式 3: 通过 Camoufox MCP 浏览器直接调用
  浏览器保持打开状态，通过 evaluate_js 调用 query 函数
"""

import json
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════

DATA_DIR = Path(__file__).parent
COOKIE_FILE = DATA_DIR / "cookies.json"


# ═══════════════════════════════════════════
# Cookie 管理
# ═══════════════════════════════════════════

def load_cookies() -> Dict[str, str]:
    """从文件加载 Cookie"""
    if COOKIE_FILE.exists():
        return json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
    return {}


def save_cookies(cookies: dict) -> None:
    """保存 Cookie 到文件"""
    # 合并已有的 Cookie
    existing = load_cookies()
    existing.update(cookies)
    COOKIE_FILE.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    log.info(f"已保存 {len(existing)} 个 Cookie")


# ═══════════════════════════════════════════
# API 构建函数
# ═══════════════════════════════════════════

def build_search_criteria(
    channel: str = "RJ",
    page_index: int = 0,
    page_size: int = 50,
    max_page: int = 50,
    keyword: Optional[str] = None,
    **kwargs,
) -> dict:
    """
    构建搜索条件

    Args:
        channel: 频道 (RJ=热卷, LC=冷轧, ZX=中厚板, GX=管材, TP=特钢)
        page_index: 页码 (0=第一页)
        page_size: 每页数量 (默认50)
        max_page: 最大页数
        keyword: 搜索关键词

    Returns:
        搜索条件字典
    """
    criteria = {
        "pageSize": page_size,
        "industryComponent": None,
        "channel": channel,
        "productType": None,
        "sort": None,
        "warehouseCode": None,
        "key_search": keyword,
        "is_central": None,
        "searchField": None,
        "companyCode": None,
        "inquiryCategory": None,
        "inquirySpec": None,
        "provider": None,
        "shopCode": None,
        "packCodes": None,
        "steelFactory": None,
        "resourceIds": None,
        "providerCode": None,
        "jsonParam": {
            "channel": channel,
            "keywordAnalyseResult": None,
        },
        "excludeShowSoldOut": None,
        "pageIndex": page_index,
        "maxPage": max_page,
    }

    # 合并额外参数
    for k, v in kwargs.items():
        if v is not None:
            criteria[k] = v

    return criteria


def api_post_js(
    criteria: dict,
    api_url: str = "/search-ng/commoditySearch/queryCommodityResult",
) -> str:
    """
    生成在浏览器中执行 API 请求的 JavaScript 代码

    此代码通过 XHR 从浏览器内部发起请求，
    共享已验证的 HTTP/2 连接，绕过瑞数检测。
    """
    criteria_json = json.dumps(criteria, ensure_ascii=False)

    return f"""
    (() => {{
        return new Promise((resolve, reject) => {{
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '{api_url}', true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.onload = function() {{
                resolve({{
                    status: xhr.status,
                    responseText: xhr.responseText
                }});
            }};
            xhr.onerror = function() {{
                resolve({{status: 0, responseText: 'Network error'}});
            }};
            xhr.send('criteriaJson=' + encodeURIComponent('{criteria_json}'));
        }});
    }})()
    """


# ═══════════════════════════════════════════
# 浏览器 API 调用（通过 Camoufox 主体执行）
# ═══════════════════════════════════════════

def query_commodity_from_browser(
    evaluate_fn,
    channel: str = "RJ",
    page_index: int = 0,
    page_size: int = 50,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """
    通过浏览器上下文调用商品查询 API

    Args:
        evaluate_fn: 浏览器 evaluate_js 函数引用
                     在 Claude Code 中通过 MCP 工具调用
        channel: 频道代码
        page_index: 页码
        page_size: 每页数量
        **kwargs: 其他搜索参数

    Returns:
        API 响应 JSON

    使用示例（Claude Code MCP 调用）：
        result = query_commodity_from_browser(
            lambda js: mcp_evaluate_js(expression=js),
            channel="RJ", page_index=0, page_size=50
        )
    """
    criteria = build_search_criteria(
        channel=channel,
        page_index=page_index,
        page_size=page_size,
        **kwargs
    )

    js_code = api_post_js(criteria)
    log.info(f"正在通过浏览器查询: {channel} pageIndex={page_index}")

    try:
        result = evaluate_fn(js_code)

        # 解析结果
        if isinstance(result, dict):
            status = result.get("status")
            if status == 200:
                try:
                    data = json.loads(result["responseText"])
                    count = data.get("count", 0)
                    log.info(f"查询成功: 总数={count}")
                    return data
                except json.JSONDecodeError:
                    log.error("响应 JSON 解析失败")
                    return None
            else:
                log.warning(f"请求返回状态码: {status}")
                return None
        elif isinstance(result, str):
            # 直接 JSON 响应
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return None

        return None

    except Exception as e:
        log.error(f"浏览器请求失败: {e}")
        return None


# ═══════════════════════════════════════════
# 结果处理
# ═══════════════════════════════════════════

def extract_results(data: dict) -> List[Dict]:
    """
    从 API 响应中提取商品列表

    Args:
        data: API 响应 JSON

    Returns:
        商品列表
    """
    if not data:
        return []

    result_list_str = data.get("resultList", "[]")
    if isinstance(result_list_str, str):
        return json.loads(result_list_str)
    return result_list_str


def parse_commodity(item: dict) -> Dict:
    """
    解析单个商品信息

    Args:
        item: 商品原始数据

    Returns:
        简化后的商品信息
    """
    resource = item.get("resourceObj", {})
    return {
        "product_name": item.get("productName", ""),
        "manufacturer": item.get("manufactureName", ""),
        "spec": resource.get("spec", ""),
        "material": resource.get("material", ""),
        "price": {
            "basic_price": resource.get("basicPrice", 0),
            "first_price_increment": item.get("firstPriceIncrement", 0),
        },
        "quantity": {
            "balance_quantity": resource.get("balanceQuantity", 0),
            "balance_weight": resource.get("balanceWeight", 0),
        },
        "warehouse": resource.get("warehouseName", ""),
        "delivery_cycle": item.get("deliveryCycle2", ""),
        "provider": {
            "code": item.get("providerCode", ""),
            "name": item.get("providerName", ""),
        },
        "bid": {
            "begin": item.get("bidBeginDate", ""),
            "end": item.get("bidEndDate", ""),
        },
        "resource_id": resource.get("resourceId", ""),
    }


def format_results(data: dict, max_items: int = 10) -> str:
    """
    格式化 API 响应为可读文本

    Args:
        data: API 响应 JSON
        max_items: 最大显示条数

    Returns:
        格式化文本
    """
    if not data:
        return "无数据"

    count = data.get("count", 0)
    items = extract_results(data)

    lines = [
        f"查询结果: 共 {count} 条, 本页 {len(items)} 条",
        "=" * 60,
    ]

    for i, item in enumerate(items[:max_items]):
        resource = item.get("resourceObj", {})
        lines.extend([
            f"\n[{i + 1}] {item.get('productName', 'N/A')}",
            f"    钢厂: {item.get('manufactureName', 'N/A')}",
            f"    仓库: {resource.get('warehouseName', 'N/A')}",
            f"    规格: {resource.get('spec', 'N/A')}",
            f"    材质: {resource.get('material', 'N/A')}",
            f"    基价: {resource.get('basicPrice', 'N/A')} 元/吨",
            f"    重量: {resource.get('balanceWeight', 'N/A')} 吨",
            f"    交期: {item.get('deliveryCycle2', 'N/A')}",
            f"    供应商: {item.get('providerName', 'N/A')}",
            f"    起拍: {item.get('bidBeginDate', 'N/A')}",
            f"    截止: {item.get('bidEndDate', 'N/A')}",
        ])

    if len(items) > max_items:
        lines.append(f"\n... 还有 {len(items) - max_items} 条")

    return "\n".join(lines)


# ═══════════════════════════════════════════
# 独立运行（需要 Camoufox 浏览器 SDK）
# ═══════════════════════════════════════════

def standalone():
    """独立运行模式入口"""
    print("=" * 60)
    print("  欧冶钢材网 - 瑞数逆向求解器")
    print("=" * 60)
    print()

    cookies = load_cookies()
    if cookies:
        print(f"[*] 已找到 {len(cookies)} 个 Cookie")
        print(f"[*] 瑞数 Cookie (T0k1m0u5AfREP): {'✓' if 'T0k1m0u5AfREP' in cookies else '✗'}")
        print(f"[*] 瑞数 Cookie (T0k1m0u5AfREO): {'✓' if 'T0k1m0u5AfREO' in cookies else '✗'}")
    else:
        print("[!] 未找到 Cookie 文件")

    print()
    print("使用方式:")
    print()
    print("  在 Claude Code 中:")
    print("    1. 确保 Camoufox 浏览器已启动: launch_browser()")
    print("    2. 访问目标页面: navigate('https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50')")
    print("    3. 等页面加载完成（瑞数挑战自动解决）")
    print("    4. 调用 query() 函数从浏览器上下文查询 API")
    print()
    print("  示例 JavaScript (在 evaluate_js 中执行):")
    print()
    js_example = """
    // 查询热卷第一页
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/search-ng/commoditySearch/queryCommodityResult', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        console.log('Status:', xhr.status);
        console.log('Count:', JSON.parse(xhr.responseText).count);
    };
    xhr.send('criteriaJson=' + encodeURIComponent(JSON.stringify({
        pageSize: 50, channel: 'RJ', pageIndex: 0, maxPage: 50,
        jsonParam: {channel: 'RJ', keywordAnalyseResult: null}
    })));
    """.strip()
    print(f"  ```js\n  {js_example}\n  ```")
    print()
    print("  分页示例 (第2页):")
    print("  pageIndex=1, pageSize=50")
    print()
    print("  频道代码:")
    print("    RJ - 热卷    LC - 冷轧    ZX - 中厚板")
    print("    GX - 管材    TP - 特钢    PZ - 盘条/棒线")


if __name__ == "__main__":
    standalone()
