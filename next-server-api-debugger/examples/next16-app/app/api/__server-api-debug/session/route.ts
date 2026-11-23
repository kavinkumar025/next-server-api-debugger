import {
  debugSessionGET, debugSessionPOST, debugSessionDELETE
} from "next-server-api-debugger/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { debugSessionGET as GET, debugSessionPOST as POST, debugSessionDELETE as DELETE };
