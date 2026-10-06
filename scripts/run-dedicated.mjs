import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const publicMode = process.argv.includes("--public");

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
    child.on("error", reject);
  });
}

if (!existsSync("dist/client/index.html")) {
  console.log("Building the game client once...");
  await run("npm", ["run", "build"]);
}

console.log("");
console.log("==========================================");
console.log(" PACMAN ONLINE — DEDICATED CABINET");
console.log(" Leave this window open. This machine hosts.");
console.log(" Play from other computers, not this one.");
console.log(" Host console:  http://localhost:3000/console");
console.log("==========================================");
console.log("");

const env = publicMode ? { WORLDWIDE: "1" } : {};
const args = ["tsx", "src/server/index.ts"];
if (publicMode) args.push("--world");
await run("npx", args, env);
