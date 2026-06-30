"""
国家医保局 — 最终纯协议 Python 客户端
======================================
已验证通过: 2026-06-30 返回 code:0, 解密出医院数据

用法: 直接修改下方 CONFIG 中的参数，然后运行:
      python nhsa_client_final.py
"""

import json
import subprocess
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).parent
ENCRYPT_JS = HERE / "gov_nhsa_encrypt.js"
API_URL = "https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"

JS_BOOTSTRAP = ENCRYPT_JS.read_text("utf-8")

# ═══════════════════════════════════════════════════════════════
# 配置区 — 修改这里即可，无需命令行参数
# ═══════════════════════════════════════════════════════════════
CONFIG: dict[str, object] = {
    "keyword": "",          # 医疗机构名称，空=全部
    "regn_code": "110000",  # 行政区划 (110000=北京, 310000=上海)
    "pages": 5,             # 获取页数
    "page_size": 10,        # 每页条数
    "addr": "",             # 地址筛选 (空=全部)
    "level": "",            # 等级代码 (空=全部)
    "type": "",             # 类型代码 (空=全部)
    "elec": "",             # 电子凭证 (空=全部, 1=已开通)
    "json_output": False,   # True=JSON输出, False=表格输出
}
# ═══════════════════════════════════════════════════════════════


def js_call(func_name: str, *args: object) -> dict:
    """调用 gov_nhsa_encrypt.js 中的函数"""
    args_json = json.dumps(list(args), ensure_ascii=False)
    node_script = (
        f"{JS_BOOTSTRAP}\n"
        f"var _result = {func_name}.apply(null, JSON.parse({json.dumps(args_json)}));\n"
        "console.log(JSON.stringify(_result));\n"
    )
    tmp_file = HERE / "_nhsa_tmp.js"
    tmp_file.write_text(node_script, encoding="utf-8")
    try:
        r = subprocess.run(
            ["node", str(tmp_file)],
            capture_output=True, text=True, cwd=str(HERE), timeout=30,
            encoding="utf-8", errors="replace",
        )
        for line in r.stdout.strip().split("\n"):
            line = line.strip()
            if line.startswith("{"):
                try:
                    return json.loads(line)
                except json.JSONDecodeError:
                    pass
        err = r.stderr or r.stdout or ""
        raise RuntimeError(f"JS call failed: {err[:200]}")
    finally:
        tmp_file.unlink(missing_ok=True)


print("[Nhsa] Encryption JS ready.", file=sys.stderr)


