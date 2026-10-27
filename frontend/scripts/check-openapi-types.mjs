import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "aegis-openapi-"));
const tempFile = join(tempDir, "openapi.d.ts");

try {
  execFileSync("npx", ["openapi-typescript", "openapi.json", "-o", tempFile], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const committed = readFileSync("src/types/generated/openapi.d.ts", "utf8");
  const generated = readFileSync(tempFile, "utf8");
  if (committed !== generated) {
    console.error("Generated OpenAPI types are stale. Run npm run api:types.");
    process.exitCode = 1;
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
