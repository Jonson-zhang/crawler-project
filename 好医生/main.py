"""
好医生 CME 自动化
用法: python bot.py <课程URL> --headless
"""
import re
import json
import time
import sys
import io
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SD = Path(__file__).parent
STATE = SD / "state.json"
COOKIES = SD / "cookies.json"

MULTI_ORDER = [
    "ABCDE", "BCDE", "ACDE", "ABDE", "ABCE", "ABCD",
    "CDE", "BDE", "BCE", "BCD", "ADE", "ACE", "ACD",
    "ABE", "ABD", "ABC", "DE", "CE", "CD", "BE", "BD",
    "BC", "AE", "AD", "AC", "AB", "E", "D", "C", "B", "A",
]

BASE_URL = "https://www.cmechina.net/cme"

# ═══════════════════════════════════════════════════════
# 状态持久化
# ═══════════════════════════════════════════════════════

def load_state():
    """读取 state.json，返回 {"done": [...]}"""
    if not STATE.exists():
        return {"done": []}
    try:
        data = json.loads(STATE.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "done" in data:
            return data
    except (json.JSONDecodeError, FileNotFoundError, ValueError):
        pass
    return {"done": []}


def is_done(course_id, name):
    """检查课时是否已完成"""
    key = f"{course_id}:{name}"
    return key in load_state().get("done", [])


def mark_done(course_id, name):
    """标记课时完成"""
    st = load_state()
    key = f"{course_id}:{name}"
    if key not in st["done"]:
        st["done"].append(key)
        STATE.write_text(
            json.dumps(st, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


# ═══════════════════════════════════════════════════════
# 考试核心逻辑
# ═══════════════════════════════════════════════════════

def _iterate_answers(page, qn):
    """
    在 examQuizFail 页自循环找全正确答案。
    用 location.replace() 避免堆积浏览器历史。
    返回 ans_list 或 None。
    """
    last_dui = -1
    for _ in range(50):
        info = page.evaluate("""
            () => {
                var h3s = document.querySelectorAll('.answer_list h3'), cuo = -1, dui = 0;
                for (var j = 0; j < h3s.length; j++) {
                    if (cuo === -1 && h3s[j].className.indexOf('cuo') !== -1) cuo = j;
                    if (h3s[j].className.indexOf('dui') !== -1) dui++;
                }
                var p = location.search.substring(1).split('&'), ans = '';
                for (var k = 0; k < p.length; k++)
                    if (p[k].indexOf('ansList=') === 0) ans = decodeURIComponent(p[k].substring(8));
                return {cuo: cuo, dui: dui, ans: ans, url: location.href};
            }
        """)

        if info["dui"] > last_dui:
            last_dui = info["dui"]
            print(f" [{info['dui']}/{qn}] {info['ans']}", end="", flush=True)

        if info["cuo"] < 0:
            return info["ans"].split(',')

        ans_list = info["ans"].split(',')
        cur = ans_list[info["cuo"]]

        # 递增第一个错题
        if len(cur) == 1:
            if cur == "E":
                return None
            ans_list[info["cuo"]] = chr(ord(cur) + 1)
        elif cur in MULTI_ORDER:
            pos = MULTI_ORDER.index(cur)
            if pos >= len(MULTI_ORDER) - 1:
                return None
            ans_list[info["cuo"]] = MULTI_ORDER[pos + 1]
        else:
            ans_list[info["cuo"]] = "ABCDE"

        # location.replace() 不添加浏览器历史
        new_url = info["url"].replace(info["ans"], ','.join(ans_list))
        page.evaluate(f"() => {{ location.replace('{new_url}') }}")
        time.sleep(0.3)

    return None


def solve_exam(page, course_id):
    """
    完成一门考试：
    1. 全A提交 → examQuizFail
    2. fail页自循环找全部正确答案（location.replace）
    3. go_back 回原表单（历史未被污染）
    4. 填正确答案 → doSubmit → 验证通过
    """
    # 等题目加载
    for _ in range(15):
        n = page.evaluate("() => document.querySelectorAll('.exam_list li, .kaoshi dl').length")
        if n > 0:
            break
        if "已通过" in page.evaluate("() => (document.body.innerText || '')"):
            return True
        time.sleep(0.5)

    # 等 form1 就绪
    for _ in range(15):
        if page.evaluate("() => !!document.form1 && !!document.form1.ques_list"):
            break
        if "已通过" in page.evaluate("() => (document.body.innerText || '')"):
            return True
        time.sleep(0.5)
    else:
        return False

    qn = page.evaluate("() => document.form1.ques_list.value.split(',').length")
    print(f"     {qn}题...", end="", flush=True)

    # 全A提交
    page.evaluate("""
        () => {
            var ids = document.form1.ques_list.value.split(',');
            for (var i = 0; i < ids.length; i++)
                document.getElementsByName('ques_' + ids[i])[0].checked = true;
            doSubmit();
        }
    """)
    time.sleep(2)
    for _ in range(15):
        if "Quiz" in page.evaluate("() => location.href"):
            break
        time.sleep(0.5)

    u = page.evaluate("() => location.href")
    if "examQuizPass" in u:
        return True
    if "examQuizFail" not in u:
        return False

    # 自循环找答案
    ans_list = _iterate_answers(page, qn)
    if ans_list is None:
        return False

    ans_str = ','.join(ans_list)
    print(f" -> go_back({ans_str})...", end="", flush=True)

    # go_back 回到 exam.jsp（历史没被 location.replace 污染）
    page.go_back(wait_until="domcontentloaded", timeout=10000)
    time.sleep(1)

    if page.evaluate("() => !!document.form1 && !!document.form1.ques_list"):
        page.evaluate(f"""
            () => {{
                var ids = document.form1.ques_list.value.split(',');
                var a = '{ans_str}'.split(',');
                for (var i = 0; i < ids.length; i++) {{
                    var idx = {{A:0,B:1,C:2,D:3,E:4}}[a[i][0]] || 0;
                    document.getElementsByName('ques_' + ids[i])[idx].checked = true;
                }}
                doSubmit();
            }}
        """)
        time.sleep(2)
        u2 = page.evaluate("() => location.href")
        if "examQuizPass" in u2:
            print(" ✓", flush=True)
            return True

    # go_back 失败 → 降级到 study2 重进考试
    print(" 降级...", end="", flush=True)
    paper_id = page.evaluate(
        "() => new URLSearchParams(location.search).get('paper_id') || '01'"
    )
    page.goto(
        f"{BASE_URL}/study2.jsp?course_id={course_id}&courseware_id={paper_id}",
        wait_until="commit",
        timeout=15000,
    )
    time.sleep(2)
    page.evaluate("() => { try { window.gotoExam(); } catch(e) {} }")
    time.sleep(3)

    for _ in range(15):
        if page.evaluate("() => !!document.form1 && !!document.form1.ques_list"):
            break
        if "已通过" in page.evaluate("() => (document.body.innerText || '')"):
            return True
        time.sleep(1)

    # 用已知答案提交（可能换题需要重解）
    page.evaluate(f"""
        () => {{
            var ids = document.form1.ques_list.value.split(',');
            var a = '{ans_str}'.split(',');
            for (var i = 0; i < ids.length; i++) {{
                var idx = {{A:0,B:1,C:2,D:3,E:4}}[a[i][0]] || 0;
                document.getElementsByName('ques_' + ids[i])[idx].checked = true;
            }}
            doSubmit();
        }}
    """)
    time.sleep(2)

    u2 = page.evaluate("() => location.href")
    if "examQuizPass" in u2:
        print(" ✓", flush=True)
        return True
    if "examQuizFail" in u2:
        return solve_exam(page, course_id)

    print(" ✓", flush=True)
    return True


def skip_video(page):
    """跳到视频末尾并标记完成"""
    page.evaluate("""
        () => {
            var p = window.player || window.cc_js_Player;
            if (p) {
                try {
                    var d = p.getDuration();
                    p.jumpToTime(d - 0.5);
                    p.play();
                } catch (e) {}
            } else {
                var v = document.querySelector('.pv-video') || document.querySelector('video');
                if (v) { v.currentTime = v.duration; v.play(); }
            }
            if (window.see) localStorage.setItem('see', '1');
            if (window.see2) localStorage.setItem('see2', '9');
        }
    """)


def scan_sidebar(page):
    """扫描侧栏全部课时"""
    return page.evaluate("""
        () => {
            const items = document.querySelectorAll(
                '#s_r_ml li, .s_r_ml li, li'
            );
            return Array.from(items)
                .filter(function(li) {
                    var t = li.innerText || li.textContent || '';
                    return t.includes('第') && t.includes('节');
                })
                .map(function(li) {
                    var t = li.innerText || li.textContent || '';
                    var iTag = li.querySelector('i');
                    var tag = iTag ? (iTag.innerText || iTag.textContent || '').trim() : '';
                    var v = '未学习', e = '未考试';
                    if (tag.includes('考试通过') || tag.includes('已完成')) {
                        v = '已学习'; e = '已考试';
                    } else if (tag.includes('待考试')) {
                        v = '已学习'; e = '待考试';
                    }
                    var a = li.querySelector('a');
                    var oc = a ? a.getAttribute('onclick') || '' : '';
                    var m = oc.match(/courseware_id=(\\d+)/);
                    return {
                        name: t.split(/\\s+/)[0] || t.trim(),
                        video: v,
                        exam: e,
                        cw: m ? m[1] : '',
                    };
                });
        }
    """)


# ═══════════════════════════════════════════════════════
# 主循环
# ═══════════════════════════════════════════════════════

def run(page, course_url):
    """主入口：加载课程 → 扫描课时 → 逐个处理"""
    m = re.search(r"course_id=(\d+)", course_url)
    course_id = m.group(1) if m else "?"

    print("  ▸ 加载...", end="", flush=True)
    page.goto(course_url, wait_until="commit", timeout=15000)
    time.sleep(3)
    print(" ✓", flush=True)

    lessons = scan_sidebar(page)
    total = len(lessons)
    if total == 0:
        print("  ❌ 未找到课程列表\n")
        return

    # ── 课程名称 + 授课老师 + 所在单位 ──
    course_title = page.evaluate("() => document.title") or ""
    teacher = page.evaluate("""
        () => {
            var body = document.body.innerText || '';
            var m = body.match(/(?:项目)?负责人[：:]\\s*(\\S+)/);
            return m ? m[1] : '';
        }
    """)

    # 教师单位从 course.jsp 获取（study2.jsp 上没有）
    teacher_unit = ""
    if teacher and course_id != "?":
        try:
            page.goto(
                f"{BASE_URL}/course.jsp?course_id={course_id}",
                wait_until="commit",
                timeout=10000,
            )
            time.sleep(1.5)
            teacher_unit = page.evaluate("""
                () => {
                    var body = document.body.innerText || '';
                    var m = body.match(/负责人单位[：:]\\s*(\\S+)/);
                    return m ? m[1] : '';
                }
            """)
        except Exception:
            pass

    course_name = f"「{course_title}」"
    if teacher:
        course_name += f"  |  授课老师：{teacher}"
        if teacher_unit:
            course_name += f"（{teacher_unit}）"

    # 检查是否全部完成
    all_pass = all(
        (lesson["exam"] == "已考试" or is_done(course_id, lesson["name"]))
        for lesson in lessons
    )
    if all_pass:
        print(f"\n  ✅ {course_name}")
        print(f"     共 {total} 节课，全部已完成学习并通过考试\n")
        return

    video_done = sum(1 for x in lessons if x["video"] == "已学习")
    exam_done = sum(1 for x in lessons if x["exam"] == "已考试")
    print(f"\n  📚 {course_name}")
    print(f"     共 {total} 节  视频已学:{video_done}  考试通过:{exam_done}")

    for j, lesson in enumerate(lessons):
        vid = "✓" if lesson["video"] == "已学习" else "○"
        exm = "✓" if lesson["exam"] == "已考试" else (
            "△" if lesson["exam"] == "待考试" else "○"
        )
        done_mark = " ✓" if is_done(course_id, lesson["name"]) else ""
        print(f"  [{j + 1:>2}] {vid}{exm} {lesson['name']}{done_mark}")
    print()

    count = 0
    fail_count = 0
    for i, lesson in enumerate(lessons):
        name = lesson["name"]

        if is_done(course_id, name):
            continue

        cw = lesson.get("cw") or f"0{i + 1:02d}"
        page.goto(
            f"{BASE_URL}/study2.jsp?course_id={course_id}&courseware_id={cw}",
            wait_until="commit",
            timeout=15000,
        )
        time.sleep(2)

        count += 1
        print(f"  [{count}/{total}] {name}")

        if lesson["exam"] == "待考试":
            print("  ▸ 考试...", end="", flush=True)
            page.evaluate("() => { try { window.gotoExam(); } catch(e) {} }")
            time.sleep(3)
        else:
            print("  ▸ 视频...", end="", flush=True)
            skip_video(page)
            time.sleep(1.5)
            page.reload(wait_until="commit")
            time.sleep(1)
            print(" ✓", flush=True)
            print("  ▸ 考试...", end="", flush=True)
            page.evaluate("() => { try { window.gotoExam(); } catch(e) {} }")
            time.sleep(3)

        for _ in range(15):
            qn = page.evaluate(
                "() => document.querySelectorAll('.exam_list li, .kaoshi dl').length"
            )
            if qn > 0:
                break
            body = page.evaluate("() => (document.body.innerText || '')")
            if "已通过" in body:
                mark_done(course_id, name)
                break
            time.sleep(1)

        if is_done(course_id, name):
            print(" 已通过 ✓\n")
            continue

        ok = solve_exam(page, course_id)
        if ok:
            mark_done(course_id, name)
            print("  ✅\n", flush=True)
        else:
            fail_count += 1
            print("  ❌\n", flush=True)

    st = load_state()
    ok_cnt = sum(1 for x in st.get("done", []) if x.startswith(course_id))
    print(f"  {'=' * 60}")
    if ok_cnt == total:
        print(f"  ✅ {course_name}")
        print(f"     共 {total} 节，全部已完成学习并通过考试")
    else:
        print(f"  已完成 {ok_cnt}/{total}，失败 {fail_count}")
    print(f"  {'=' * 60}\n")


# ═══════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="好医生 CME 自动化")
    parser.add_argument("url", nargs="?", help="课程 URL 或 course_id")
    parser.add_argument("--headless", action="store_true", help="无头模式（已是默认）")
    parser.add_argument("--show", action="store_true", help="显示浏览器窗口")
    args = parser.parse_args()

    headless = not args.show

    # 构造 URL
    if args.url:
        if args.url.isdigit():
            url = f"{BASE_URL}/study2.jsp?course_id={args.url}&courseware_id=01"
        elif args.url.startswith("http"):
            url = args.url
        else:
            url = f"{BASE_URL}/study2.jsp?course_id={args.url}&courseware_id=01"
    else:
        inp = input("URL or course_id: ").strip()
        if not inp:
            return
        if inp.isdigit():
            url = f"{BASE_URL}/study2.jsp?course_id={inp}&courseware_id=01"
        elif inp.startswith("http"):
            url = inp
        else:
            url = f"{BASE_URL}/study2.jsp?course_id={inp}&courseware_id=01"

    # 加载 Cookie
    if COOKIES.exists():
        cookies = json.loads(COOKIES.read_text(encoding="utf-8"))
    else:
        cookies = {}

    mode = "Cookie" if cookies else "Browser"
    head = "无头" if headless else "可见"
    print(f"  🚀 好医生 CME | {mode} | {head}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            ),
        )
        context.add_cookies([
            {"name": k, "value": v, "domain": ".cmechina.net", "path": "/"}
            for k, v in cookies.items() if v
        ])
        try:
            page = context.new_page()
            run(page, url)
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
