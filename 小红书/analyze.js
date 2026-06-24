// Extract and analyze eval code
const fs=require('fs');
const v=fs.readFileSync('data/vendor.js','utf-8');
const mt=v.indexOf('__makeTemplateObject([');
const arr=v.indexOf('[',mt); const q=v.indexOf('"',arr);
let i=q+1,raw=''; while(i<v.length){if(v[i]==='\\'){raw+=v[i];raw+=v[i+1];i+=2;continue}if(v[i]==='"')break;raw+=v[i];i++}
let code='',j=0; while(j<raw.length){if(raw[j]==='\\'){const n=raw[j+1];if(n==='"'){code+='"';j+=2;continue}if(n==='n'){code+='\n';j+=2;continue}if(n==='r'){code+='\r';j+=2;continue}if(n==='t'){code+='\t';j+=2;continue}if(n==='x'){code+=String.fromCharCode(parseInt(raw.slice(j+2,j+4),16));j+=4;continue}j+=2;continue}code+=raw[j];j++}
fs.writeFileSync('_eval_code.js',code);
console.log('Saved _eval_code.js:',code.length,'chars');

// Find ALL glb[ assignments
const glbAssigns=code.match(/glb\[[^\]]+\]=/g);
console.log('\nglb[key]= assignments:',glbAssigns?glbAssigns.length:0);

// Find ALL function definitions and what they're assigned to
const fnAssigns=code.match(/glb\[[^\]]+\]=function\s*\([^)]*\)/g);
console.log('\nglb[key]=function:');
if(fnAssigns) for(const a of fnAssigns) console.log('  '+a.slice(0,80));

// Find where mnsv2 is explicitly created
const mnsv2Explicit=code.match(/mnsv2/g);
console.log('\n"mnsv2" literal:',mnsv2Explicit?mnsv2Explicit.length:0,'occurrences');

// Find ALL function definitions
const allFns=code.match(/function\s+([_\w]+)\s*\(/g);
if(allFns){
  const names=[...new Set(allFns.map(f=>f.match(/function\s+(\w+)/)[1]))];
  console.log('\nFunction definitions ('+names.length+'):');
  names.slice(0,30).forEach(n=>console.log('  '+n));
}

// Show last 5 lines
const lines=code.split('\n');
console.log('\nLast 5 lines:');
lines.slice(-5).forEach(l=>console.log(l.slice(0,150)));

// Show the env call context
const envCallIdx=code.indexOf('_AUuXfEG27Xa3x');
console.log('\n_AUuXfEG27Xa3x first at:',envCallIdx,'context:');
if(envCallIdx>=0)console.log(code.slice(envCallIdx-50,envCallIdx+100));
