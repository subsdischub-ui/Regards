type SSEConnection = {
  controller: ReadableStreamDefaultController;
  guestId: string;
};

const connections = new Map<string, SSEConnection>();
let eventCounter = 0;

export function addConnection(id: string, controller: ReadableStreamDefaultController, guestId: string) {
  connections.set(id, { controller, guestId });
}

export function removeConnection(id: string) {
  connections.delete(id);
}

export function broadcast(event: string, data: Record<string, any>) {
  eventCounter++;
  const message = `id: ${eventCounter}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);

  for (const [id, conn] of connections) {
    try {
      conn.controller.enqueue(encoded);
    } catch {
      connections.delete(id);
    }
  }
}

export function getConnectionCount() {
  return connections.size;
}