import { app, BrowserWindow, dialog, shell } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import {
  isNewerVersion,
  parseRelease,
  RELEASE_REPOSITORY,
  upgradeWithHomebrew,
} from "./update-release";

const exec = promisify(execFile);
let checking = false;

// Called only from the update button/menu. Node fetch leaves the renderer's
// offline session boundary intact and sends no typing data or account token.
export async function checkForUpdates(): Promise<void> {
  if (checking) return;
  checking = true;
  const window =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const showMessage = async (
    options: Electron.MessageBoxOptions,
  ): Promise<Electron.MessageBoxReturnValue> =>
    window === undefined
      ? dialog.showMessageBox(options)
      : dialog.showMessageBox(window, options);
  try {
    const response = await fetch(
      `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Monkeytype-Desktop",
        },
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      },
    );
    if (!response.ok) {
      throw new Error(
        `Update check failed (GitHub ${response.status}). Try again later.`,
      );
    }
    const release = parseRelease(await response.json());
    if (!isNewerVersion(release.version, app.getVersion())) {
      await showMessage({
        type: "info",
        message: "You're up to date",
        detail: `Monkeytype ${app.getVersion()} is installed.`,
      });
      return;
    }
    const brew = "/opt/homebrew/bin/brew";
    const canUpdate =
      app.isPackaged &&
      process.execPath ===
        "/Applications/Monkeytype.app/Contents/MacOS/Monkeytype" &&
      existsSync(brew) &&
      existsSync("/opt/homebrew/Caskroom/monkeytype");
    const choice = await showMessage({
      type: "info",
      message: `Monkeytype ${release.version} is available`,
      detail: canUpdate
        ? `You have ${app.getVersion()}. Homebrew will install the update and restart Monkeytype. Your settings and typing history will be preserved.`
        : `You have ${app.getVersion()}. Download the new app from the release page. Your settings and typing history will be preserved.`,
      buttons: canUpdate
        ? ["Update and restart", "View release", "Later"]
        : ["View release", "Later"],
      defaultId: 0,
      cancelId: canUpdate ? 2 : 1,
    });
    if (choice.response === (canUpdate ? 1 : 0)) {
      await shell.openExternal(release.url);
      return;
    }
    if (!canUpdate || choice.response !== 0) return;
    window?.setProgressBar(2);
    await upgradeWithHomebrew(release.version, async (args) => {
      const result = await exec(brew, args, {
        timeout: 10 * 60_000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: "/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
          HOMEBREW_NO_AUTO_UPDATE: "1",
          HOMEBREW_NO_INSTALL_CLEANUP: "1",
          HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: "1",
          HOMEBREW_NO_ASK: "1",
        },
      });
      return result.stdout;
    });
    // Never restart into an unexpected or incomplete installation.
    const installed = await exec("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :CFBundleShortVersionString",
      "/Applications/Monkeytype.app/Contents/Info.plist",
    ]);
    if (installed.stdout.trim() !== release.version) {
      throw new Error(
        "The installed version could not be verified. Please retry the update.",
      );
    }
    app.relaunch();
    app.quit();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown update error";
    await showMessage({
      type: "error",
      message: "Could not update Monkeytype",
      detail: `${detail.slice(0, 1200)}\n\nCheck your internet connection and try again. Your typing data has not been cleared.`,
    });
  } finally {
    if (window !== undefined && !window.isDestroyed()) {
      window.setProgressBar(-1);
    }
    checking = false;
  }
}
