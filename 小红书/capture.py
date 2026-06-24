"""
Phase 1: 抓取小红书 homefeed 请求 + 签名 JS
"""
import json, time
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUT_DIR = BASE_DIR / "data"
OUT_DIR.mkdir(exist_ok=True)


def capture():
    from cloakbrowser import launch

    b = launch(headless=False)
    p = b.new_page()

    # 拦截网络请求
    homefeed_headers = []

    def _on_request(request):
        if "homefeed" in request.url:
            homefeed_headers.append(dict(request.headers))

    try:
        p.on("request", _on_request)
    except Exception:
        pass

    print("[*] 导航到 https://www.xiaohongshu.com/explore ...")
    p.goto("https://www.xiaohongshu.com/explore", timeout=30000)
    time.sleep(5)

    # 关闭登录弹窗
    try:
        p.evaluate("""(() => {
            const btn = document.querySelector('.close-button, [class*=\"close\"]');
            if (btn) btn.click();
        })()""")
        print("[*] 尝试关闭登录弹窗")
    except Exception:
        pass
    time.sleep(2)

    # 滚动触发 homefeed
    print("[*] 滚动页面触发加载...")
    for i in range(10):
        p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)
        print(f"  滚动 {i + 1}/10")

    # 获取请求头样本
    if homefeed_headers:
        h = homefeed_headers[0]
        (OUT_DIR / "homefeed_headers.json").write_text(
            json.dumps(h, ensure_ascii=False, indent=2), "utf-8",
        )
        print("\n[+] 签名请求头样本:")
        for k in ["x-s", "x-t", "x-s-common", "x-b3-traceid", "x-mini-gid", "x-legacy-smid", "x-legacy-did", "x-legacy-fid"]:
            if k in h:
                print(f"    {k}: {h[k][:100]}")

    # 搜索 seccore_signv2 所在脚本
    print("\n[*] 搜索签名代码...")
    scripts_info = p.evaluate("""(() => {
        const r = [];
        for (const s of document.scripts) {
            if (s.src && s.text && s.text.includes('seccore_signv2')) {
                r.push({url: s.src, len: s.text.length});
            }
        }
        return r;
    })()""")

    if scripts_info:
        print(f"  找到 {len(scripts_info)} 个包含 seccore_signv2 的脚本:")
        for s in scripts_info:
            print(f"    {s['url'][:120]} ({s['len']} 字节)")

    # 获取所有脚本 URL
    all_scripts = p.evaluate("""(() => {
        return [...document.scripts].filter(s => s.src).map(s => s.src);
    })()""")
    (OUT_DIR / "all_scripts.json").write_text(
        json.dumps(all_scripts, ensure_ascii=False, indent=2), "utf-8",
    )
    print(f"\n[*] 共 {len(all_scripts)} 个外部脚本")

    # 保存 cookie
    cookies_list = p.context.cookies()
    (OUT_DIR / "cookies.json").write_text(
        json.dumps({c["name"]: c["value"] for c in cookies_list}, ensure_ascii=False, indent=2),
        "utf-8",
    )
    print(f"[*] 已保存 {len(cookies_list)} 个 Cookie")

    input("\n>>> 按 Enter 关闭浏览器...")
    b.close()
    print("[OK] 完成")


if __name__ == "__main__":
    capture()
