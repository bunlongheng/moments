import { subscribe, unsubscribe } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events stream: emits "changed" whenever photos/style change. */
export async function GET() {
    const encoder = new TextEncoder();
    let listener: () => void;
    let heartbeat: ReturnType<typeof setInterval>;

    const stream = new ReadableStream({
        start(controller) {
            const send = (s: string) => {
                try {
                    controller.enqueue(encoder.encode(s));
                } catch {
                    // controller closed
                }
            };
            send(": connected\n\n");
            listener = () => send("data: changed\n\n");
            subscribe(listener);
            heartbeat = setInterval(() => send(": ping\n\n"), 25000);
        },
        cancel() {
            unsubscribe(listener);
            clearInterval(heartbeat);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
