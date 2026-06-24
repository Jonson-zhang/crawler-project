#!/usr/bin/env python3
"""Decode ROT-1 string table from $_ts VM"""

def rot1(t):
    r = ''
    for c in t:
        if 'a' <= c <= 'z':
            r += chr(ord('a') + (ord(c) - ord('a') - 1) % 26)
        elif 'A' <= c <= 'Z':
            r += chr(ord('A') + (ord(c) - ord('A') - 1) % 26)
        else:
            r += c
    return r

# From the _$_V function string table
raw = "~#`tsd`hfuXuusjcvuf`wbmvf`epdvnfou(mfnfou`obnf`qvti`ubh1bnf`bdujpo`tdsjqu`uftu`;0/+uuq5frvftu`sfbez6ubuf`ifjhiu`nbudi`tusjoh`h`bqqmz`mfohui`up6usjoh`bee(wfou/jtufofs`bqqfoeZijme`pqfo`ovncfs`pompbe`T`isfg`mpdbujpo`>`gpsn`C`cpez`pckfdu`]`tvcnju`tqmju`tfuXuusjcvuf`Q`joefy2g`podmjdl`sfqmbdf`qspupuzqf`tubuvt`potvcnju`gvodujpo`uzqf`kpjo`tqmjdf`xjeui`b`@`V`dbmm`dpodbu`dppljf`?`dsfbuf(mfnfou`tmjdf`&`BT`sftqpotf7fyu`vtfsXhfou`dibsZpefXu`ubssfu`opef1bnf`gmpps`joqvu`fyfd`~`ijeefo`poujnfpvu`fyufsobm`tuzmf`ujnf6ubnq`F`trsu`\"`sfnpwf(wfou/jtufofs`sfnpwfZijme`dibsXu`qpq`hfu(mfnfouYz,e`fwbm`spvoe`dpotusvdups`E`tfbsdi`:fc6pdlfu`mpdbm6upsbhf`pofssps`(wfou7bshfu`|`Xdujwf;2ckfdu`qbstf`qbuiobnf`tfu`hfu2xo3qspfsuz[ftdsjqupst`gspnZibsZpef`ifbefst`cvuupo`gspn` fwfou`ejw`sftqpotf`sftqpotf7zqf`R`dmjdl`btzod`ufyu`gspn`dbo3mbz7zqf`(ld3`qspupdpm`A`bct`joofs+70/`iuuqQ`posfbeztubufdibohf`voefgjofe`opef7zqf`iuuqtQ`jgsbnf`hfu`tvctus`tfoe`upq`qbsfou1pef`epdvnfou`qggG`iptuobnf`#potvcnju`#isfg``hfu(mfnfoutYz7bh1bnf`npvtfnpwf`tfu7jnfpvu`nfuipe`nfttbhf`FF`jnbhf`jnqpsu`qfsgpsnbodf`foduzqf`KKJ`tubuvt7fyu`bttjho`}`s`(mfnfou`G`OG`ujnf`0bui`fYONcZG`joefyfe[Y`pompbefoe`j`pObcpsu` bt `tipx0pebm[jbmph`+70/)psn(mfnfou`lfzepxo`H`$_<97;`5frvftu`ibt2xo3qspfsuz`tdsffo`hfu7jnf`opx`poqsphsftt`nby`#tsd`up/pxfsZbtf`ijtupsz`pompbeUju`bT`toqxgb`tf`Usjoh`"

tokens = raw.replace('(','$e').replace(')','$f').replace(';','$k').replace('+','$p').split('`')
for tok in tokens:
    # Restore special chars after decoding
    d = rot1(tok).replace('$e','(').replace('$f',')').replace('$k',';').replace('$p','+')
    if d != tok or len(d) <= 1:
        pass
    print(f'{tok:35s} → {d}')

# Manual decode of key attacks
key_apis = [
    ('fwbm', 'eval'),
    ('dpotusvdups', 'constructor'),
    ('dsfbuf(mfnfou', 'createElement'),
    ('bqqfoeZijme', 'appendChild'),
    ('jtufsofscf', 'insertBefore'),  # approximate
    ('sfnpwf(wfou/jtufofs', 'removeEventListener'),
    ('bee(wfou/jtufofs', 'addEventListener'),
    ('tfuxuufs', 'settter'),  # ?
    ('hfuXuusjcvuf', 'getAttribute'),
    ('tfuXuusjcvuf', 'setAttribute'),
]
print('\n=== Key APIs ===')
for enc, dec in key_apis:
    print(f'  {enc} → {dec}')
