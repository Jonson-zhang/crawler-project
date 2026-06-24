#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),util=require('util');
const noop=()=>{},out=s=>fs.writeSync(1,s+'\n');
const origOut=process.stdout.write, origErr=process.stderr.write;
process.stdout.write=()=>true;
process.stderr.write=()=>true;
globalThis.console={log:noop,error:noop,warn:noop,info:noop,debug:noop,trace:noop};
globalThis.window=globalThis;
globalThis.self=globalThis;
try{globalThis.location={host:'gdtv-api.gdtv.cn'}}catch(e){}
try{globalThis.document={location:{host:'gdtv-api.gdtv.cn'}}}catch(e){}
try{Object.defineProperty(globalThis,'navigator',{value:{},configurable:true})}catch(e){}

let f=null;
const arr=[];arr.push=function(c){const[,m]=c;f=m[266]||m[265];return 0};
globalThis.window.webpackJsonp=arr;

// Try loading: WASM version then JS fallback
const wasmF=path.join(__dirname,'..','vendor_w_b4fcb8bf.js');
const fallF=path.join(__dirname,'..','vendor_w_fallback_b4fcb8bf.js');
try{eval(fs.readFileSync(wasmF,'utf-8'))}catch(_){}
if(!f){try{eval(fs.readFileSync(fallF,'utf-8'))}catch(_){}}

process.stdout.write=origOut;
process.stderr.write=origErr;

if(!f){out(JSON.stringify({error:'module not found'}));process.exit(1)}

const mod={exports:{}};
f(mod,mod.exports,id=>id==='util'?util:null);
const signer=mod.exports.a;

const method=process.argv[2]||'GET';
const p=process.argv[3]||'/api/channel/v1/news';
const q=process.argv[4]||'beginScore=0&pageSize=2&channelId=117';
const url=p+(q?'?'+q:'');
const did='WEB_'+'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
  const r=Math.random()*16|0;
  return(c==='x'?r:(r&0x3|0x8)).toString(16);
});

try{
  const headers=signer(method,url,did,'WEB_PC','',undefined);
  out(JSON.stringify(headers));
}catch(e){
  out(JSON.stringify({error:e.message}));
}
process.exit(0);
