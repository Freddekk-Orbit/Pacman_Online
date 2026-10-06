import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CF_URLS: Record<string, string> = {
  "linux-x64": "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
  "linux-arm64": "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64",
  "win32-x64": "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
  "win32-arm64": "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
};

function platformKey(): string {
  if (process.platform === "win32") return process.arch === "arm64" ? "win32-arm64" : "win32-x64";
  if (process.platform === "linux") return process.arch === "arm64" ? "linux-arm64" : "linux-x64";
  return "";
}

async function resolveBinary(): Promise<string | null> {
  if (process.env.CLOUDFLARED_BIN && existsSync(process.env.CLOUDFLARED_BIN)) {
    return process.env.CLOUDFLARED_BIN;
  }
  const cache = join(homedir(), ".cache", "pacman-online");
  const cached = join(cache, process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
  if (existsSync(cached)) return cached;

  const key = platformKey();
  const url = CF_URLS[key];
  if (!url) return null;

  try {
    mkdirSync(cache, { recursive: true });
    const res = await fetch(url);
    if (!res.ok) return null;
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
    chmodSync(cached, 0o755);
    return cached;
  } catch {
    return null;
  }
}

export async function startWorldwideTunnel(port: number): Promise<string | null> {
  const bin = (await resolveBinary()) ?? "cloudflared";
  return new Promise((resolve) => {
    let settled = false;
    let child: ChildProcess;
    try {
      child = spawn(bin, ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      resolve(null);
      return;
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 20_000);

    const onData = (buf: Buffer) => {
      const text = buf.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        console.log(`WORLDWIDE tunnel: ${match[0]}`);
        resolve(match[0]);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
    child.on("exit", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
}
