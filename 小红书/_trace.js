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

// Intercept _AUuXfEG27Xa3x
var realAu;
Object.defineProperty(global,"_AUuXfEG27Xa3x",{
  get:function(){return realAu;},
  set:function(fn){
    if(typeof fn==="function"){
      realAu=function(bc,env){
        for(var i=0;i<200;i++)if(env[i]===undefined)env[i]=function(){this.name="s"+i;};
        origLog("[3] calling VMP, bc="+bc.length+" env="+env.length);
        return fn.call(this,bc,env);
      };
    }
  },
  configurable:true,enumerable:true
});

// Build hybrid: 1.md VMP + online bytecode + 1.md init env
var ds1md=lines.slice(137,1638).join("\n");
var onlineBc=fs.readFileSync("data/online_bc.txt","utf8");

// 1.md bytecode: '56544b424251464d00283e...378760...'
// Find it by header
var bcStart=ds1md.indexOf("56544b424251464d00283e");
var bcEnd=ds1md.indexOf("';",bcStart);
if(bcEnd<0)bcEnd=ds1md.lastIndexOf("';");

origLog("[3] 1.md bc: "+bcStart+"-"+bcEnd+" len="+(bcEnd-bcStart));
var hybrid=ds1md.substring(0,bcStart)+onlineBc+ds1md.substring(bcEnd);

// The init call: glb['_AUuXfEG27Xa3x'](__$c, [28 items])
// This stays from 1.md - provides 28 env items which is more than online needs

try {
  eval(hybrid);
  origLog("[3] hybrid eval OK");
} catch(e) {
  origLog("[3] hybrid ERR: "+e.message.substring(0,200));
  var stk=(e.stack||"").split("\n").filter(function(l){return l.indexOf("at ")>-1;}).slice(0,5);
  stk.forEach(function(l){origLog("  "+l.trim().substring(0,150));});
  Function.prototype.bind=oB; Function.prototype.apply=oA;
  origLog("mnsv2: "+typeof mnsv2);
  process.exit(1);
}

Function.prototype.bind=oB; Function.prototype.apply=oA;

origLog("=== RESULT ===");
origLog("mnsv2: "+typeof mnsv2);
if(typeof mnsv2==="function"){
  var r=mnsv2("test","abca","def4");
  origLog("prefix: "+(r||"").substring(0,40));
  origLog("0301:"+String(r||"").startsWith("mns0301"));
  origLog("0201:"+String(r||"").startsWith("mns0201"));
}
