import type { IncomingHttpHeaders } from "node:http";

export interface OriginHints {
  headers?: IncomingHttpHeaders;
  publicUrl?: string;
  tunnelUrl?: string;
  port?: number;
}

function firstHeader(value: string | string[] | undefined): string {
  if (!value) return "";
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(",")[0]?.trim() ?? "";
}

export function publicOrigin(hints: OriginHints = {}): string {
  const fromEnv = (hints.publicUrl ?? process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const tunnel = (hints.tunnelUrl ?? "").replace(/\/$/, "");
  if (tunnel) return tunnel;

  const headers = hints.headers ?? {};
  const host = firstHeader(headers["x-forwarded-host"]) || firstHeader(headers.host);
  if (host) {
    const proto =
      firstHeader(headers["x-forwarded-proto"]) ||
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }

  const port = hints.port ?? Number(process.env.PORT || 3000);
  return `http://localhost:${port}`;
}

export function inviteUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/?join=${encodeURIComponent(code.toUpperCase())}`;
}

export function parseJoinCode(search: string): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return (q.get("join") || q.get("code") || "").trim().toUpperCase();
}
