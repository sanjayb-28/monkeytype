import { createSignal, onMount, Show, type JSXElement } from "solid-js";

import { Button } from "../../components/common/Button";
import { H2, H3 } from "../../components/common/Headers";
import { Page } from "../../components/common/Page";
import { CommandlineHotkey } from "../../components/hotkeys/CommandlineHotkey";
import { QuickRestartHotkey } from "../../components/hotkeys/QuickRestartHotkey";

export function DesktopAboutPage(): JSXElement {
  const [version, setVersion] = createSignal("");
  const [updating, setUpdating] = createSignal(false);
  const [updateError, setUpdateError] = createSignal("");
  onMount(() => {
    void window.monkeytypeDesktop
      ?.appVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  });
  const checkUpdates = async (): Promise<void> => {
    setUpdating(true);
    setUpdateError("");
    try {
      await window.monkeytypeDesktop?.checkForUpdates();
    } catch {
      setUpdateError("Could not check for updates. Please try again.");
    } finally {
      setUpdating(false);
    }
  };
  return (
    <Page id="about">
      <div class="content-grid grid gap-8">
        <section class="text-center text-sub">
          Monkeytype for macOS.
          <br />
          Current Monkeytype typing engine, entirely local.
        </section>
        <section>
          <H2 fa={{ icon: "fa-info-circle" }} text="about" />
          <p>
            This port preserves Monkeytype&apos;s minimal, customizable typing
            test, themes, sounds, smooth caret, test modes, and result detail.
            It has no accounts, ads, analytics, cloud sync, or leaderboards.
            Settings, personal bests, and test history stay on this Mac.
          </p>
        </section>
        <Show when={window.monkeytypeDesktop !== undefined}>
          <section class="grid gap-4">
            <H3 fa={{ icon: "fa-download" }} text="app updates" />
            <p>Version {version()}. Updates are checked only when you ask.</p>
            <Button
              class="justify-self-start"
              fa={{ icon: "fa-sync-alt" }}
              text={updating() ? "checking / updating…" : "check for updates"}
              disabled={updating()}
              onClick={() => {
                void checkUpdates();
              }}
            />
            <p role="status" class="text-sub">
              {updateError()}
            </p>
          </section>
        </Show>
        <section>
          <H3 fa={{ icon: "fa-keyboard" }} text="keybinds" />
          <p>
            Use <QuickRestartHotkey /> to restart. Open the command line with{" "}
            <CommandlineHotkey /> to change modes and settings without leaving
            the keyboard.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-lock" }} text="offline by design" />
          <p>
            The app is packaged without web authentication, advertising,
            telemetry, or background update checks. Typing and your data stay
            offline. Checking for updates contacts GitHub; installing an update
            uses Homebrew and preserves your settings and history.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-code" }} text="open source" />
          <p>
            Monkeytype is created by Miodec and its contributors and licensed
            under GPL-3.0. This desktop port keeps that license and attribution.
          </p>
        </section>
      </div>
    </Page>
  );
}
