from cloakbrowser import launch

browser = launch(headless=False)
page = browser.new_page()
page.goto("https://www.douyin.com")
input("按 Enter 关闭浏览器...")
browser.close()
