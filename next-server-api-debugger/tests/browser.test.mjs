import assert from "node:assert/strict";
import { test } from "node:test";

let id = 0;
async function withBrowser(run,mode="development") {
  const prior = {
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    fetch: globalThis.fetch,
    env: process.env.NODE_ENV
  };
  const intervals = [];
  const data = new Map();
  globalThis.window = {
    setInterval(callback) { intervals.push(callback); return intervals.length; },
    addEventListener() {}
  };
  globalThis.localStorage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key,value) { data.set(key,String(value)); }
  };
  process.env.NODE_ENV = mode;
  try {
    await import("../dist/browser.js?browser-test="+(++id));
    assert.equal(intervals.length,2,"browser debugger registered both timers");
    assert.equal(localStorage.getItem("apiDebugLogging"),"disabled");
    await run({ sync: intervals[0], read:()=>localStorage.getItem("apiDebugLogging") });
  } finally {
    globalThis.window = prior.window;
    globalThis.localStorage = prior.localStorage;
    globalThis.fetch = prior.fetch;
    if (prior.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior.env;
  }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("storage key shows connecting then enabled after successful authentication",async()=>{
  await withBrowser(async ({sync,read})=>{
    let receivedKey;
    globalThis.fetch = async (_url,options)=>{
      receivedKey=JSON.parse(options.body).key;
      return {ok:true,status:200,json:async()=>({authenticated:true})};
    };
    localStorage.setItem("apiDebugLogging","private-test-key");
    sync();
    assert.equal(read(),"connecting");
    await flush();
    assert.equal(receivedKey,"private-test-key");
    assert.equal(read(),"enabled");
  });
});
test("incorrect key shows visible failure without retaining plaintext",async()=>{
  await withBrowser(async ({sync,read})=>{
    globalThis.fetch = async ()=>({
      ok:false,status:401,json:async()=>({error:"Incorrect private debugging key"})
    });
    localStorage.setItem("apiDebugLogging","wrong");
    sync();
    assert.equal(read(),"connecting");
    await flush();
    assert.equal(read(),"error:401");
  });
});
test("disabling during authentication does not re-enable logging",async()=>{
  await withBrowser(async ({sync,read})=>{
    let finishLogin;
    globalThis.fetch = (_url,options)=>{
      if(options?.method==="DELETE")
        return Promise.resolve({ok:true,status:200,json:async()=>({authenticated:false})});
      return new Promise(resolve=>{finishLogin=resolve;});
    };
    localStorage.setItem("apiDebugLogging","key");
    sync();
    assert.equal(read(),"connecting");
    localStorage.setItem("apiDebugLogging","disabled");
    finishLogin({ok:true,status:200,json:async()=>({authenticated:true})});
    await flush();
    assert.equal(read(),"disabled");
  });
});
test("enabled without a valid server session shows a visible error",async()=>{
  await withBrowser(async ({sync,read})=>{
    globalThis.fetch = async ()=>({
      ok:true,status:200,json:async()=>({authenticated:false})
    });
    localStorage.setItem("apiDebugLogging","enabled");
    sync();
    await flush();
    assert.equal(read(),"error:session-expired");
  });
});

test("production instrumentation activates with a long, server-approved key",async()=>{
  await withBrowser(async({sync,read})=>{
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({authenticated:true})});
    localStorage.setItem("apiDebugLogging","A".repeat(43));
    sync();
    assert.equal(read(),"connecting");
    await flush();
    assert.equal(read(),"enabled");
  },"production");
});
