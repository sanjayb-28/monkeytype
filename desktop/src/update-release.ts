export const RELEASE_REPOSITORY = "sanjayb-28/monkeytype";
export const HOMEBREW_CASK = "sanjayb-28/monkeytype/monkeytype";

export type DesktopRelease = { version: string; url: string };

export function isNewerVersion(candidate: string, current: string): boolean {
  const valid = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (!valid.test(candidate) || !valid.test(current)) return false;
  const next = candidate.split(".").map(Number);
  const previous = current.split(".").map(Number);
  if (![...next, ...previous].every(Number.isSafeInteger)) return false;
  for (let index = 0; index < 3; index++) {
    if (next[index] !== previous[index]) {
      return (next[index] ?? 0) > (previous[index] ?? 0);
    }
  }
  return false;
}

export function parseRelease(value: unknown): DesktopRelease {
  const release = value as Record<string, unknown> | null;
  if (
    release === null ||
    typeof release !== "object" ||
    release["draft"] !== false ||
    release["prerelease"] !== false ||
    typeof release["tag_name"] !== "string"
  ) {
    throw new Error("GitHub returned an invalid desktop release.");
  }
  const match =
    /^desktop-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(
      release["tag_name"],
    );
  const version = match?.[1];
  if (version === undefined || !Array.isArray(release["assets"])) {
    throw new Error("No stable desktop release is available.");
  }
  const url = `https://github.com/${RELEASE_REPOSITORY}/releases/tag/desktop-v${version}`;
  const assetName = `Monkeytype-${version}-arm64.dmg`;
  const assetUrl = `https://github.com/${RELEASE_REPOSITORY}/releases/download/desktop-v${version}/${assetName}`;
  const hasInstaller = release["assets"].some((asset: unknown) => {
    const item = asset as Record<string, unknown> | null;
    return (
      item !== null &&
      typeof item === "object" &&
      item["name"] === assetName &&
      item["state"] === "uploaded" &&
      item["browser_download_url"] === assetUrl &&
      typeof item["digest"] === "string" &&
      /^sha256:[a-f0-9]{64}$/.test(item["digest"])
    );
  });
  if (!hasInstaller) {
    throw new Error(
      "The Apple Silicon installer is not ready yet. Try again later.",
    );
  }
  return { version, url };
}

export type BrewRunner = (args: string[]) => Promise<string>;

export async function upgradeWithHomebrew(
  version: string,
  run: BrewRunner,
): Promise<void> {
  await run(["update", "--quiet"]);
  const info = JSON.parse(
    await run(["info", "--json=v2", "--cask", HOMEBREW_CASK]),
  ) as {
    casks?: { version?: string; installed?: string | null }[];
  };
  const cask = info.casks?.[0];
  if (cask?.version !== version) {
    throw new Error("The Homebrew update is not ready yet. Try again shortly.");
  }
  if (
    cask.installed === null ||
    cask.installed === undefined ||
    cask.installed === ""
  ) {
    throw new Error(
      "This app is not managed by Homebrew. Install the update from the release page.",
    );
  }
  // A manually replaced app can be older than the Homebrew receipt.
  await run([
    cask.installed === version ? "reinstall" : "upgrade",
    "--cask",
    HOMEBREW_CASK,
  ]);
}
