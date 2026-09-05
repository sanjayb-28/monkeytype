import { describe, expect, it, vi } from "vitest";
import {
  isNewerVersion,
  parseRelease,
  upgradeWithHomebrew,
} from "../../../desktop/src/update-release";

const release = {
  tag_name: "desktop-v0.2.0",
  draft: false,
  prerelease: false,
  assets: [
    {
      name: "Monkeytype-0.2.0-arm64.dmg",
      state: "uploaded",
      browser_download_url:
        "https://github.com/sanjayb-28/monkeytype/releases/download/desktop-v0.2.0/Monkeytype-0.2.0-arm64.dmg",
      digest: `sha256:${"a".repeat(64)}`,
    },
  ],
};

describe("desktop updates", () => {
  it("compares versions numerically without downgrades or prereleases", () => {
    expect(isNewerVersion("0.10.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.10.0")).toBe(true);
    expect(isNewerVersion("0.2.0", "0.2.0")).toBe(false);
    expect(isNewerVersion("0.1.1", "0.2.0")).toBe(false);
    expect(isNewerVersion("0.3.0-beta", "0.2.0")).toBe(false);
    expect(isNewerVersion("foo", "0.2.0")).toBe(false);
  });
  it("accepts only a published Apple Silicon desktop installer with a checksum", () => {
    expect(parseRelease(release).version).toBe("0.2.0");
    for (const invalid of [
      null,
      {},
      { ...release, draft: true },
      { ...release, prerelease: true },
      { ...release, tag_name: "v26.32.0" },
      { ...release, assets: [] },
      { ...release, assets: [{ ...release.assets[0], digest: null }] },
      {
        ...release,
        assets: [
          {
            ...release.assets[0],
            browser_download_url: "https://example.com/app.dmg",
          },
        ],
      },
    ]) {
      expect(() => parseRelease(invalid)).toThrow();
    }
  });
  it("does not upgrade while the tap still points to the previous release", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(
        JSON.stringify({ casks: [{ version: "0.1.1", installed: "0.1.1" }] }),
      );
    await expect(upgradeWithHomebrew("0.2.0", run)).rejects.toThrow(
      "not ready",
    );
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("does not install over an unmanaged app", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(
        JSON.stringify({ casks: [{ version: "0.2.0", installed: null }] }),
      );
    await expect(upgradeWithHomebrew("0.2.0", run)).rejects.toThrow(
      "not managed",
    );
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("upgrades the exact cask without clearing typing data", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(
        JSON.stringify({ casks: [{ version: "0.2.0", installed: "0.1.1" }] }),
      )
      .mockResolvedValueOnce("");
    await upgradeWithHomebrew("0.2.0", run);
    expect(run.mock.calls).toEqual([
      [["update", "--quiet"]],
      [["info", "--json=v2", "--cask", "sanjayb-28/monkeytype/monkeytype"]],
      [["upgrade", "--cask", "sanjayb-28/monkeytype/monkeytype"]],
    ]);
  });
  it("repairs a stale app when the brew receipt is already current", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(
        JSON.stringify({ casks: [{ version: "0.2.0", installed: "0.2.0" }] }),
      )
      .mockResolvedValueOnce("");
    await upgradeWithHomebrew("0.2.0", run);
    expect(run).toHaveBeenLastCalledWith([
      "reinstall",
      "--cask",
      "sanjayb-28/monkeytype/monkeytype",
    ]);
  });
  it("propagates download or checksum failures instead of reporting success", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(
        JSON.stringify({ casks: [{ version: "0.2.0", installed: "0.1.1" }] }),
      )
      .mockRejectedValueOnce(new Error("SHA-256 mismatch"));
    await expect(upgradeWithHomebrew("0.2.0", run)).rejects.toThrow(
      "SHA-256 mismatch",
    );
  });
});
