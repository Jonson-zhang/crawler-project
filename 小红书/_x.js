const fs=require('fs');
const v=fs.readFileSync('data/vendor.js','utf-8');

// Find template and extract first raw string
let mt=v.indexOf('__makeTemplateObject([');
if(mt<0){console.log('not found');process.exit(1);}
console.log('mt:',mt);

// Find [ after mt
let arr=v.indexOf('[',mt);
// Find " after arr
let q=v.indexOf('"',arr);
console.log('q:',q,'near:',v.slice(q,Math.min(v.length,q+60)).replace(/\n/g,'\\n'));

// Walk char by char to find matching "
let i=q+1, raw='';
while(i<v.length){
  if(v[i]==='\\'){
    raw+=v[i]; raw+=v[i+1]; i+=2; continue;
  }
  if(v[i]==='"'){
    // Check if end of raw string element
    let rest=v.slice(i+1,i+10).trim();
    if(rest[0]===','||rest[0]===']'){
      break;
    }
  }
  raw+=v[i]; i++;
}
console.log('raw len:',raw.length);
fs.writeFileSync('_raw.txt',raw);

// Parse escape sequences
let result='', j=0;
while(j<raw.length){
  if(raw[j]==='\\'){
    let n=raw[j+1];
    if(n==='"'){result+='"';j+=2;continue}
    if(n==='\\'){result+='\\';j+=2;continue}
    if(n==='n'){result+='\n';j+=2;continue}
    if(n==='r'){result+='\r';j+=2;continue}
    if(n==='t'){result+='\t';j+=2;continue}
    if(n==='x'){
      result+=String.fromCharCode(parseInt(raw.slice(j+2,j+4),16));
      j+=4;continue
    }
    result+=raw[j];j+=2;continue
  }
  result+=raw[j];j++
}
console.log('decoded:',result.length);
fs.writeFileSync('_eval.js',result);
console.log('first 200:',result.slice(0,200).replace(/\n/g,'\\n'));
console.log('last 200:',result.slice(-200).replace(/\n/g,'\\n'));

// Search for S-box
let depth=0, start=-1, inStr=false, esc=false, sboxes=[];
for(let i=0;i<result.length;i++){
  if(esc){esc=false;continue}
  if(result[i]==='\\'&&(result[i+1]==='"'||result[i+1]==="'")){inStr=!inStr;i++;continue}
  if(result[i]==='"'||result[i]==="'"){inStr=!inStr;continue}
  if(inStr)continue;
  if(result[i]==='['){if(depth===0)start=i;depth++;continue}
  if(result[i]===']'){depth--;if(depth===0&&start>=0){
    let arr=result.slice(start,i+1);
    if(/^\[[\d,\s]+\]$/.test(arr)){
      let nums=arr.slice(1,-1).split(',').map(Number).filter(n=>!isNaN(n));
      if(nums.length>=200&&nums.length<=300&&nums.every(n=>n>=0&&n<=255)){
        sboxes.push({len:nums.length,pos:start,unique:new Set(nums).size,first10:nums.slice(0,10),last10:nums.slice(-10)});
      }
    }
  }}
}

console.log('\n=== Numeric arrays 200-300 elem ===');
console.log('Found:',sboxes.length);
for(let s of sboxes){
  let perfect=s.len===256&&s.unique===256;
  console.log((perfect?'*** SBOX *** ':'')+'len='+s.len+' unique='+s.unique+' pos='+s.pos);
  console.log('  first10:',s.first10);
  console.log('  last10:',s.last10);
  if(perfect)fs.writeFileSync('_sbox.json',JSON.stringify(s.first10)); // just save first for now, full array in context
}
// Also save the full array for perfect match
for(let s of sboxes){
  if(s.len===256&&s.unique===256){
    let arr=result.slice(s.pos,s.pos+result.slice(s.pos).indexOf(']')+1);
    let nums=arr.slice(1,-1).split(',').map(Number).filter(n=>!isNaN(n));
    fs.writeFileSync('_sbox.json',JSON.stringify(nums));
    console.log('Saved SBOX to _sbox.json');
  }
}
