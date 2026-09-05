# Monkeytype Desktop (Electron)

This package is a minimal macOS Apple Silicon shell around the upstream Monkeytype frontend. The renderer stays offline: remote HTTP, HTTPS, and WebSocket requests are blocked by the Electron session, while config, results, progression, presets, tags, themes, and backups use local storage.

## Releases and updates

The active app is `sanjayb-28/monkeytype`, branch `electron/offline-upstream`.
The retired `monkeytype-desktop` repository contains the Tauri port.
Upstream baseline: `91bd24bb8` from `monkeytypegame/monkeytype`.

Use **About → check for updates** or **Monkeytype → Check for updates…**.
Checks are manual and contact only the GitHub releases API from the main process.
For Homebrew installations in `/Applications`, **Update and restart** refreshes
Homebrew and upgrades only `sanjayb-28/monkeytype/monkeytype`. Homebrew verifies the
cask checksum and runs its existing trust step. Settings/history are preserved;
the updater never runs uninstall or zap. Other installations can open the release
page to download the DMG. Native Squirrel updates require a signed macOS app, so
this unsigned distribution uses Homebrew rather than a custom app replacement script.

Publish `desktop-v<version>` tags through the single desktop release workflow,
then update the cask version and SHA-256 in `sanjayb-28/homebrew-monkeytype`.
The app refuses to upgrade until the cask matches the GitHub release.

## Development

```sh
pnpm --dir desktop dev
```

## Build the Apple Silicon app

```sh
pnpm --dir desktop package
```

The unpacked app is written to `desktop/release/mac-arm64/Monkeytype.app`. Packaging is intentionally separate from publishing or installation.
