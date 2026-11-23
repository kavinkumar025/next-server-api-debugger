import { debugFetch } from "next-server-api-debugger/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  const res=await debugFetch("https://jsonplaceholder.typicode.com/posts/1",{cache:"no-store"});
  return Response.json(await res.json());
}
export async function POST(request:Request) {
  const body=await request.json();
  const res=await debugFetch("https://jsonplaceholder.typicode.com/posts",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
  });
  return Response.json(await res.json(),{status:201});
}
