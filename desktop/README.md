# Monkeytype Desktop (Electron)

This package is a minimal macOS Apple Silicon shell around the upstream Monkeytype frontend. The renderer stays offline: remote HTTP, HTTPS, and WebSocket requests are blocked by the Electron session, while config, results, progression, presets, tags, themes, and backups use local storage.

## Development

```sh
pnpm --dir desktop dev
```

## Build the Apple Silicon app

```sh
pnpm --dir desktop package
```

The unpacked app is written to `desktop/release/mac-arm64/Monkeytype.app`. Packaging is intentionally separate from publishing or installation.
