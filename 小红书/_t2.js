// Minimal: env + ds_api + online ds_v2, no FP
var fs=require("fs"),L=console.log;console.log=function(){};

var lines=fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642,2056).join("\n"));
// Ensure MutationObserver exists (1.md env watches everything but we need the constructor)
if(typeof MutationObserver==="undefined") global.MutationObserver=function(cb){this.observe=function(){};this.disconnect=function(){};};
L("env ok, MO:"+typeof MutationObserver);

eval(fs.readFileSync("data/ds_api_raw.js","utf8"));
L("api ok, BHjFmf:"+(typeof _BHjFmfUMEtxhI));

// FP with bind fix
var oB=Function.prototype.bind;
Function.prototype.bind=function(ctx){if(typeof this!=="function")return function(){};try{return oB.apply(this,arguments);}catch(e){return function(){}};};
void eval(fs.readFileSync("data/fp_raw.js","utf8"));
Function.prototype.bind=oB;
L("fp ok");

// Hook AUuXf with auto-fill env
var ra;
Object.defineProperty(global,"_AUuXfEG27Xa3x",{
  get:function(){return ra;},
  set:function(fn){
    if(typeof fn==="function"){
      L("AUuXf hooked, size="+fn.toString().length);
      ra=function(bc,env){
        // Fill missing env with actual browser objects from 1.md env
        var known=[,,Function,document,performance,MutationObserver,Object,Array,TextEncoder,window,encodeURIComponent,undefined];
        for(var i=0;i<200;i++)if(env[i]===undefined){
          if(known[i]!==undefined) env[i]=known[i];
          else {var s=function(){};s.prototype={};env[i]=s;}
        }
        L("VMP called, bc="+bc.length+" env="+env.length);
        return fn.call(window,bc,env);
      };
    } else ra=fn;
  },
  configurable:true,enumerable:true
});

// Load online ds_v2
try{
  L("loading ds_v2...");
  eval(fs.readFileSync("data/ds_v2_6545c_online.js","utf8"));
  L("ds_v2 ok");
}catch(e){L("ds_v2 ERR:"+e.message.substring(0,200));}

L("===RESULT=== mnsv2:"+typeof mnsv2);
if(typeof mnsv2==="function"){
  var r=mnsv2("test","abc1","def4");
  L("PREFIX:"+r.substring(0,40)+" 0301:"+String(r).startsWith("mns0301")+" 0201:"+String(r).startsWith("mns0201"));
}
