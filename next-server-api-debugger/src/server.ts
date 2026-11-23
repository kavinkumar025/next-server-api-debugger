
export type ApiDebugEvent = {
    method: string;
    url: string;
    status: number;
    durationMs: number;
};

export function logServerApi(event: ApiDebugEvent) {
    console.info("[Server API Debug]", event);
}