"""
中国空气质量在线监测分析平台 - 历史数据获取 (MCP 逆向版)
从 https://www.aqistudy.cn/historydata/ 获取指定城市的空气质量历史数据

MCP 逆向过程：
  1. MCP navigate_page → monthdata.php?city=北京
  2. MCP break_on_xhr "historyapi" → 拦截加密请求
  3. MCP get_paused_info frame 2 → 获取全部 AES/DES key + iv (closure scope)
  4. MCP evaluate_script → 获取 AES.encrypt/decrypt.toString() → MD5 密钥派生
  5. MCP evaluate_script → 获取 DES.encrypt/decrypt.toString() → DES 密钥派生
  6. MCP evaluate_script → 获取 poPBVxzNuafY8Yu.toString() → 请求加密全流程
  7. MCP evaluate_script → 获取 dxvERkeEvHbS.toString() → 响应解密全流程
  8. MCP list_network_requests reqid=41 → 验证请求/响应格式

修改 CITY 变量即可切换城市
"""

import json
import sys

import requests

from decrypt_utils import build_encrypted_payload, decrypt_response

# ─── 目标城市（改这里切换）─────────────────────────────────────
CITY = "北海"

# ─── API 端点（MCP reqid=41 确认）──────────────────────────────
_API_URL = "https://www.aqistudy.cn/historydata/api/historyapi.php"

# ─── MCP list_network_requests 确认的请求头 ─────────────────────
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://www.aqistudy.cn",
    "Referer": "https://www.aqistudy.cn/historydata/monthdata.php",
    "X-Requested-With": "XMLHttpRequest",
}


def fetch_city_data(city: str, method: str = "GETMONTHDATA") -> dict | None:
    """
    获取指定城市的空气质量数据

    Args:
        city: 城市名（如 "北京"、"上海"）
        method: API method（MCP frame 2 m0fhOhhGL 确认默认 "GETMONTHDATA"）

    Returns:
        解密后的数据 dict，失败返回 None
    """
    obj = {"city": city}

    # 1. 构建加密请求参数
    encrypted = build_encrypted_payload(method, obj)

    # 2. 发送 POST 请求（Content-Type: x-www-form-urlencoded）
    resp = requests.post(
        _API_URL,
        data={"hA4Nse2cT": encrypted},
        headers=_HEADERS,
    )
    resp.raise_for_status()

    # 3. 解密响应
    decrypted = decrypt_response(resp.text.strip())
    return json.loads(decrypted)


def main() -> None:
    BAR = "=" * 60
    print(BAR)
    print("中国空气质量在线监测分析平台 - 历史数据获取")
    print(f"城市: {CITY}")
    print(BAR)

    print(f"\n[1] 正在请求 {CITY} 的空气质量数据...")
    try:
        data = fetch_city_data(CITY)

        if data is None:
            print("    获取数据失败")
            sys.exit(1)

        success = data.get("success", False)
        if not success:
            print(
                f"    接口返回失败: errcode={data.get('errcode', '')}, errmsg={data.get('errmsg', '')}"
            )
            sys.exit(1)

        result = data.get("result", {})
        datas = result.get("data", {})
        items = datas.get("items", [])
        level = datas.get("level", {})

        print(f"    获取成功，共 {len(items)} 个月的记录\n")

        # 空气质量等级分布
        print("    ─── 等级分布 ───")
        level_names = {
            "level1": "优",
            "level2": "良",
            "level3": "轻度污染",
            "level4": "中度污染",
            "level5": "重度污染",
            "level6": "严重污染",
        }
        for k, v in level.items():
            print(f"      {level_names.get(k, k)}: {v} 个月")

        # 表格式输出每月数据
        print("\n    ─── 逐月数据 ───")
        header = "    {:>8} {:>5} {:>6} {:>6} {:>8} {:>6} {:>6} {:>5} {:>5} {:>5} {:>5}".format(
            "时间", "AQI", "最小值", "最大值", "质量等级", "PM2.5", "PM10", "NO2", "SO2", "CO", "O3"
        )
        print(header)
        print("    " + "-" * 86)
        for item in items:
            tp = item.get("time_point", "")
            aqi = item.get("aqi", "")
            max_a = item.get("max_aqi", "")
            min_a = item.get("min_aqi", "")
            quality = item.get("quality", "")
            pm25 = item.get("pm2_5", "")
            pm10 = item.get("pm10", "")
            no2 = item.get("no2", "")
            so2 = item.get("so2", "")
            co = item.get("co", "")
            o3 = item.get("o3", "")
            print(
                f"    {tp:<8} {aqi:>5} {min_a:>6} {max_a:>6} {quality:<8} {pm25:>6} {pm10:>6} {no2:>5} {so2:>5} {co:>5} {o3:>5}"
            )

    except Exception as exc:
        print(f"    请求失败: {exc}")
        sys.exit(1)

    except Exception as exc:
        print(f"    请求失败: {exc}")
        sys.exit(1)

    print(f"\n{BAR}")
    print("数据获取完成")
    print(BAR)


if __name__ == "__main__":
    main()
