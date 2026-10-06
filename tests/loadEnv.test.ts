import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "../src/server/loadEnv.ts";

describe("loadEnvFile", () => {
  it("loads unset keys from a .env file", () => {
    const dir = mkdtempSync(join(tmpdir(), "pacenv-"));
    const path = join(dir, ".env");
    writeFileSync(path, "PAC_TEST_PORT=4123\nPAC_TEST_NAME=\"MY CAB\"\n");
    const prevPort = process.env.PAC_TEST_PORT;
    const prevName = process.env.PAC_TEST_NAME;
    delete process.env.PAC_TEST_PORT;
    delete process.env.PAC_TEST_NAME;
    const applied = loadEnvFile(path);
    expect(applied.PAC_TEST_PORT).toBe("4123");
    expect(process.env.PAC_TEST_NAME).toBe("MY CAB");
    if (prevPort === undefined) delete process.env.PAC_TEST_PORT;
    else process.env.PAC_TEST_PORT = prevPort;
    if (prevName === undefined) delete process.env.PAC_TEST_NAME;
    else process.env.PAC_TEST_NAME = prevName;
  });

  it("does not override existing env vars", () => {
    const dir = mkdtempSync(join(tmpdir(), "pacenv-"));
    const path = join(dir, ".env");
    writeFileSync(path, "PAC_TEST_KEEP=from-file\n");
    process.env.PAC_TEST_KEEP = "already-set";
    const applied = loadEnvFile(path);
    expect(applied.PAC_TEST_KEEP).toBeUndefined();
    expect(process.env.PAC_TEST_KEEP).toBe("already-set");
    delete process.env.PAC_TEST_KEEP;
  });
});
