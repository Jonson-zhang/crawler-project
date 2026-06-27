# Boss直聘

## 一、加密分析
#### 1、数据分析
输入查询职位后，抓包分析（清空缓存和 cookie）



![1762910766747-78630a2c-0239-4070-ac02-6b2099be4629.png](1762910766747-78630a2c-0239-4070-ac02-6b2099be4629-678807.png)



joblist.json 中包含当前页中 10 条岗位信息，而detail.json 是每条岗位信息招聘详情



#### 2、加密参数定位--joblist.json
响应内容是明文 

载荷的“查询字符串”中有一个时间戳

请求头中 cookie 里有一个加密参数：__zp_stoken__，不定长， 共 400 多位



全局搜索 __zp_stoken__，定位到

```python
 r && i.default.set("__zp_stoken__", r, 3840, c, "/"),
```

其中 r 的值就是所需的__zp_stoken__。往上查看，不远处由生成 r 的地方

![1765892223175-59d94513-0065-4797-94bb-c91d6809d310.png](1765892223175-59d94513-0065-4797-94bb-c91d6809d310-721567.png)



在位置 2 处，

+ 60 * (480 + (new Date).getTimezoneOffset()) * 1e3 =0
+ n 是时间戳
+ 需要查看变量 e的出处



通过调用堆栈，查看上一个函数 r(c,A)

![1765892492599-5ab95a83-b8da-4dc3-a1de-61db092a78b3.png](1765892492599-5ab95a83-b8da-4dc3-a1de-61db092a78b3-137425.png)





其中 c 是前面的参数 e，查看 c 生成的地方

![1765893285377-f20321a1-81b4-4244-a08f-78e6d78156a3.png](1765893285377-f20321a1-81b4-4244-a08f-78e6d78156a3-250637.png)

发现 c 和 A 都是这里生成的

```python
   function(c, u, A) {
                if (!c || !u || !A) {
                    c = i.default.get("__zp_sseed__"),
                    u = i.default.get("__zp_sname__"),
                    A = i.default.get("__zp_sts__");
............................................................
...........................................................
```

下断点后，发现 c，A 都是在这里获得值，跟踪i.default.get，其实是从 cookie 里获得的数据

```python
 get: function(t) {
                var e, n = new RegExp("(^| )" + t + "=([^;]*)(;|$)");
                return (e = document.cookie.match(n)) ? unescape(e[2]) : null
            },
```



