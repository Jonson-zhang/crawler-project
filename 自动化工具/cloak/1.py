from cloakbrowser import launch

browser = launch(headless=False, humanize=True)
page = browser.new_page()
page.goto("https://www.douyin.com")
