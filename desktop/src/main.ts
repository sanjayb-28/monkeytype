import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkForUpdates } from "./updates";

const DESKTOP_SCHEME = "monkeytype";
const DEV_URL = process.env["MONKEYTYPE_DESKTOP_DEV_URL"];
const isDevelopment = DEV_URL !== undefined;
const currentDirectory = __dirname;

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function rendererDirectory(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "renderer")
    : path.resolve(currentDirectory, "../../frontend/dist");
}

function validSuggestedName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    name !== "." &&
    name !== ".."
  );
}

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const senderUrl = event.senderFrame?.url;
  if (senderUrl === undefined) return false;
  const url = new URL(senderUrl);
  if (url.protocol === `${DESKTOP_SCHEME}:` && url.host === "app") return true;
  if (!isDevelopment || DEV_URL === undefined) return false;
  return url.origin === new URL(DEV_URL).origin;
}

function requireTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error("Rejected untrusted renderer IPC");
  }
}

function registerRendererProtocol(): void {
  protocol.handle(DESKTOP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const root = rendererDirectory();
    const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    let resolvedPath = path.resolve(root, requestedPath || "desktop.html");

    if (!resolvedPath.startsWith(`${path.resolve(root)}${path.sep}`)) {
      return new Response("Not found", { status: 404 });
    }
    if (!existsSync(resolvedPath) || statSync(resolvedPath).isDirectory()) {
      resolvedPath = path.join(root, "desktop.html");
    }
    return net.fetch(pathToFileURL(resolvedPath).toString());
  });
}

function installOfflineBoundary(): void {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (details, callback) => {
      if (isDevelopment && DEV_URL !== undefined) {
        const allowedOrigin = new URL(DEV_URL).origin;
        const requestUrl = new URL(details.url);
        const requestOrigin = `${requestUrl.protocol === "ws:" ? "http:" : requestUrl.protocol === "wss:" ? "https:" : requestUrl.protocol}//${requestUrl.host}`;
        callback({ cancel: requestOrigin !== allowedOrigin });
        return;
      }
      callback({ cancel: true });
    },
  );

  const isTrustedPermissionOrigin = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      if (url.protocol === `${DESKTOP_SCHEME}:` && url.host === "app") {
        return true;
      }
      return (
        isDevelopment &&
        DEV_URL !== undefined &&
        url.origin === new URL(DEV_URL).origin
      );
    } catch {
      return false;
    }
  };
  const isAllowedPermission = (
    permission: string,
    requestingOrigin: string,
  ): boolean =>
    permission === "clipboard-sanitized-write" &&
    isTrustedPermissionOrigin(requestingOrigin);

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      isAllowedPermission(permission, requestingOrigin),
  );
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      callback(isAllowedPermission(permission, details.requestingUrl));
    },
  );
}

function registerIpc(): void {
  ipcMain.handle("desktop:check-for-updates", async (event) => {
    requireTrustedSender(event);
    await checkForUpdates();
  });
  ipcMain.handle("desktop:app-version", (event) => {
    requireTrustedSender(event);
    return app.getVersion();
  });
  ipcMain.handle("desktop:show-main-window", (event) => {
    requireTrustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.maximize();
    window?.show();
  });

  ipcMain.on("desktop:reload", (event) => {
    requireTrustedSender(event);
    event.sender.reload();
  });

  ipcMain.handle("desktop:open-text-file", async (event) => {
    requireTrustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    };
    const result =
      window === null
        ? await dialog.showOpenDialog(options)
        : await dialog.showOpenDialog(window, options);
    const selectedPath = result.filePaths[0];
    if (result.canceled || selectedPath === undefined) return null;
    return readFile(selectedPath, "utf8");
  });

  ipcMain.handle(
    "desktop:save-text-file",
    async (event, suggestedName: unknown, contents: unknown) => {
      requireTrustedSender(event);
      if (
        typeof suggestedName !== "string" ||
        !validSuggestedName(suggestedName) ||
        typeof contents !== "string"
      ) {
        throw new Error("Invalid file save request");
      }
      const window = BrowserWindow.fromWebContents(event.sender);
      const options = {
        defaultPath: suggestedName,
      };
      const result =
        window === null
          ? await dialog.showSaveDialog(options)
          : await dialog.showSaveDialog(window, options);
      if (result.canceled || result.filePath === undefined) return false;
      await writeFile(result.filePath, contents, "utf8");
      return true;
    },
  );
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    title: "Monkeytype",
    width: 1200,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    center: true,
    show: false,
    backgroundColor: "#323437",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(currentDirectory, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, targetUrl) => {
    const target = new URL(targetUrl);
    const allowed =
      isDevelopment && DEV_URL !== undefined
        ? target.origin === new URL(DEV_URL).origin
        : target.protocol === `${DESKTOP_SCHEME}:` && target.host === "app";
    if (!allowed) event.preventDefault();
  });

  if (DEV_URL !== undefined) {
    await window.loadURL(DEV_URL);
  } else {
    await window.loadURL(`${DESKTOP_SCHEME}://app/desktop.html`);
  }
}

void app
  .whenReady()
  .then(async () => {
    registerRendererProtocol();
    installOfflineBoundary();
    registerIpc();
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Monkeytype",
          submenu: [
            { role: "about" },
            {
              label: "Check for updates…",
              click: () => {
                void checkForUpdates();
              },
            },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        { role: "fileMenu" },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
      ]),
    );
    await createMainWindow();
  })
  .catch(() => app.quit());

app.on("window-all-closed", () => app.quit());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
});
