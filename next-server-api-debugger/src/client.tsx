
"use client";

import { useEffect, type ReactNode } from "react";

export function ApiDebugProvider({
    children
}: {
    children: ReactNode;
}) {
    useEffect(() => {
        const key = localStorage.getItem("apiDebugLoggin");

        if (key) {
            console.info("[API Debugger] Client debugging requested");
        }
    }, []);

    return <>{children}</>;
}