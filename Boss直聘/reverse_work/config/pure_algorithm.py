def generate_token(seed, ts):
    """
    Boss直聘 __zp_stoken__ 纯算法 (VMP状态机还原)
    """
    # ===== Initialize =====
    vars = {}
    
    # Seed and timestamp
    vars["arguments"] = [seed, ts]
    
    # ===== Main Loop: 16974 ↔ 10689 (696+36 iterations) =====
    for _ in range(36):  # 36 repetitions of [10689]
        # 16974 path: build Selection checker
        v_o = "Selec"
        v_v = "tio"
        v_n = "n"
        v_C = 0
        v_r = v_o + v_v
        v_F = "t"
        v_y = 19
        v__ = 'window'
        v_t = ts
        v_j = "charA"
        v_H = v_j + v_F
        v_I = "e"
        v_i = v_r + v_n
        v_V = "toUpp"
        v_Fl = "slice"
        v_Kl = 1
        v_k = "erCas"
        v_e = None
        v_B = v_V + v_k
        v_W = v_B + v_I
        v_g = '_[i]'
        v_E = 'typeof g'
        v_b = '!E'
        v_M = v_b + v_C
        v_T = 'y | M'
        v_N = 'y ^ M'
        v_A = 'y & M'
        v_x = '~A'
        v_D = 'T & x'
        v_L = 'D - N'
        v_G = v_L + v_y
        v_J = 't[H]'
        v_X = '[call]'
        v_Z = 'X[W]'
        v_Y = '[call]'
        v_Hl = 't[Fl]'
        v_Zl = '[call]'
        v_Ql = v_Y + v_Zl
        
        # 10689 path: extract charCodeAt from Selection
        v_c = "slice"
        v__ = ts
        v_t = 1
        v_e = '_[c]'
        v_y = '[call]'
    
    # ===== 2164 path: toLowerCase (392x) =====
    for _ in range(392):
        v_t = "erCa"
        v_o = "se"
        v_e = "toLow"
        v__ = ts
        v_y = v_e + v_t
        v_c = "-"
        v_v = v_y + v_o
        v_r = '_[v]'
        v_n = '[call]'
        v_i = v_c + v_n
    
    # ===== 2273 path: Math/number ops (82x) =====
    for _ in range(82):
        v_I = 268435455
        v_j = "numbe"
        v_F = "r"
        v_Y = "gle"
        v_o = ts
        v_k = 16383
        v_P = 4294967295
        v_ye = 192
        v_t = 'Math'
        v_y = None
        v_qv = "HTMLE"
        v_r = 84
        v_v = seed
        v_M = 0
        v_ee = 16
        v__ = 'window'
        v_Qa = 255
        v_Sr = 24
        v_i = "ge"
        v_lr = "ent"
        v_br = 224
        v_B = 2097151
        v_Ha = 128
        v_H = v_j + v_F
        v_Dv = 9
        v_Z = "SVGAn"
        v_Ip = "push"
    
    return "token_placeholder"