class NhsaClient:
    """国家医保局 API 客户端"""

    BASE_HEADERS: dict[str, str] = {
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "channel": "web",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua": '"Chromium";v="21", " Not;A Brand";v="99"',
        "sec-ch-ua-platform": '"Windows"',
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36"
        ),
        "Origin": "https://fuwu.nhsa.gov.cn",
        "Referer": "https://fuwu.nhsa.gov.cn/nationalHallSt/",
        "X-Tingyun": "c=B|4Nl_NnGbjwY;x=dbaf776fd2154ec1",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    def __init__(self) -> None:
        self.session = requests.Session()

    def search(
        self,
        medins_name: str = "",
        regn_code: str = "110000",
        page_num: int = 1,
        page_size: int = 10,
        *,
        addr: str = "",
        medins_lv_code: str = "",
        medins_type_code: str = "",
        open_elec: str = "",
        query_data_source: str = "es",
    ) -> dict:
        """查询医疗机构 (单页)"""
        params: dict[str, object] = {
            "addr": addr,
            "regnCode": regn_code,
            "medinsName": medins_name,
            "medinsLvCode": medins_lv_code,
            "medinsTypeCode": medins_type_code,
            "openElec": open_elec,
            "pageNum": page_num,
            "pageSize": page_size,
            "queryDataSource": query_data_source,
        }
        print(
            f"[Nhsa] Page {page_num}: medinsName='{medins_name}', regn={regn_code}",
            file=sys.stderr,
        )
        encrypted = js_call(
            "EncryptedData", params, "/nthl/api/CommQuery/queryFixedHospital"
        )

        headers = {**self.BASE_HEADERS}
        headers["x-tif-timestamp"] = str(encrypted["headers"]["x-tif-timestamp"])
        headers["x-tif-nonce"] = str(encrypted["headers"]["x-tif-nonce"])
        headers["x-tif-signature"] = str(encrypted["headers"]["x-tif-signature"])
        headers["x-tif-paasid"] = str(
            encrypted["headers"].get("x-tif-paasid", "undefined")
        )
        headers["contentType"] = str(
            encrypted["headers"].get("contentType", "application/x-www-form-urlencoded")
        )

        body = json.dumps({"data": encrypted["data"]}, separators=(",", ":"))

        print(
            f"[Nhsa] x-tif-sig: {headers['x-tif-signature'][:16]}...",
            file=sys.stderr,
        )

        resp = self.session.post(API_URL, headers=headers, data=body, timeout=30)
        result: dict = resp.json()

        code = result.get("code", -1)
        msg = result.get("message", "")
        print(f"[Nhsa] Response: code={code} msg={msg}", file=sys.stderr)

        if code == 0:
            try:
                decrypted = js_call("DecryptedData", result)
                result["_decrypted"] = decrypted
                total = decrypted.get("total", len(decrypted.get("list", [])))
                print(f"[Nhsa] Decrypted: {total} results", file=sys.stderr)
            except RuntimeError as e:
                print(f"[Nhsa] Decrypt error: {e}", file=sys.stderr)

        return result

    def search_pages(
        self,
        medins_name: str = "",
        regn_code: str = "110000",
        pages: int = 1,
        page_size: int = 10,
        **kwargs: object,
    ) -> list[dict]:
        """查询医疗机构 (多页)，kwargs 透传 search 的全部参数"""
        all_results: list[dict] = []
        for p in range(1, pages + 1):
            result = self.search(medins_name, regn_code, p, page_size, **kwargs)
            all_results.append(result)
        return all_results

    def close(self) -> None:
        self.session.close()


def main() -> None:
    kw = str(CONFIG["keyword"])
    regn = str(CONFIG["regn_code"])
    pages = int(CONFIG["pages"])
    size = int(CONFIG["page_size"])
    json_out = bool(CONFIG["json_output"])

    extra: dict[str, str] = {}
    for key in ("addr", "level", "type", "elec"):
        val = str(CONFIG.get(key, ""))
        if val:
            mapping = {"level": "medins_lv_code", "type": "medins_type_code", "elec": "open_elec"}
            extra[mapping.get(key, key)] = val

    client = NhsaClient()
    try:
        results = client.search_pages(kw, regn, pages, size, **extra)

        if json_out:
            output: dict[str, object] = {
                "pages": len(results), "results": [],
            }
            for r in results:
                item = {k: v for k, v in r.items() if k not in ("_decrypted",)}
                if r.get("_decrypted"):
                    item["decrypted"] = r["_decrypted"]
                output["results"].append(item)
            print(json.dumps(output, ensure_ascii=False, indent=2))
            return

        all_items: list[dict] = []
        grand_total = 0
        errors = 0

        for i, r in enumerate(results, 1):
            if r.get("code") != 0:
                print(f"第 {i} 页失败: code={r.get('code')}, {r.get('message')}")
                errors += 1
                continue
            dec: dict = r.get("_decrypted", {})
            items: list = dec.get("list", [])
            all_items.extend(items)
            if grand_total == 0:
                grand_total = dec.get("total", len(items))

        if errors == len(results):
            print("\n所有页面请求均失败")
            return

        print(
            f"\n查询完成! 共 {grand_total} 条结果，实际获取 {len(all_items)} 条"
            f" (跨越 {pages} 页)\n"
        )

        for item in all_items:
            name = item.get("medinsName", item.get("medName", "?"))
            addr = item.get("addr", "")
            lv = item.get("medinsLvName", item.get("medLevelName", ""))
            typ = item.get("medinsTypeName", item.get("medTypeName", ""))
            print(f"  {name} ({typ}, {lv})")
            if addr:
                print(f"    {addr[:80]}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