清空 cookie，重新提交查询，看到首页：[https://www.zhipin.com/web/geek/jobs?query=python&city=101010100](https://www.zhipin.com/web/geek/jobs?query=python&city=101010100)

并没有__zp_sseed__

![1763005122587-9017dbe8-976b-4b14-a70f-d1bb67673c9f.png](1763005122587-9017dbe8-976b-4b14-a70f-d1bb67673c9f-709640.png)

但是 joblist.json 中__zp_sseed__ 已经存在

![1763005198055-f8da20eb-8295-4926-9718-a9cd5c83b8dd.png](1763005198055-f8da20eb-8295-4926-9718-a9cd5c83b8dd-310577.png)



所以生成__zp_stoken__ 时，如果本地 cookie 中存在__zp_sseed__，就赋值给 C，如果没有，就生成

我们现在先从 cookie 中获取__zp_sseed__ 的值<font style="color:#080808;background-color:#ffffff;">："7ePnpuacOvTasGETiYF7cP0z2dQs7L4tbZtw513WvsM="，A 是时间戳</font>

进入 r（c，A），发现加密代码是：

```python
r = (new t).z(e, parseInt(n) + 60 * (480 + (new Date).getTimezoneOffset()) * 1e3)
```

其中参数 e 是"oQRP3s483ALpqt8fQlC29Z0sEbJyP5xXGnv0yeyifAY="，n 是时间<font style="color:#080808;background-color:#ffffff;">戳</font>

<font style="color:#080808;background-color:#ffffff;"></font>

<font style="color:#080808;background-color:#ffffff;">再继续跟踪 z 函数，此时进入另外一个 js 文件c96b5700.js，（这个文件也不是固定的，定期会被修改替代）</font>![1765893563766-2ab7a89f-86e5-422c-af60-2cec80fa8638.png](1765893563766-2ab7a89f-86e5-422c-af60-2cec80fa8638-987688.png)

输出的字符串长度大约 453 或 457 等



由于 l 函数所在的 js 文件，是个巨大的自执行函数，所以把整个文件都扣下来



## 二、补环境
由于 L 函数很复杂，是c96b5700.js文件的主要部分，c96b5700.js内容是一个自执行函数，分两部分，第一部分是try-catch，第二部分是函数L

![1763041754899-51a61d7a-4961-4165-8ed9-b9d77558ca7d.png](1763041754899-51a61d7a-4961-4165-8ed9-b9d77558ca7d-462884.png)

所以我们将c96<font style="color:#080808;background-color:#ffffff;">b5700.js 文件内容全部抠出来，开始补环境。</font>

<font style="color:#080808;background-color:#ffffff;"></font>

<font style="color:#080808;background-color:#ffffff;">1、 首先将 L 函数挂载到 window</font>

<font style="color:#080808;background-color:#ffffff;">便于调用，先将 e，n 的值固定，方便与照浏览器的输出比对。如上图所示。执行后，输出的长度只有 200 多位，显然不对。另外，执行过程没有报错，显然也是有问题</font>

<font style="color:#080808;background-color:#ffffff;"></font>

<font style="color:#080808;background-color:#ffffff;">2、观察 L 函数，内部也是 try-catch 结构</font>

在 catch 中添加输出，console.log(l)，其中 l 是 catch 的参数。如下图所示 

![1763041967298-eb30cbc1-1f29-4c36-b171-61b4b5c8a94a.png](1763041967298-eb30cbc1-1f29-4c36-b171-61b4b5c8a94a-404739.png)

再次运行程序，输出一堆错误，



3、 首先补 document，然后补 screen，现在报错

```python
ReferenceError: self is not defined
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:15365:53
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:15402:46

```

如何确定 self？ 可以先根据错误的行号（15365:53），在 pycharm 中定位到相应行

![1763042414081-a7bb9983-ae61-481a-a162-257c021f3847.png](1763042414081-a7bb9983-ae61-481a-a162-257c021f3847-333007.png)

然后到 devtool 中，在相应位置下断点，执行到该处时，在控制台中查看 self

![1763042473040-6b1e068c-e243-40dd-ad12-acbb5184e96b.png](1763042473040-6b1e068c-e243-40dd-ad12-acbb5184e96b-281316.png)

可见，self 就是 window，所以补上 

```python
self = window
```



4、现在报：ReferenceError: PluginArray is not defined

 按照上面办法，在控制台查看PluginArray，显示是一个函数，但不知道属于哪个对象

![1763042773004-da049e5a-a7a1-4403-b353-d416a648f526.png](1763042773004-da049e5a-a7a1-4403-b353-d416a648f526-036514.png)

对于这种情况，只能使用代理来分析，AI 写了一个代理程序

```python
function setProxyArr(proxyObjArr) {
    // 动态获取全局对象
    const globalObj = typeof window !== 'undefined' ? window : global;

    for (let i = 0; i < proxyObjArr.length; i++) {
        const objName = proxyObjArr[i];

        const handler = {
            get(target, property, receiver) {
                // 捕获当前的调用栈
                const stack = new Error().stack;

                // 尝试获取调用方信息（可选，格式可能因浏览器而异）
                // const callerInfo = stack ? stack.split('\n')[2] : 'N/A'; // 取调用栈的第三行，通常是调用方

                console.log(
                    "方法:", "get",
                    "对象:", objName,
                    "属性名称:", property,
                    // "属性类型:", typeof property,
                    "目标值类型:", typeof target[property], // 增加目标值的类型
                    "目标值:", target[property], // 增加目标值（如果是基本类型或可打印对象）
                    "\n调用栈:\n", stack // 输出完整的调用栈
                );

                return target[property];
            },
            set(target, property, value, receiver) {
                const stack = new Error().stack;

                console.log(
                    "方法:", "set",
                    "对象:", objName,
                    "属性:", property,
                    "新值:", value,
                    "新值类型:", typeof value,
                    "\n调用栈:\n", stack
                );

                target[property] = value;
                return true;
            }
        };

        // 初始化目标对象
        let targetObject = globalObj[objName] || {};
        globalObj[objName] = new Proxy(targetObject, handler);
    }
}


setProxyArr([
   "window", "document", "navigator", "location", "history", "screen", "localStorage", "sessionStorage"
]);


```

```python
function setProxyArr(proxyObjArr) {
    const globalObj = typeof window !== 'undefined' ? window : global;

    const proxyCache = new WeakMap();

    function isLikelyPatchedObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        if (obj.constructor !== Object && obj.constructor !== Array) {
            return false;
        }
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (value && typeof value === 'object' && value.constructor !== Object && value.constructor !== Array) {
                    return false;
                }
            }
        }
        return true;
    }

    const isPatchedObject = isLikelyPatchedObject;

    function createHandler(objName) {
        return {
            get(target, property, receiver) {
                const targetIsPatched = isPatchedObject(target);
                const targetValue = Reflect.get(target, property, receiver);
                const targetValueIsPatched = isPatchedObject(targetValue);
                const propertyExists = property in target;

                if (!targetIsPatched) {
                    const stack = new Error().stack;
                    console.log(
                        "方法:", "get",
                        "对象:", objName,
                        "对象本身:", targetIsPatched ? "（已补）" : "（未补）", // 修改此处
                        "属性名称:", property,
                        "属性:", propertyExists ? "（已补）" : "（未补）", // 修改此处
                        "目标值类型:", typeof targetValue,
                        "目标值:", targetValue,
                        "目标值(属性值):", targetValueIsPatched ? "（已补）" : "（未补）", // 修改此处
                        "\n调用栈:\n", stack
                    );
                } else if (targetIsPatched && !propertyExists) {
                    const stack = new Error().stack;
                    console.log(
                        "方法:", "get",
                        "对象:", objName,
                        "对象本身:", targetIsPatched ? "（已补）" : "（未补）", // 修改此处
                        "属性名称:", property,
                        "属性:", propertyExists ? "（已补）" : "（未补）", // 修改此处
                        "目标值类型:", typeof targetValue,
                        "目标值:", targetValue,
                        "警告: 访问了已补好对象上缺失的属性!",
                        "\n调用栈:\n", stack
                    );
                } else if (targetIsPatched && propertyExists && typeof targetValue === 'object' && !targetValueIsPatched) {
                    const stack = new Error().stack;
                    console.log(
                        "方法:", "get",
                        "对象:", objName,
                        "对象本身:", targetIsPatched ? "（已补）" : "（未补）", // 修改此处
                        "属性名称:", property,
                        "属性:", propertyExists ? "（已补）" : "（未补）", // 修改此处
                        "目标值类型:", typeof targetValue,
                        "目标值:", targetValue,
                        "目标值(属性值):", targetValueIsPatched ? "（已补）" : "（未补）", // 修改此处
                        "\n调用栈:\n", stack
                    );
                }

                if (targetValue && typeof targetValue === 'object') {
                    if (targetValueIsPatched) {
                        return targetValue;
                    } else {
                        if (!proxyCache.has(targetValue)) {
                            const newProxy = new Proxy(targetValue, createHandler(`${objName}.${String(property)}`));
                            proxyCache.set(targetValue, newProxy);
                            console.log(`  - 为未补好的嵌套对象 ${objName}.${String(property)} 创建了代理。`);
                            return newProxy;
                        } else {
                            return proxyCache.get(targetValue);
                        }
                    }
                }

                return targetValue;
            },
            set(target, property, value, receiver) {
                const targetIsPatched = isPatchedObject(target);

                if (!targetIsPatched || !isPatchedObject(value)) {
                    const stack = new Error().stack;

                    console.log(
                        "方法:", "set",
                        "对象:", objName,
                        "对象本身:", targetIsPatched ? "（已补）" : "（未补）", // 修改此处
                        "属性:", property,
                        "属性类型:", typeof property,
                        "新值:", value,
                        "新值类型:", typeof value,
                        "新值:", isPatchedObject(value) ? "（已补）" : "（未补）", // 修改此处
                        "\n调用栈:\n", stack
                    );
                }

                const result = Reflect.set(target, property, value, receiver);
                if (!result) {
                    console.error(`--- 设置 ${objName}.${String(property)} 失败！---`);
                }
                return result;
            }
        };
    }

    for (let i = 0; i < proxyObjArr.length; i++) {
        const objName = proxyObjArr[i];

        let targetObject = globalObj[objName];
        if (targetObject === undefined) {
            targetObject = {};
            globalObj[objName] = targetObject;
        }

        let isAlreadyProxied = false;
        try {
            isAlreadyProxied = targetObject instanceof Proxy;
        } catch (e) {
            isAlreadyProxied = false;
        }

        if (isAlreadyProxied) {
            continue;
        }

        globalObj[objName] = new Proxy(targetObject, createHandler(objName));
    }
}

setProxyArr([
   "window", "document", "navigator", "location", "history", "screen", "localStorage", "sessionStorage"
]);
```

运行后拦截到太多的错误，我们可以先不拦截 window，先看看"document", "navigator"等的问题。

不拦截 window，只需在setProxyArr 中删掉 window 即可，如下

```python
setProxyArr([
    "document", "navigator", "location", "history", "screen", "localStorage", "sessionStorage"
]);
```



运行代码，报出一些错误，如

```python
方法: get 对象: document 属性: documentElement 属性类型: string 目标值类型: undefined 目标值: undefined 
调用栈:
 Error
    at Object.get (H:\Python\MyPythonProject\code\Boss直聘\boss.js:30:31)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:2558:59
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:2582:46
    at L (H:\Python\MyPythonProject\code\Boss直聘\boss.js:2766:34)
    at p (H:\Python\MyPythonProject\code\Boss直聘\boss.js:34892:66)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:29986:66
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:30016:46
    at L (H:\Python\MyPythonProject\code\Boss直聘\boss.js:30643:34)
    at c (H:\Python\MyPythonProject\code\Boss直聘\boss.js:32475:66)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:25275:66
方法: get 对象: location 属性: hostname 属性类型: string 目标值类型: undefined 目标值: undefined 
调用栈:
 Error
    at Object.get (H:\Python\MyPythonProject\code\Boss直聘\boss.js:30:31)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:26035:60
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:26054:46
    at L (H:\Python\MyPythonProject\code\Boss直聘\boss.js:26932:34)
    at c (H:\Python\MyPythonProject\code\Boss直聘\boss.js:24241:66)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:7789:66
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:7812:46
    at L (H:\Python\MyPythonProject\code\Boss直聘\boss.js:8359:34)
    at c (H:\Python\MyPythonProject\code\Boss直聘\boss.js:32475:66)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:25275:66
方法: get 对象: screen 属性: availWidth 属性类型: string 目标值类型: undefined 目标值: undefined 

........................................................................
........................................................................


ReferenceError: PluginArray is not defined
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:36411:53
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:36426:46
    at L (H:\Python\MyPythonProject\code\Boss直聘\boss.js:37552:34)

```

注意 ：此处 并没有显示 PluginArray是属于哪个对象，这是因为前面我们并没有拦截 window，所以系统不知道PluginArray是属于哪个对象，这也就得出一个结论：PluginArray是属于 window 对象



5、按照代理输出补环境

首先报：

```python
方法: get 对象: document 属性名称: documentElement 目标值类型: undefined 目标值: undefined 
调用栈:
 Error
    at Object.get (H:\Python\MyPythonProject\code\Boss直聘\boss.js:30:31)
    at H:\Python\MyPythonProject\code\Boss直聘\boss.js:2558:59

```

按照前面方法，先在查找代码的 2558 行，内容： Ol = n[Pl]; 然后到 devtools 中找到相应内容，下断点，在控制台中查看n[Pl]

![1763045659842-b1c7a40c-d6b1-4c26-8d75-cd730ae48ac9.png](1763045659842-b1c7a40c-d6b1-4c26-8d75-cd730ae48ac9-005734.png)

也就是说，documentElement 是属于 document，类型是 object











