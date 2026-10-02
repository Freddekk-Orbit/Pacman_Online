import type { ClientMsg, ServerMsg } from "../shared/protocol.ts";

function wsUrl(host: string): string {
  const clean = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${clean}/ws`;
}

export class Net {
  ws: WebSocket | null = null;
  onMessage: (msg: ServerMsg) => void = () => {};
  onClose: () => void = () => {};

  connect(host: string, hello: Extract<ClientMsg, { type: "hello" }>): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl(host));
      this.ws = ws;
      const t = setTimeout(() => {
        reject(new Error("Connection timed out."));
        ws.close();
      }, 6000);
      ws.onopen = () => {
        clearTimeout(t);
        ws.send(JSON.stringify(hello));
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(t);
        reject(new Error("Could not reach that cabinet."));
      };
      ws.onmessage = (ev) => {
        try {
          this.onMessage(JSON.parse(String(ev.data)) as ServerMsg);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => this.onClose();
    });
  }

  send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

export function defaultHost(): string {
  return window.location.host;
}
