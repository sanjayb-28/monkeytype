type MonkeytypeDesktopApi = {
  openTextFile: () => Promise<string | null>;
  reload: () => void;
  saveTextFile: (suggestedName: string, contents: string) => Promise<boolean>;
  showMainWindow: () => Promise<void>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- global Window augmentation requires an interface
interface Window {
  monkeytypeDesktop?: MonkeytypeDesktopApi;
}
