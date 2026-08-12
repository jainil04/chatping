# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ChatPing is a VS Code extension that plays a sound and/or sends an OS-level notification when an AI chat panel (Copilot, Claude, ChatGPT extensions) needs user input, even when VS Code isn't focused.

**Status**: early scaffold. The extension currently only provides settings, a status bar toggle, and the alert-firing mechanism (`triggerAlert`), triggerable manually via the "Send Test Alert" command. Detection logic — watching Copilot Chat state and/or polling heuristically for other AI extensions — has not been built yet.

## Commands

```bash
npm install       # install dependencies
npm run compile   # one-shot TypeScript build (tsc -p ./), outputs to out/
npm run watch     # incremental build on file change
```

There is no test suite, linter, or CI config in this repo yet.

To run the extension: press `F5` in VS Code (uses `.vscode/launch.json`'s "Run Extension" config, which builds first via the default build task and launches an Extension Development Host).

## Architecture

Everything lives in `src/extension.ts` (single file, compiled to `out/extension.js` per `package.json`'s `main`).

- `activate()` — entry point. Registers the status bar item and three commands (`chatping.toggleSound`, `chatping.toggleNotification`, `chatping.testAlert`), and listens for config changes to refresh the status bar.
- `triggerAlert(title, message, context)` — the exported alert-firing function. **This is the hook future detection logic should call** once it determines a chat needs user attention; it reads the `chatping.playSound` / `chatping.sendOsNotification` settings and dispatches to `playSound()` / `sendOsNotification()` accordingly.
- `playSound()` — shells out to a platform-specific player (`afplay` on macOS, PowerShell's `SoundPlayer` on Windows, `paplay`/`aplay` fallback on Linux) to play `media/ping.wav`.
- `sendOsNotification()` — wraps `node-notifier`.

Configuration schema (`chatping.playSound`, `chatping.sendOsNotification`, `chatping.pollIntervalSeconds`) is declared in `package.json` under `contributes.configuration`; `pollIntervalSeconds` is defined but not yet read anywhere in code — it's reserved for the not-yet-built polling-based detection logic.

When adding chat-state detection: wire it into `activate()` (e.g., a poller using `pollIntervalSeconds`, or a listener on Copilot Chat's API/events) and call `triggerAlert()` when input is needed — don't duplicate the alert-dispatch logic.
