import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const prohibitedSignatures = [
  "@firebase/auth",
  "firebaseLocalStorageDb",
  "securetoken.googleapis.com",
  "vendor-firebase",
  "vendor-sentry",
];

async function main(): Promise<void> {
  const rendererDirectory = resolve(process.cwd(), "../frontend/dist");
  const html = await readFile(
    resolve(rendererDirectory, "desktop.html"),
    "utf8",
  );
  const javascriptDirectory = resolve(rendererDirectory, "js");
  const javascriptFiles = (await readdir(javascriptDirectory)).filter((file) =>
    file.endsWith(".js"),
  );
  const javascript = await Promise.all(
    javascriptFiles.map(async (file) =>
      readFile(resolve(javascriptDirectory, file), "utf8"),
    ),
  );
  const combinedRenderer = `${html}\n${javascript.join("\n")}`;
  const found = prohibitedSignatures.filter((signature) =>
    combinedRenderer.includes(signature),
  );

  if (found.length > 0) {
    throw new Error(
      `Desktop renderer contains online-service code: ${found.join(", ")}`,
    );
  }

  console.log(`Verified ${javascriptFiles.length} offline renderer chunks.`);
}

void main();
