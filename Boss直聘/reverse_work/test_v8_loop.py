"""Test v8 token 5 times — check if random crypto values lead to success"""
import curl_cffi.requests as requests, time, subprocess

for run in range(1, 6):
    session = requests.Session()
    ts_sec = int(time.time())
    sid = str(ts_sec)[-8:] + str(int(time.time() * 1000) % 100000000).zfill(8)
    __a = f'{sid}.{ts_sec}..{ts_sec}.2.1.2.2'
    __c = str(ts_sec)

    session.cookies.set('__a', __a, domain='.zhipin.com')
    session.cookies.set('__c', __c, domain='.zhipin.com')
    session.cookies.set('__g', '-', domain='.zhipin.com')
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',
    })

    ts = int(time.time() * 1000)
    r1 = session.get('https://www.zhipin.com/wapi/zpgeek/search/joblist.json',
        params={'city': '101010100', 'query': 'python', 'page': '1', '_': str(ts)},
        impersonate='chrome131')
    d1 = r1.json()

    if d1.get('code') == 37:
        zp = d1['zpData']
        seed, api_ts = zp['seed'], zp['ts']
        r = subprocess.run(['node', 'sign_boss_v8.js', __a, __c, seed, str(api_ts)],
            capture_output=True, text=True, timeout=20)
        token = r.stdout.strip()
        session.cookies.set('__zp_stoken__', token, domain='.zhipin.com')

        ts2 = int(time.time() * 1000)
        r2 = session.get('https://www.zhipin.com/wapi/zpgeek/search/joblist.json',
            params={'city': '101010100', 'query': 'python', 'page': '1', '_': str(ts2)},
            impersonate='chrome131')
        d2 = r2.json()

        print(f'Run{run}: token_len={len(token)} code={d2.get("code")} msg={d2.get("message","")[:30]}')
        if d2.get('code') == 0:
            jobs = d2.get('zpData', {}).get('jobList', [])
            print(f'  SUCCESS! {len(jobs)} jobs')
            for j in jobs[:3]:
                print(f'  [{j.get("jobName","?")}] @ {j.get("brandName","?")}')
    else:
        print(f'Run{run}: unexpected code={d1.get("code")}')<｜end▁of▁thinking｜>写了脚本，直接跑。

