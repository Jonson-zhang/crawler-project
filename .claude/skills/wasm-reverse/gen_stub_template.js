#!/usr/bin/env node
/**
 * wasm-bindgen stub 模板生成器
 *
 * 读取 wasm-objdump -x 的输出（通过管道），
 * 生成每个 wbg 导入函数的 JS stub 模板，
 * 参数数量和类型与 WASM 签名严格对齐。
 *
 * 用法:
 *   wasm-objdump -x target.wasm | node gen_stub_template.js
 *   或
 *   wasm-tools objdump target.wasm | node gen_stub_template.js
 *
 * 输出: 可直接复制到 sign.js 的 wbg 对象模板，
 *       每个函数都有正确的参数个数和 TODO 注释。
 */

const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });

const types = []; // types[i] = { params: number, results: number, paramStr: string }
const imports = []; // imports[i] = { module, name, typeIdx }

let inType = false, inImport = false;

rl.on("line", (line) => {
    // Type section
    if (line.includes("Type[")) {
        inType = true;
        inImport = false;
    }
    if (line.includes("Import[")) {
        inType = false;
        inImport = true;
    }
    if (
        line.includes("Function[") ||
        line.includes("Export[") ||
        line.includes("Table[") ||
        line.includes("Memory[") ||
        line.includes("Global[")
    ) {
        inType = false;
        inImport = false;
    }

    if (inType) {
        // Parse: - type[N] (i32, i32) -> i32
        const m = line.match(
            /- type\[(\d+)\]\s+\(([^)]*)\)\s*->\s*(\S+)/
        );
        if (m) {
            const idx = parseInt(m[1]);
            const params = m[2]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const results = m[3].trim();
            types[idx] = {
                paramCount: params.length,
                params: params,
                result: results === "nil" ? "void" : results,
                paramStr:
                    params.length > 0 ? `(${params.join(", ")})` : "()",
            };
        }
        // wasm-tools format: - type[3] func type=(i32,i32)->nil
        const m2 = line.match(
            /- type\[(\d+)\]\s+func\s+type=\(([^)]*)\)->(\S+)/
        );
        if (m2) {
            const idx = parseInt(m2[1]);
            const params = m2[2]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const results = m2[3].trim();
            types[idx] = {
                paramCount: params.length,
                params: params,
                result: results === "nil" ? "void" : results,
                paramStr:
                    params.length > 0 ? `(${params.join(", ")})` : "()",
            };
        }
    }

    if (inImport) {
        // Parse: - func[N] sig=M <wbg.__xxx> <- wbg.__xxx
        const m = line.match(
            /- func\[\d+\]\s+sig=(\d+)\s+<(wbg\.\w+)>/
        );
        if (m) {
            const typeIdx = parseInt(m[1]);
            const fullName = m[2];
            const shortName = fullName.replace(/^wbg\./, "");
            imports.push({ fullName, shortName, typeIdx });
        }
    }
});

rl.on("close", () => {
    console.log("// ============================================================");
    console.log("// 自动生成的 wbg stub 模板 — 参数签名与 WASM 严格对齐");
    console.log(
        `// 共 ${imports.length} 个导入函数, ${types.length} 个类型签名`
    );
    console.log("//");
    console.log("// TODO: 每个函数都需要从浏览器 trace 获取返回值语义");
    console.log("//       sig=N → 查 Type[N] 确定参数数量");
    console.log("//       i32 参数 → 可能是 WASM 引用表句柄, 也可能是原始值");
    console.log("// ============================================================");
    console.log("");
    console.log("const wbg = {");

    for (const imp of imports) {
        const t = types[imp.typeIdx];
        if (!t) {
            console.log(
                `  // WARNING: type[${imp.typeIdx}] not found`
            );
            console.log(
                `  ${imp.shortName}: function() { return 0; },`
            );
            continue;
        }

        // 生成参数名 (wbg 参数全是 i32，根据数量命名)
        const paramNames = [];
        for (let i = 0; i < t.paramCount; i++) {
            if (t.paramCount === 1) paramNames.push("a");
            else if (t.paramCount === 2) paramNames.push(["a", "b"][i]);
            else if (t.paramCount === 3)
                paramNames.push(["a", "b", "c"][i]);
            else if (t.paramCount === 4)
                paramNames.push(["a", "b", "c", "d"][i]);
            else if (t.paramCount === 5)
                paramNames.push(["a", "b", "c", "d", "e"][i]);
            else if (t.paramCount === 6)
                paramNames.push(["a", "b", "c", "d", "e", "f"][i]);
            else paramNames.push("p" + i);
        }

        const paramsStr = paramNames.join(", ");
        const sigInfo = `sig=${imp.typeIdx} ${t.paramStr} → ${t.result}`;
        const comment = `// ${sigInfo}`;

        if (t.result === "nil" || t.result === "void") {
            console.log(`  ${comment}`);
            console.log(
                `  ${imp.shortName}: function(${paramsStr}) {`
            );
            console.log(`    // TODO: trace args, implement`);

            // 常见模式提示
            const name = imp.shortName;
            if (name.includes("string_get"))
                console.log(
                    `    // 常见: 结果写入 ptrOut (a), b=ref (读 JS 字符串写入 WASM 内存)`
                );
            else if (name.includes("getAttribute"))
                console.log(
                    `    // 常见: 结果写入 outPtr (a), b=elRef, c,d=attrName(ptr,len)`
                );
            else if (name.includes("set") && !name.includes("_set_"))
                console.log(
                    `    // 常见: a=targetRef, b=srcRef, c=offset_raw (不是引用!)`
                );
            else if (name.includes("querySelector"))
                console.log(
                    `    // 常见: a=docRef, b,c=selector(ptr,len)`
                );
            else if (name.includes("getRandomValues"))
                console.log(
                    `    // 常见: a=selfRef(忽略), b=bufRef(输出)`
                );
            else if (name.includes("randomFillSync"))
                console.log(
                    `    // 常见: a=selfRef(忽略), b=bufRef, c=offset_raw, d=size_raw`
                );

            console.log(`  },`);
        } else {
            console.log(`  ${comment}`);
            console.log(
                `  ${imp.shortName}: function(${paramsStr}) {`
            );
            console.log(`    // TODO: trace args, implement`);
            console.log(`    return 0;  // 返回 ${t.result}`);
            console.log(`  },`);
        }
        console.log("");
    }

    console.log("};");
    console.log("");
    console.log("// ============================================================");
    console.log("// 类型签名完整表 (参考用)");
    console.log("// ============================================================");
    for (let i = 0; i < types.length; i++) {
        if (types[i]) {
            console.log(`// Type[${i}]: ${types[i].paramStr} → ${types[i].result}`);
        }
    }
});
