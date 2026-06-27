"""
Boss直聘 — 入口

用法：
  python main.py                            # 搜北京 Python
  python main.py 101010100 java             # 搜北京 Java
  python main.py 101280600 前端              # 搜深圳前端

方案：
  iv8/   — iv8 (C++ V8 + 原生浏览器 API) → code=0 ✅
  reverse_work/   — 逆向全过程记录（20 轮补环境 + VMP 分析 + 浏览器 trace）

依赖：
  pip install iv8 requests
"""

import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent / "iv8"))
from boss_iv8 import search_jobs

if __name__ == "__main__":
    city = sys.argv[1] if len(sys.argv) > 1 else "101010100"
    query = sys.argv[2] if len(sys.argv) > 2 else "python"
    print(f"Boss直聘 — 搜索: city={city}, query={query}")
    print("=" * 60)
    search_jobs(city, query)
