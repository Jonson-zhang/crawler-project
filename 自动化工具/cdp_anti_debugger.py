"""
CDP 自动恢复脚本 — 配合 Playwright 使用

原理：通过 CDP 监听 Debugger.paused 事件，自动发送 Debugger.resume。
这可以绕过 ANY 形式的 debugger（包括 HTML 解析器加载的外部 JS 文件中的）。

使用方式：
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # 创建 CDP session
        cdp = context.new_cdp_session(page)

        # 方式 A：使用本模块
        from cdp_anti_debugger import enable_auto_resume
        enable_auto_resume(cdp)

        # 方式 B：直接写
        cdp.on('Debugger.paused', lambda params: cdp.send('Debugger.resume'))

        page.goto('https://目标站点')
        # debugger 会被自动跳过，不会阻断执行
"""

import logging

logger = logging.getLogger(__name__)


def enable_auto_resume(cdp_session, max_resume: int = 1000, log_resume: bool = True):
    """
    启用 CDP 自动恢复：拦截所有 debugger 暂停并自动 resume。

    Args:
        cdp_session: Playwright CDPSession 对象
        max_resume: 最大恢复次数（防止死循环耗尽资源），设为 0 表示无限
        log_resume: 是否打印恢复日志
    """
    resume_count = [0]  # 用列表包装以便在闭包中修改

    def on_paused(params):
        resume_count[0] += 1
        reason = params.get('reason', 'unknown')

        if max_resume > 0 and resume_count[0] > max_resume:
            logger.warning(f'CDP 自动恢复已达上限 ({max_resume})，停止恢复')
            cdp_session.remove_listener('Debugger.paused', on_paused)
            return

        if log_resume:
            call_frames = params.get('callFrames', [])
            if call_frames:
                top = call_frames[0]
                loc = f"{top.get('url','')}:{top.get('location',{}).get('lineNumber','?')}"
                logger.info(f'[{resume_count[0]}] CDP auto-resume | reason={reason} | {loc}')
            else:
                logger.info(f'[{resume_count[0]}] CDP auto-resume | reason={reason}')

        try:
            cdp_session.send('Debugger.resume')
        except Exception as e:
            logger.error(f'CDP resume 失败: {e}')

    cdp_session.on('Debugger.paused', on_paused)
    logger.info('CDP 自动恢复已启用')


def enable_auto_resume_silent(cdp_session, max_resume: int = 1000):
    """静默版本，不打印任何日志"""
    enable_auto_resume(cdp_session, max_resume=max_resume, log_resume=False)


# ── 快捷入口：直接从 CDP session 启用 ──
def install(cdp_session, silent: bool = False):
    """快捷安装"""
    enable_auto_resume(cdp_session, log_resume=not silent)
