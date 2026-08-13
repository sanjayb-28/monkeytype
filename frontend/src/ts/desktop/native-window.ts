export async function showMainWindow(): Promise<void> {
  await window.monkeytypeDesktop?.showMainWindow();
}

export function reloadDesktopApp(): void {
  if (window.monkeytypeDesktop !== undefined) {
    window.monkeytypeDesktop.reload();
    return;
  }
  window.location.replace("/desktop.html");
}
