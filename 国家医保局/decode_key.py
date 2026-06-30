"""Decode the XOR-obfuscated SM4 key from app.js"""
import re, sys, json
sys.stdout.reconfigure(encoding='utf-8')

with open('config/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# The XOR key
xor_key = [0x13, 0x7, 0x1f, 0x2b, 0xb, 0x1d, 0x25]

# Extract all arrays - they're embedded in the JS near position 2236974
# _0xb67946 (SM4 key input), _0x473788, _0x5b7784, and the 'a' parameter

# Find the full block of array definitions
idx = content.find('_0x1d6d6a=')
if idx > 0:
    block = content[idx:idx+3000]
    print('=== Array block ===')
    print(block[:1000])
    print()
    print('...')
    print(block[-500:])

# Extract all 2D arrays: [[...],[...],...]
arrays = re.findall(r'\[(\[[0-9a-fxA-Fx,\s]+\](?:,\s*\[[0-9a-fxA-Fx,\s]+\])*)\]', block)

print(f'\nFound {len(arrays)} 2D arrays')

def decode(array_2d, xor_key):
    """Decode XOR-obfuscated 2D byte array to string"""
    result = []
    pos = 0
    for inner in array_2d:
        for byte_val in inner:
            char_code = byte_val ^ xor_key[pos % len(xor_key)]
            result.append(chr(char_code))
            pos += 1
    return ''.join(result)

def parse_array(arr_text):
    """Parse array text like '[0x52,0x4d,...]' to list of ints"""
    nums = re.findall(r'0x([0-9a-fA-F]+)', arr_text)
    return [int(n, 16) for n in nums]

# Parse and decode each array
for i, arr_text in enumerate(arrays):
    inner_arrays = re.findall(r'\[(0x[0-9a-fA-F]+,\s*[^\]]+)\]', arr_text)
    if not inner_arrays:
        # Try parsing as single 2D array
        parts = arr_text.split('],[')
        inner_arrays = parts

    all_bytes = []
    for inner in inner_arrays:
        nums = parse_array('[' + inner.strip('[]') + ']')
        all_bytes.append(nums)

    decoded = decode(all_bytes, xor_key)
    print(f'\n[{i}] ({len(decoded)} chars): {decoded}')
    # Check if it's hex
    if len(decoded) <= 128 and all(c in '0123456789abcdefABCDEF' for c in decoded):
        print(f'     -> HEX: {decoded}')
