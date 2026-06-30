"""
国家医保局 - 国密算法 (SM2/SM3/SM4) 封装
========================================

基于 gmssl 库实现的 SM2/SM3/SM4 加解密和签名。

国密算法是中国国家密码管理局发布的商用密码算法标准：
- SM2: 椭圆曲线公钥密码算法 (类似 ECDSA)
- SM3: 密码杂凑算法 (类似 SHA-256)
- SM4: 分组密码算法 (类似 AES-128)
"""

import base64
import binascii
from gmssl import sm2, sm3, sm4, func


class SM4Cipher:
    """SM4 对称加密 (CBC 模式)"""

    def __init__(self, key: bytes, iv: bytes = None):
        """
        Args:
            key: 16 字节密钥
            iv: 16 字节初始化向量 (默认全零)
        """
        self.key = key
        self.iv = iv or b'\x00' * 16
        self._encrypt_cipher = sm4.CryptSM4()
        self._encrypt_cipher.set_key(self.key, sm4.SM4_ENCRYPT)
        self._decrypt_cipher = sm4.CryptSM4()
        self._decrypt_cipher.set_key(self.key, sm4.SM4_DECRYPT)

    def encrypt(self, plaintext: bytes) -> bytes:
        """SM4-CBC 加密 (PKCS7 填充)"""
        padded = self._pkcs7_pad(plaintext)
        return self._encrypt_cipher.crypt_cbc(self.iv, padded)

    def decrypt(self, ciphertext: bytes) -> bytes:
        """SM4-CBC 解密 (PKCS7 去填充)"""
        plaintext = self._decrypt_cipher.crypt_cbc(self.iv, ciphertext)
        return self._pkcs7_unpad(plaintext)

    def encrypt_hex(self, plaintext: bytes) -> str:
        """加密并返回 hex 字符串"""
        return self.encrypt(plaintext).hex().upper()

    def decrypt_hex(self, hex_str: str) -> bytes:
        """解密 hex 字符串"""
        return self.decrypt(bytes.fromhex(hex_str))

    @staticmethod
    def _pkcs7_pad(data: bytes, block_size: int = 16) -> bytes:
        pad_len = block_size - len(data) % block_size
        return data + bytes([pad_len] * pad_len)

    @staticmethod
    def _pkcs7_unpad(data: bytes) -> bytes:
        pad_len = data[-1]
        if pad_len < 1 or pad_len > 16:
            return data
        return data[:-pad_len]


class SM2Signer:
    """SM2 签名和验证"""

    def __init__(self, private_key_hex: str, public_key_hex: str):
        """
        Args:
            private_key_hex: 64 字符 hex 私钥
            public_key_hex: 130 字符 hex 公钥 (04 + x + y)
        """
        self.private_key = private_key_hex
        self.public_key = public_key_hex

    def sign(self, data: bytes) -> bytes:
        """
        SM2 签名 (返回 DER 编码的签名)
        """
        sm2_crypt = sm2.CryptSM2(public_key=self.public_key, private_key=self.private_key)
        # 使用 SM3 作为哈希
        sign_data = sm2_crypt.sign(data, None)  # None = default ID
        if isinstance(sign_data, str):
            sign_data = bytes.fromhex(sign_data)
        return sign_data

    def sign_base64(self, data: bytes) -> str:
        """签名并返回 base64 编码"""
        return base64.b64encode(self.sign(data)).decode()

    def sign_string(self, data: str) -> str:
        """对字符串签名并返回 base64"""
        return self.sign_base64(data.encode('utf-8'))


class SM3Hasher:
    """SM3 哈希"""

    @staticmethod
    def hash(data: bytes) -> bytes:
        """SM3 哈希"""
        result = sm3.sm3_hash(func.bytes_to_list(data))
        return bytes.fromhex(result)

    @staticmethod
    def hash_hex(data: bytes) -> str:
        """SM3 哈希 (hex)"""
        return sm3.sm3_hash(func.bytes_to_list(data))

    @staticmethod
    def hmace(key: bytes, data: bytes) -> bytes:
        """HMAC-SM3"""
        result = sm3.sm3_hmac(func.bytes_to_list(data), func.bytes_to_list(key))
        return bytes.fromhex(result)


def generate_sm2_keypair() -> tuple:
    """
    生成 SM2 密钥对

    Returns:
        (private_key_hex, public_key_hex)
    """
    sm2_crypt = sm2.CryptSM2(private_key=None, public_key=None)
    # gmssl 可以自动生成密钥对
    return None  # gmssl doesn't support key generation directly, need workaround


def test_sm4():
    """测试 SM4 加解密"""
    key = b'0123456789abcdef'  # 16 bytes
    iv = b'\x00' * 16

    cipher = SM4Cipher(key, iv)
    plaintext = b'{"test": "hello world"}'
    encrypted = cipher.encrypt_hex(plaintext)
    decrypted = cipher.decrypt_hex(encrypted)

    assert decrypted == plaintext, f"SM4 test failed: {decrypted} != {plaintext}"
    print(f"[OK] SM4 encrypt/decrypt test passed")
    return True


if __name__ == '__main__':
    test_sm4()
