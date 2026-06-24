const fs=require('fs');
const v=fs.readFileSync('data/vendor.js','utf-8');
const mt=v.indexOf('__makeTemplateObject([');
const arr=v.indexOf('[',mt),q=v.indexOf('"',arr);
let i=q+1,raw='';while(i<v.length){if(v[i]==='\\'){raw+=v[i];raw+=v[i+1];i+=2;continue}if(v[i]==='"')break;raw+=v[i];i++}
let code='',j=0;while(j<raw.length){if(raw[j]==='\\'){const n=raw[j+1];if(n==='"'){code+='"';j+=2;continue}if(n==='n'){code+='\n';j+=2;continue}if(n==='r'){code+='\r';j+=2;continue}if(n==='t'){code+='\t';j+=2;continue}if(n==='x'){code+=String.fromCharCode(parseInt(raw.slice(j+2,j+4),16));j+=4;continue}j+=2;continue}code+=raw[j];j++}
fs.writeFileSync('_eval.js',code);
console.log('Saved _eval.js:',code.length,'chars');
