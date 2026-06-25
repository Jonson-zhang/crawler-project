// Overlay: 1.md baseline → online ds_v2 upgrade
var fs=require("fs"),L=console.log;console.log=function(){};

// Ensure MutationObserver
global.MutationObserver=function(cb){this.observe=function(){};this.disconnect=function(){};};

var lines=fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642,2056).join("\n"));
eval(lines.slice(137,1638).join("\n"));
var r1=mnsv2("test","abc1","def4");
L("BEFORE: "+r1.substring(0,30)+" 0201:"+String(r1).startsWith("mns0201"));

// Now overlay with online ds_v2 interpreter + bytecode
var ra, origAu=global._AUuXfEG27Xa3x;
Object.defineProperty(global,"_AUuXfEG27Xa3x",{
  get:function(){return ra||origAu;},
  set:function(fn){
    if(typeof fn==="function" && fn.toString().length > 100000){
      // This is the online interpreter (401K chars)
      ra=function(bc,env){
        for(var i=0;i<200;i++)if(env[i]===undefined){var s=function(){};s.prototype={};env[i]=s;}
        L("online VMP called, bc="+bc.length);
        return fn.call(window,bc,env);
      };
      L("online AUuXf captured");
    } else {ra=fn;}
  },
  configurable:true,enumerable:true
});

// Load ds_api for BHjFmf
eval(fs.readFileSync("data/ds_api_raw.js","utf8"));

// Load online ds_v2 - its VMP interpreter will be captured by the hook above
try{
  eval(fs.readFileSync("data/ds_v2_6545c_online.js","utf8"));
  L("online ds_v2 loaded");
}catch(e){L("ds_v2 ERR:"+e.message.substring(0,200));}

// After overlay, check mnsv2
var r2=mnsv2("test","abc1","def4");
L("AFTER: "+r2.substring(0,30)+" 0301:"+String(r2).startsWith("mns0301")+" 0201:"+String(r2).startsWith("mns0201"));
L("CHANGED: "+(r1!==r2));
