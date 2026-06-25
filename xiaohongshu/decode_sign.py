"""
Decode XHS XYS_ signature and x-s-common.
"""
import base64
import json
import struct

# Custom Base64 alphabet (from xhs-reverse skill)
CUSTOM_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"

# Standard Base64 alphabet
STD_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def custom_b64_decode(s: str) -> bytes:
    """Decode custom Base64 string using the XHS alphabet."""
    # Translate custom alphabet to standard
    trans = str.maketrans(CUSTOM_B64, STD_B64)
    std_s = s.translate(trans)
    # Add padding if needed
    padding = 4 - len(std_s) % 4
    if padding != 4:
        std_s += "=" * padding
    return base64.b64decode(std_s)


def main():
    # Real signed request captured from browser
    x_s = "XYS_2UQhPsHCH0c1PUhMHjIj2erjwjQhyoPTqBPT49pjHjIj2eHjwjQgynEDJ74AHjIj2ePjwjQTJdPIPAZlg94aGLTlqAY+/bScysT9JUTbzemk8epzc7r3ygQawepn2n4x2bSpnLLUyfEf+7iF8rpPtURpaL+lyDzNLgSI+sTtzF+xG9zw4f4jaBb/zeH6+bma2p+aP/z9PfR8p/zMaSzgPdbPadShzrbeLfcIqg4mq/+mPrkHaMY/afbnwrhMPbz+c9EIqMQCLDkcpnbLP9lHqDT/Jfznnfl0yLLIaSQQyAmOarEaLSz+qflnyflw+7YOpBHUpAp7qrET8AmstUHVHdWFH0ijJ9Qx8n+FHdF="
    x_s_common = "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"

    # Strip XYS_ prefix
    x_s_data = x_s[4:]
    print(f"x-s length (after XYS_): {len(x_s_data)}")

    # Decode x-s
    try:
        decoded = custom_b64_decode(x_s_data)
        print(f"x-s decoded length: {len(decoded)} bytes")
        print(f"x-s decoded (hex): {decoded[:50].hex()}")
        # Try to parse as JSON internally
        try:
            obj = json.loads(decoded.decode('utf-8'))
            print(f"x-s decoded JSON: {json.dumps(obj, indent=2, ensure_ascii=False)}")
            if 'x3' in obj:
                print(f"\nx3 prefix: {obj['x3'][:30]}...")
        except:
            print(f"x-s decoded (raw): {decoded[:200]}")
    except Exception as e:
        print(f"x-s decode error: {e}")
        # Try without custom alphabet
        try:
            decoded = base64.b64decode(x_s_data + "==")
            print(f"Standard b64 decoded: {decoded[:100]}")
        except:
            pass

    print("\n" + "=" * 60)

    # Decode x-s-common
    print(f"\nx-s-common length: {len(x_s_common)}")
    try:
        decoded = custom_b64_decode(x_s_common)
        print(f"x-s-common decoded length: {len(decoded)} bytes")
        # x-s-common is compressed/encrypted pipeline:
        # JSON → URLEncode → bytearray → custom base64
        # Try URL decode
        from urllib.parse import unquote
        try:
            text = decoded.decode('latin-1')
            print(f"x-s-common latin-1 decoded: {text[:300]}")
            # Try URL decode
            unquoted = unquote(text)
            print(f"\nx-s-common URL unquoted: {unquoted[:300]}")
            # Try JSON parse
            try:
                obj = json.loads(unquoted)
                print(f"\nx-s-common JSON ({len(obj)} fields):")
                for k, v in obj.items():
                    val_str = str(v)[:80]
                    print(f"  {k}: {val_str}")
            except:
                print("(not valid JSON after unquote)")
        except Exception as e:
            print(f"Decode error: {e}")
            print(f"Raw bytes: {decoded[:100]}")
    except Exception as e:
        print(f"x-s-common decode error: {e}")

    # Also try standard base64
    print("\n" + "=" * 60)
    print("\nTrying standard base64 decode for x-s-common...")
    try:
        decoded = base64.b64decode(x_s_common + "==")
        print(f"Standard b64: {decoded[:100]}")
    except Exception as e:
        print(f"Standard b64 failed: {e}")


if __name__ == "__main__":
    main()
