import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const frontendRoot = process.cwd().endsWith("/frontend")
  ? process.cwd()
  : resolve(process.cwd(), "frontend");

describe("desktop result effect parity", () => {
  it("keeps the original confetti renderer and its worker permission wired to validated local PBs", async () => {
    const [resultSource, testLogicSource, electronMainSource] =
      await Promise.all([
        readFile(resolve(frontendRoot, "src/ts/test/result.ts"), "utf8"),
        readFile(resolve(frontendRoot, "src/ts/test/test-logic.ts"), "utf8"),
        readFile(resolve(frontendRoot, "../desktop/src/main.ts"), "utf8"),
      ]);
    expect(resultSource).toContain('import confetti from "canvas-confetti";');
    expect(resultSource).toContain("if (SlowTimer.get()) return;");
    expect(resultSource.match(/void confetti\(\{/g)).toHaveLength(2);
    expect(testLogicSource).toContain("Result.showConfetti();");
    // The Electron renderer uses Chromium's native animation and worker path.
    // Remote requests and unrelated device/browser permissions are denied, while
    // Blob workers used by canvas-confetti remain available.
    expect(electronMainSource).toContain('"http://*/*"');
    expect(electronMainSource).toContain('"wss://*/*"');
    expect(electronMainSource).toContain("setPermissionRequestHandler");
    expect(electronMainSource).toContain('"clipboard-sanitized-write"');
  });

  it("shows the original PB crown only after the local result is saved", async () => {
    const testLogicSource = await readFile(
      resolve(frontendRoot, "src/ts/test/test-logic.ts"),
      "utf8",
    );
    const saveIndex = testLogicSource.indexOf(
      "await DB.saveLocalResult(desktopResult);",
    );
    const crownIndex = testLogicSource.indexOf('Result.showCrown("normal");');

    expect(saveIndex).toBeGreaterThan(-1);
    expect(crownIndex).toBeGreaterThan(saveIndex);
  });
});
