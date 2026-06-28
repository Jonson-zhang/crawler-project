"""
今日头条 — 财经频道 API (iv8 新版 SDK)

用法:
    from toutiao_api import ToutiaoFeed
    feed = ToutiaoFeed()
    articles = feed.fetch_finance()
    feed.fetch_finance(channel="3189399007", page="0")

直接运行:
    python toutiao_api.py
"""

import sys
from pathlib import Path

import requests

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from toutiao_iv8 import ToutiaoSigner

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"

# 频道 ID 和显示文章数（改这里即可）
CHANNEL_ID = "3189399007"
DISPLAY_COUNT = 15


class ToutiaoFeed:
    """今日头条文章列表获取器"""

    def __init__(self):
        self._signer = ToutiaoSigner()
        self._session = requests.Session()
        self._session.headers.update(
            {
                "user-agent": UA,
                "referer": "https://www.toutiao.com/",
                "accept-language": "zh-CN,zh;q=0.9",
                "accept": "application/json, text/plain, */*",
            }
        )

    def _register_ttwid(self):
        self._session.post(
            "https://ttwid.bytedance.com/ttwid/union/register/",
            json={
                "region": "cn",
                "aid": 24,
                "needFid": False,
                "service": "www.toutiao.com",
                "migrate_info": {"ticket": "", "source": "node"},
                "cbUrlProtocol": "https",
                "union": True,
            },
        )

    def _get_mstoken(self, channel, page):
        resp = self._session.get(
            "https://www.toutiao.com/api/pc/list/feed",
            params={
                "channel_id": channel,
                "max_behot_time": page,
                "category": "pc_profile_channel",
                "aid": "24",
                "app_name": "toutiao_web",
            },
        )
        return resp.headers.get("x-ms-token", "")

    def _generate_abogus(self, channel, page, ms_token):
        params = {
            "channel_id": channel,
            "max_behot_time": page,
            "category": "pc_profile_channel",
            "aid": "24",
            "app_name": "toutiao_web",
            "msToken": ms_token,
        }
        return self._signer.sign(params)

    def fetch(self, channel=CHANNEL_ID, page="0"):
        self._register_ttwid()
        ms = self._get_mstoken(channel, page)
        if not ms:
            return None
        ab = self._generate_abogus(channel, page, ms)
        if not ab:
            return None
        resp = self._session.get(
            "https://www.toutiao.com/api/pc/list/feed",
            params={
                "channel_id": channel,
                "max_behot_time": page,
                "category": "pc_profile_channel",
                "aid": "24",
                "app_name": "toutiao_web",
                "msToken": ms,
                "a_bogus": ab,
            },
        )
        if resp.status_code == 200 and len(resp.content) > 100:
            return resp.json()
        return None

    def close(self):
        self._signer.close()


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print(f"今日头条 - 财经频道 (iv8) channel={CHANNEL_ID}")
    print("=" * 60)

    feed = ToutiaoFeed()
    try:
        data = feed.fetch()
        if data and data.get("data"):
            articles = data["data"]
            print(f"{len(articles)} 篇文章  has_more={data.get('has_more')}")
            print("-" * 60)
            for i, a in enumerate(articles[:DISPLAY_COUNT], 1):
                title = (a.get("title") or a.get("Abstract") or "")[:100]
                url = a.get("article_url") or a.get("display_url") or ""
                print(f"{i:2}. {title}")
                if url:
                    print(f"    {url}")
        else:
            print("FAILED")
    finally:
        feed.close()
