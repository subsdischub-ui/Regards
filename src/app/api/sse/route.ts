import { addConnection, removeConnection } from '@/lib/sse';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guestId = new URL(request.url).searchParams.get('guest_id') || 'anonymous';
  const connectionId = uuid();

  const stream = new ReadableStream({
    start(controller) {
      addConnection(connectionId, controller, guestId);

      // Send initial heartbeat
      const heartbeat = new TextEncoder().encode(': heartbeat\n\n');
      controller.enqueue(heartbeat);

      // Keepalive every 30 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(heartbeat);
        } catch {
          clearInterval(interval);
          removeConnection(connectionId);
        }
      }, 30000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        removeConnection(connectionId);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      removeConnection(connectionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}