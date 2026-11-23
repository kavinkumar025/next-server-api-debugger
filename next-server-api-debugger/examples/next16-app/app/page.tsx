import { debugFetch } from "next-server-api-debugger/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const res=await debugFetch("https://jsonplaceholder.typicode.com/posts/1",{cache:"no-store"});
  const data=await res.json();
  return <main style={{padding:32}}>
    <h1>Server API Debugger Demo</h1>
    <p>Enable: localStorage.setItem("apiDebugLoggin","enabled"); location.reload();</p>
    <pre>{JSON.stringify(data,null,2)}</pre>
  </main>;
}
