import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicMode = process.argv.includes("--public");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, useShell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: false,
      env: process.env,
      shell: useShell,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code ?? "null"}`));
    });
    child.on("error", reject);
  });
}

if (!existsSync(join(root, "dist", "client", "index.html"))) {
  console.log("Building the game client once...");
  await run(npmCmd, ["run", "build"], process.platform === "win32");
}

if (!existsSync(tsxCli)) {
  console.error("tsx is missing. Run: npm install");
  process.exit(1);
}

console.log("");
console.log("==========================================");
console.log(" PACMAN ONLINE — DEDICATED CABINET");
console.log(" Leave this window open. This machine hosts.");
console.log(" Play from other computers, not this one.");
console.log(" Host console:  http://localhost:3000/console");
console.log("==========================================");
console.log("");

const serverArgs = [tsxCli, "src/server/index.ts"];
if (publicMode) serverArgs.push("--world");
await run(process.execPath, serverArgs);
