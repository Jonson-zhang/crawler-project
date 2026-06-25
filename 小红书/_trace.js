var fs = require("fs");
var origLog = console.log; console.log = function(){};

var lines = fs.readFileSync("1.md","utf8").split("\n");
eval(lines.slice(1642,2056).join("\n"));
origLog("[1] env ok");

var oB=Function.prototype.bind, oA=Function.prototype.apply;
Function.prototype.bind=function(ctx){if(typeof this!=="function")return function(){};try{return oB.apply(this,arguments);}catch(e){return function(){}};};
Function.prototype.apply=function(ctx,args){if(typeof this!=="function")return undefined;try{return oA.call(this,ctx,args||[]);}catch(e){return undefined};};

eval(fs.readFileSync("data/fp_raw.js","utf8"));
eval(fs.readFileSync("data/ds_api_raw.js","utf8"));
origLog("[2] fp+api ok");

// Hook _AUuXfEG27Xa3x: auto-fill env array
var realAu;
Object.defineProperty(global,"_AUuXfEG27Xa3x",{
  get:function(){return realAu;},
  set:function(fn){
    if(typeof fn==="function"){
      origLog("[3] _AUuXfEG27Xa3x defined, interp size="+fn.toString().length);
      realAu=function(bc,env){
        for(var i=0;i<200;i++){
          if(env[i]===undefined){
            var stub=function(){};
            stub.prototype={};
            env[i]=stub;
          }
        }
        origLog("[4] VMP called, bc="+bc.length);
        return fn.call(this,bc,env);
      };
    } else { realAu=fn; }
  },
  configurable:true,enumerable:true
});

// Load ONLINE ds_v2 (formatted) with ITS OWN interpreter + bytecode
try {
  eval(fs.readFileSync("data/ds_v2_6545c_online.js","utf8"));
  origLog("[4] online ds_v2 loaded");
} catch(e) {
  origLog("[4] ds_v2 ERR: "+e.message.substring(0,200));
}

Function.prototype.bind=oB; Function.prototype.apply=oA;

origLog("mnsv2: "+typeof mnsv2);
if(typeof mnsv2==="function"){
  var r=mnsv2("test","abc123abc123abc123abc123abc123ab","def456def456def456def456def456de");
  origLog("PREFIX: "+(r||"").substring(0,40));
  origLog("0301:"+String(r||"").startsWith("mns0301"));
  origLog("0201:"+String(r||"").startsWith("mns0201"));
}
