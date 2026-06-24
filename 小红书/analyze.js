// Analyze eval code for S-box construction
const fs=require('fs'),vm=require('vm'),dom=require('./env.dom');
const v=fs.readFileSync('data/vendor.js','utf-8');
const mt=v.indexOf('__makeTemplateObject([');
const arr=v.indexOf('[',mt);const q=v.indexOf('"',arr);
let i=q+1,raw='';while(i<v.length){if(v[i]==='\\'){raw+=v[i];raw+=v[i+1];i+=2;continue}if(v[i]==='"')break;raw+=v[i];i++}
let code='',j=0;while(j<raw.length){if(raw[j]==='\\'){const n=raw[j+1];if(n==='"'){code+='"';j+=2;continue}if(n==='n'){code+='\n';j+=2;continue}if(n==='r'){code+='\r';j+=2;continue}if(n==='t'){code+='\t';j+=2;continue}if(n==='x'){code+=String.fromCharCode(parseInt(raw.slice(j+2,j+4),16));j+=4;continue}j+=2;continue}code+=raw[j];j++}
fs.writeFileSync('_eval_code.txt',code);

// Search for _0x390b16 initialization - this is the VMP state containing q/p tables
const stateIdx=code.indexOf('_0x390b16=[]');
console.log('_0x390b16=[] at:',stateIdx);
if(stateIdx>=0){
  // Show 300 chars after
  console.log(code.slice(stateIdx,stateIdx+300));
}

// Search for the mns prefix version string
console.log('\n=== mns prefix search ===');
for(const prefix of ['"mns"','mns0','mns2','mns3','0201','0301']){
  let idx=-1,cnt=0;
  while((idx=code.indexOf(prefix,idx+1))>=0&&cnt<3){
    cnt++;
    console.log(prefix+' at '+idx+': '+code.slice(Math.max(0,idx-20),idx+60).replace(/\n/g,' '));
  }
}

// Search for XXTEA-related patterns in eval code
console.log('\n=== XXTEA search ===');
for(const kw of ['3C6EF373','e6483ca2','xxtea','XXTEA']){
  const idx=code.indexOf(kw);
  console.log(kw+':',idx>=0?'FOUND at '+idx:'NOT FOUND');
}

// Search for RC4 patterns
console.log('\n=== RC4 search ===');
for(const kw of ['swap','rc4','RC4','sbox','Sbox','key[i]','key[j]','i=(i']){
  const matches=code.match(new RegExp(kw,'g'));
  console.log(kw+':',matches?matches.length+' occurrences':'0');
}

// Search for 256-element arrays using array literal syntax
console.log('\n=== Array creation ===');
for(const kw of ['new Array(256)','Array(256)','new Array(0x100)','Array(0x100)']){
  const matches=code.match(new RegExp(kw.replace(/[()]/g,'\\$&'),'g'));
  if(matches)console.log(kw+':',matches.length,'occurrences');
}

// Check the bytecode for hex patterns
const bcIdx=code.indexOf('var __$c');
const bcQ=code.indexOf("'",bcIdx)+1;
const bcQ2=code.indexOf("'",bcQ);
const bcHex=code.slice(bcQ,bcQ2);
const bytes=[];for(let k=0;k<bcHex.length;k+=2)bytes.push(parseInt(bcHex.slice(k,k+2),16));
console.log('\nBytecode: '+bytes.length+' bytes');

// Search bytecode for all 256-byte sequences where values are unique
console.log('\nSearching bytecode for S-box candidate...');
let bestMatch=null;
for(let k=0;k<bytes.length-256;k++){
  const slice=bytes.slice(k,k+256);
  const unique=new Set(slice).size;
  if(unique>=200&&(!bestMatch||unique>bestMatch.unique)){
    bestMatch={pos:k,unique,slice};
  }
  if(unique===256)break;
}
if(bestMatch){
  console.log('Best S-box candidate at',bestMatch.pos,'unique:',bestMatch.unique);
  if(bestMatch.unique===256){
    console.log('*** PERFECT S-BOX ***');
    console.log('First 30:',bestMatch.slice.slice(0,30).join(','));
    fs.writeFileSync('_sbox.json',JSON.stringify(bestMatch.slice));
    console.log('Saved to _sbox.json');
  }
}
