const fs = require('fs');
const code = fs.readFileSync('data/ds_6545c_formatted.js', 'utf-8');
// Extract the string array - find the first array
const start = code.indexOf("var _0x5ae8 = [");
const end = code.indexOf("];", start);
const arrStr = code.slice(start + 15, end + 1);
// Use eval to parse - add opening bracket
const arr = eval('[' + arrStr);
console.log('0x81:', arr[0x81]);
console.log('0x8a:', arr[0x8a]);
console.log('0x95:', arr[0x95]);
console.log('0x73:', arr[0x73]);
console.log('0x6d:', arr[0x6d]);
// Also decode the _0x4d21fc keys
console.log('\n--- Finding check key ---');
for (let i = 0; i < arr.length; i++) {
  if (arr[i] && arr[i].includes && arr[i].includes('hLdrW')) {
    console.log('hLdrW at index', '0x' + i.toString(16), '=', arr[i]);
  }
}
