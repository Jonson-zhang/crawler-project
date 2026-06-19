"""
mihuashi.com signature provider — calls Node.js WASM signer
Usage: sign(url, timestamp_sec) → signature_string
"""

import subprocess
import os
import time
import functools

_SIGN_JS = os.path.join(os.path.dirname(__file__), "sign.js")


@functools.lru_cache(maxsize=1)
def _check_node():
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except Exception as e:
        raise RuntimeError("Node.js is required for WASM signing") from e


def sign(url: str, timestamp: int = None) -> str:
    """Generate mihuashi API signature for the given URL and timestamp."""
    if timestamp is None:
        timestamp = int(time.time())
    result = subprocess.run(
        ["node", _SIGN_JS, url, str(timestamp)],
        capture_output=True, text=True, timeout=10,
        cwd=os.path.dirname(__file__),
    )
    if result.returncode != 0:
        raise RuntimeError(f"sign failed: {result.stderr.strip()}")
    return result.stdout.strip()


if __name__ == "__main__":
    ts = int(time.time())
    url = "https://www.mihuashi.com/api/v1/configure/vacation"
    sig = sign(url, ts)
    print(f"url={url}")
    print(f"ts={ts}")
    print(f"sig={sig}")
