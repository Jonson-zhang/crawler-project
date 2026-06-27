"""Quick test: boot with v2.0 Node.js → immediately test with iv8"""
import json, hashlib, time, random, zlib, urllib.parse, re, uuid, subprocess, sys
from base64 import b64encode as std_b64
from Crypto.Cipher import ARC4, DES
from curl_cffi import requests

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

# ===== Boot with Node.js daemon =====
proc = subprocess.Popen(['node','sign.js','--daemon'],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd='../v2.0')

def node_sign(path, body):
    proc.stdin.write(json.dumps({'path':path,'body':body or {}}, separators=(',',':')) + '\n')
    proc.stdin.flush()
    return json.loads(proc.stdout.readline())

from xhs_sign import _b64e, _json_to_bytes

def make_xsc(a1v):
    fp = {'x33':'0','x34':'0','x35':'0','x36':'10','x37':'0|0|0|0|0|0|0|0|0|1|0|0|0|0|0|0|0|0|1|0|0|0|0|0','x38':'0|0|1|0|1|0|0|0|0|0|1|0|1|0|1|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0','x39':0,'x42':'3.5.4','x43':'Canvas not supported','x44':str(int(time.time()*1000)),'x45':'__SEC_CAV__1-1-1-1-1|__SEC_WSA__|','x46':'false','x48':'','x49':'{list:[],type:}','x50':'','x51':'','x52':'','x82':'_0x17a2|_0x1954'}
    keys = ['x33','x34','x35','x36','x37','x38','x39','x42','x43','x44','x45','x46','x48','x49','x50','x51','x52','x82']
    s_fp = json.dumps({k:fp[k] for k in keys}, separators=(',',':'), ensure_ascii=False)
    ct = ARC4.new(b'xhswebmplfbt').encrypt(s_fp.encode('utf-8'))
    u = urllib.parse.quote(ct.decode('latin1'), safe="!*'()~_-")
    r_bytes = bytearray()
    for p in u.split('%'):
        if not p: continue
        ch = list(p); r_bytes.append(int(''.join(ch[:2]),16))
        for c2 in ch[2:]: r_bytes.append(ord(c2))
    b1 = _b64e(bytes(r_bytes))
    x9 = zlib.crc32(b1.encode())
    if x9 >= 0x80000000: x9 -= 0x100000000
    obj = {'s0':5,'s1':'','x0':'1','x1':'4.3.5','x2':'Windows','x3':'xhs-pc-web','x4':'6.12.3','x5':a1v,'x6':'','x7':'','x8':b1,'x9':x9,'x10':fp['x39'],'x11':'normal'}
    return _b64e(_json_to_bytes(obj))

# Generate a1 + webId
A1_CHARS = 'abcdefghijklmnopqrstuvwxyz1234567890'
ts = hex(int(time.time()*1000))[2:]
a1 = (ts + ''.join(random.choices(A1_CHARS,k=30)) + '50000')[:52]
webId = hashlib.md5(a1.encode()).hexdigest()

s = requests.Session()
s.headers.update({'user-agent': UA, 'origin': 'https://www.xiaohongshu.com', 'referer': 'https://www.xiaohongshu.com/'})
s.cookies.update({'a1':a1,'webId':webId,'webBuild':'6.12.3','xsecappid':'xhs-pc-web','loadts':str(int(time.time()*1000)),'abRequestId':str(uuid.uuid4())})

# scripting
r = s.post('https://as.xiaohongshu.com/api/sec/v1/scripting', json={'callFrom':'web','callback':'seccallback'}, headers={'content-type':'application/json'}, timeout=15, impersonate='chrome131')
resp = r.json()
js_text = resp['data']['data']
b_m = re.search(r'"b":"(.*?)",', js_text); d_m = re.search(r'"d":(\[.*?\])\}\)', js_text)
b,d = b_m.group(1), json.loads(d_m.group(1))
if len(b)%4: b += '='*(4-len(b)%4)
decoded = __import__('base64').b64decode(b).decode('utf-8')
logic,chunk=[],[]
for c_char in decoded:
    if len(chunk)==5: logic.append(chunk); chunk=[]
    chunk.append(ord(c_char)-1)
if chunk: logic.append(chunk)
target=logic[d[92]:d[93]+1]
kb=[d[target[675+i][2]] for i in range(0,128,2)]
websectiga=''.join(chr(kb[i+j]) for i in range(56,-1,-8) for j in range(8))
s.cookies.update({'websectiga':websectiga,'sec_poison_id':resp['data'].get('secPoisonId',str(uuid.uuid4()))})
print(f'[2/4] websectiga={websectiga[:15]}...')

