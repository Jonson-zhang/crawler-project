"""
后台文件监控 — 检测东航/、好医生/ 及配置文件的变更，自动 git add + commit + push
启动方式: python .githooks/auto-watch.py
"""
import subprocess, time, os, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WATCH_DIRS = [
    ROOT / "东航",
    ROOT / "好医生",
    ROOT / ".claude",
    ROOT / ".githooks",
    ROOT / ".vscode",
]
WATCH_FILES = [
    ROOT / ".mcp.json",
    ROOT / "pyproject.toml",
    ROOT / "CLAUDE.md",
]
IGNORE = {".git", "node_modules", ".venv", "__pycache__", "browser_data",
          "cookies.json", "state.json", "scheduled_tasks.json", "*.pyc"}

def get_file_hash(path):
    """return sha256 of file content, or None"""
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except Exception:
        return None

def snapshot():
    """return {relpath: hash} for all tracked files"""
    files = {}
    for d in WATCH_DIRS:
        if not d.exists():
            continue
        for f in d.rglob("*"):
            if f.is_file() and not any(
                part in IGNORE or f.match(pat) for part in f.parts for pat in IGNORE
            ):
                files[str(f.relative_to(ROOT))] = get_file_hash(f)
    for f in WATCH_FILES:
        if f.exists():
            files[str(f.relative_to(ROOT))] = get_file_hash(f)
    return files

def git_commit_push():
    """stage all, commit if anything staged, push"""
    r = subprocess.run(
        ["git", "add", "-A"], cwd=str(ROOT),
        capture_output=True, text=True, timeout=30,
    )
    r = subprocess.run(
        ["git", "commit", "-m",
         f"auto: sync [{time.strftime('%m-%d %H:%M')}]"],
        cwd=str(ROOT), capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0:
        if "nothing to commit" in (r.stdout + r.stderr):
            return False
        return False
    # push（先 pull 再 push，避免竞态冲突）
    r = subprocess.run(
        ["git", "pull", "--rebase", "origin", "main"],
        cwd=str(ROOT), capture_output=True, text=True, timeout=30,
    )
    r = subprocess.run(
        ["git", "push"], cwd=str(ROOT),
        capture_output=True, text=True, timeout=60,
    )
    print(f"[auto-watch] committed & pushed at {time.strftime('%H:%M:%S')}")
    print(f"[auto-watch] commit: {r.stdout.strip()[-120:]}")
    return True

def main():
    print(f"[auto-watch] started, watching: {', '.join(str(d.relative_to(ROOT)) for d in WATCH_DIRS)}")
    last_snapshot = snapshot()
    last_push = time.time()
    PUSH_INTERVAL = 300  # 最短推送间隔（秒），与检测周期一致

    while True:
        time.sleep(300)  # 每 5 分钟检测一次
        current = snapshot()
        if current != last_snapshot:
            # 有变更 → 等 5 秒让写入完成，然后提交
            time.sleep(5)
            current = snapshot()
            if current == last_snapshot:
                continue  # 瞬时变化，忽略
            if time.time() - last_push < PUSH_INTERVAL:
                continue  # 间隔太短，合并到下次
            last_snapshot = current
            if git_commit_push():
                last_push = time.time()

if __name__ == "__main__":
    main()
