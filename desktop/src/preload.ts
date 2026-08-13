import { contextBridge, ipcRenderer } from "electron";

const api = {
  openTextFile: async (): Promise<string | null> => {
    const value: unknown = await ipcRenderer.invoke("desktop:open-text-file");
    if (value !== null && typeof value !== "string") {
      throw new Error("Invalid open file response");
    }
    return value;
  },
  reload: (): void => ipcRenderer.send("desktop:reload"),
  saveTextFile: async (
    suggestedName: string,
    contents: string,
  ): Promise<boolean> => {
    const value: unknown = await ipcRenderer.invoke(
      "desktop:save-text-file",
      suggestedName,
      contents,
    );
    if (typeof value !== "boolean") {
      throw new Error("Invalid save file response");
    }
    return value;
  },
  showMainWindow: async (): Promise<void> => {
    await ipcRenderer.invoke("desktop:show-main-window");
  },
};

contextBridge.exposeInMainWorld("monkeytypeDesktop", Object.freeze(api));
