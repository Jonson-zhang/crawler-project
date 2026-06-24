from cloakbrowser import launch

browser = launch(headless=False)
context = browser.new_context()
page = context.new_page()

# ── CDP 自动跳过所有 debugger ──
cdp = context.new_cdp_session(page)
cdp.send("Debugger.enable")
cdp.on("Debugger.paused", lambda params: cdp.send("Debugger.resume"))
print("✅ CDP Debugger.resume 已激活")

page.goto("https://zbzx.lzjtu.edu.cn/zbxx/hwl.htm")
input("按 Enter 关闭浏览器...")
browser.close()