# shield (Node.js daemon)
fp_json = json.dumps({'uuid':'joiamkprgeyi238i','requestId':hashlib.md5(str(time.time()).encode()).hexdigest()[:16]}, separators=(',',':'))
fp_b64 = std_b64(fp_json.encode()).decode()
raw = fp_b64.encode(); pad = 8 - len(raw)%8
padded = raw if pad==8 else raw + b'\x00'*pad
pf = DES.new(b'zbp30y86', DES.MODE_ECB).encrypt(padded).hex()
shield_url = 'https://as.xiaohongshu.com/api/sec/v1/shield/webprofile'
shield_data = {'platform':'Windows','profileData':pf,'sdkVersion':'4.2.6','svn':'2'}
shield_path = '/' + shield_url.split('/',3)[-1]
xs = node_sign(shield_path, shield_data)
sc = s.cookies.get_dict()
s.post(shield_url, json=shield_data, headers={
    'content-type':'application/json;charset=UTF-8', 'x-s':xs['X-s'], 'x-t':xs['X-t'],
    'x-s-common':make_xsc(sc.get('a1','')),
    'x-b3-traceid':''.join(random.choices('abcdef0123456789',k=16)),
    'x-xray-traceid':hex(int(time.time()*1000)<<23)[2:].zfill(16)+hex(random.getrandbits(64))[2:].zfill(16),
}, timeout=15, impersonate='chrome131')
gid_node = 'ok' if s.cookies.get('gid') else 'no'
print(f'[3/4] gid={gid_node}')

# activate (Node.js daemon)
act_url = 'https://edith.xiaohongshu.com/api/sns/web/v1/login/activate'
act_path = '/' + act_url.split('/',3)[-1]
xs2 = node_sign(act_path, {})
ac = s.cookies.get_dict()
ar = s.post(act_url, json={}, headers={
    'content-type':'application/json;charset=UTF-8', 'x-s':xs2['X-s'], 'x-t':xs2['X-t'],
    'x-s-common':make_xsc(ac.get('a1','')),
    'x-b3-traceid':''.join(random.choices('abcdef0123456789',k=16)),
    'x-xray-traceid':hex(int(time.time()*1000)<<23)[2:].zfill(16)+hex(random.getrandbits(64))[2:].zfill(16),
}, timeout=15, impersonate='chrome131')
ws_node = 'ok' if s.cookies.get('web_session') else 'no'
print(f'[4/4] web_session={ws_node}')

proc.stdin.close(); proc.wait(timeout=5)

if not s.cookies.get('web_session'):
    print('BOOT FAILED with Node.js too')
    sys.exit(1)

print('\n=== Now testing iv8 with FRESH cookies ===\n')
cookie_str = '; '.join(f'{k}={v}' for k,v in s.cookies.get_dict().items() if isinstance(v,(str,int)))

from xhs_sign import XhsSigner
signer = XhsSigner(cookie_str=cookie_str)

url = '/api/sns/web/v1/homefeed'
body = {'cursor_score':'','num':20,'refresh_type':1,'note_index':0}
x_s_iv8 = signer.sign(url, body)
print(f'iv8 x-s len={len(x_s_iv8)} x-s[:50]={x_s_iv8[:50]}')

xsc_iv8 = make_xsc(s.cookies.get('a1',''))

s2 = requests.Session()
s2.cookies.update({k:str(v) for k,v in s.cookies.get_dict().items() if isinstance(v,str)})
hdr = {
    'content-type':'application/json;charset=UTF-8',
    'x-s':x_s_iv8, 'x-t':str(int(time.time()*1000)), 'x-s-common':xsc_iv8,
    'x-b3-traceid':''.join(random.choices('abcdef0123456789',k=16)),
    'x-xray-traceid':hex(int(time.time()*1000)<<23)[2:].zfill(16)+hex(random.getrandbits(64))[2:].zfill(16),
    'user-agent':UA, 'origin':'https://www.xiaohongshu.com', 'referer':'https://www.xiaohongshu.com/explore',
}
resp = s2.post('https://edith.xiaohongshu.com'+url, json=body, headers=hdr, timeout=30, impersonate='chrome131')
result = resp.json()
print(f'iv8 code={result.get("code")} success={result.get("success")}')
items = result.get('data',{}).get('items') or []
print(f'iv8 items: {len(items)}')
for it in items[:3]:
    nc = it.get('note_card') or it
    print(f'  - {(nc.get("display_title") or "?").strip()[:60]}')
signer.close()
