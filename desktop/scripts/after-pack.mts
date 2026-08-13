import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import type { AfterPackContext } from "electron-builder";

const execFileAsync = promisify(execFile);

export default async function afterPack(
  context: AfterPackContext,
): Promise<void> {
  if (context.electronPlatformName !== "darwin") return;

  const infoPlist = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    "Contents/Info.plist",
  );
  await execFileAsync("/usr/libexec/PlistBuddy", [
    "-c",
    "Delete :NSAppTransportSecurity",
    infoPlist,
  ]);
}
