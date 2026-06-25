var fs=require("fs"),L=console.log; console.log=function(){};
var lines=fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642,2056).join("\n"));

var _call=Function.prototype.call;
Function.prototype.call=function(ctx){if(ctx===undefined||ctx===null)ctx=window||global;return _call.apply(this,arguments);};
var oB=Function.prototype.bind;
Function.prototype.bind=function(ctx){if(typeof this!=="function")return function(){};try{return oB.apply(this,arguments);}catch(e){return function(){}};};

process.stderr.write("loading fp...\n");
void eval(fs.readFileSync("data/fp_raw.js","utf8"));
process.stderr.write("loading api...\n");
eval(fs.readFileSync("data/ds_api_raw.js","utf8"));

var ra;
Object.defineProperty(global,"_AUuXfEG27Xa3x",{
  get:function(){return ra;},
  set:function(fn){
    if(typeof fn==="function"){
      ra=function(bc,env){
        for(var i=0;i<200;i++)if(env[i]===undefined){var s=function(){};s.prototype={};env[i]=s;}
        return fn.call(window,bc,env);
      };
      process.stderr.write("AUuXf hooked\n");
    } else ra=fn;
  },
  configurable:true,enumerable:true
});

process.stderr.write("loading ds_v2...\n");
try{eval(fs.readFileSync("data/ds_v2_6545c_online.js","utf8"));process.stderr.write("ds_v2 OK\n");}catch(e){process.stderr.write("ds_v2 ERR:"+e.message.substring(0,200)+"\n");}

Function.prototype.call=_call; Function.prototype.bind=oB;

L("mnsv2:"+typeof mnsv2);
if(typeof mnsv2==="function"){var r=mnsv2("test","abc1","def4");L("R:"+r.substring(0,40)+" 0301:"+String(r).startsWith("mns0301"));}
