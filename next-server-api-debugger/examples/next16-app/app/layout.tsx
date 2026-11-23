import { ApiDebugProvider } from "next-server-api-debugger/client";
import type { ReactNode } from "react";

export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="en"><body><ApiDebugProvider>{children}</ApiDebugProvider></body></html>;
}
