from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import base64

KEY = b"$shanghaidianqi$"
IV = b"2023050814260000"


def encrypt(plaintext: str) -> str:
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    ct = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
    return base64.b64encode(ct).decode()


def decrypt(b64: str) -> str:
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    pt = unpad(cipher.decrypt(base64.b64decode(b64)), AES.block_size)
    return pt.decode()
