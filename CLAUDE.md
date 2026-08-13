# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ChatPing is a VS Code extension that plays a sound and/or sends an OS-level notification to get the user's attention, even when VS Code isn't focused.

**Status**: real Copilot Chat state detection was investigated and found to be impossible via public VS Code API (see "Why there's no real chat detection" below). The extension ships two intentionally separate features instead: a manual test-alert command, and an opt-in, chat-unaware "away reminder" based on window focus. Do not attempt to re-wire `triggerAlert()` to Copilot Chat state without reading that section first — it covers ground already investigated empirically.

## Commands

```bash
npm install       # install dependencies
npm run compile   # one-shot TypeScript build (tsc -p ./), outputs to out/
npm run watch     # incremental build on file change
```

There is no test suite, linter, or CI config in this repo yet.

To run the extension: press `F5` in VS Code (uses `.vscode/launch.json`'s "Run Extension" config, which builds first via the default build task and launches an Extension Development Host). From a shell, the equivalent is `<vscode-app>/Contents/Resources/app/bin/code --extensionDevelopmentPath=<repo> --new-window <some-folder>`.

## Architecture

Everything lives in `src/extension.ts` (single file, compiled to `out/extension.js` per `package.json`'s `main`).

- `activate()` — entry point. Registers the status bar item, four commands (`chatping.toggleSound`, `chatping.toggleNotification`, `chatping.toggleAwayReminder`, `chatping.testAlert`), an `onDidChangeWindowState` listener (drives the away reminder), and a config-change listener that refreshes the status bar and restarts the away-reminder timer.
- `triggerAlert(title, message, context)` — the alert-firing function. Reads `chatping.playSound` / `chatping.sendOsNotification` and dispatches to `playSound()` / `sendOsNotification()`. Two callers today: the manual `chatping.testAlert` command, and `checkAwayReminder()`.
- `playSound()` — shells out to a platform-specific player (`afplay` on macOS, PowerShell's `SoundPlayer` on Windows, `paplay`/`aplay` fallback on Linux) to play `media/ping.wav`.
- `sendOsNotification()` — wraps `node-notifier`.
- Away reminder (`onWindowStateChanged`, `checkAwayReminder`, `restartAwayReminder`) — tracks `unfocusedSince` via `vscode.window.onDidChangeWindowState`; a `setInterval` (period = `chatping.pollIntervalSeconds`) checks elapsed unfocused time and fires `triggerAlert()` once per unfocused period, transition-gated by `awayAlertFiredForThisAbsence` so it doesn't re-fire on every poll tick. Entirely gated behind `chatping.awayReminder.enabled` (default `false`).
- `debugLog()` — writes to the "ChatPing" output channel when `chatping.debugLogging` is true.

## Why there's no real chat detection

Investigated directly against a real Copilot Chat agent session (both VS Code Insiders and stable VS Code 1.133.0 — note Copilot Chat ships built into the app bundle at `<app>/Contents/Resources/app/extensions/copilot/` since VS Code 1.116, not under `~/.vscode/extensions/`, which is why a naive extensions-folder scan misses it):

1. **`vscode.chat` namespace** exposes exactly `createChatParticipant()` — for building your own `@participant`, not for observing another extension's chat. No event exists for "a chat needs confirmation" or "a chat went idle."
2. **`vscode.window.tabGroups`** doesn't help either: the built-in Chat panel lives in the sidebar by default, not the editor tab area, so it's usually invisible to `tabGroups` entirely. Even when popped out to an editor tab, the `Tab` interface has no badge/description/content-state field — just `label`, `group`, `input`, `isActive`, `isDirty`, `isPinned`, `isPreview`.
3. **`vscode.window.onDidStartTerminalShellExecution` / `onDidEndTerminalShellExecution`** were tested empirically: registered a probe extension, launched a real Extension Development Host, and had Copilot's agent mode run terminal commands. Confirmed structurally and empirically that `START` cannot fire during an approval wait — Copilot's confirmation UI renders inside its own chat webview before it ever calls `TerminalShellIntegration.executeCommand()`, so the `TerminalShellExecution` object doesn't exist yet while a user is looking at Allow/Deny. (Both test runs were actually auto-approved due to a local `chat.tools.terminal.autoApprove` setting, so no gap was observed directly, but `START`→`END` were back-to-back in both cases with no pending state exposed in between, consistent with the structural reasoning.)
4. **Proposed APIs**: Copilot Chat's own `package.json` (`enabledApiProposals`) declares proposals that sound purpose-built for this — `chatParticipantAdditions`, `chatStatusItem`, `chatInputNotification`, `toolInvocationApproveCombination`, `chatHooks`. But VS Code's `product.json` (`extensionEnabledApiProposals`) allowlists every one of them to specific extension IDs (`GitHub.copilot-chat` and a handful of Microsoft partners) — confirmed in both the stable and Insiders builds on this machine. A third-party extension can't use them even if it declares them, and the Marketplace refuses to publish any extension that declares `enabledApiProposals` at all.

Conclusion: there is no supported path to real Copilot Chat state detection today. If VS Code ever stabilizes one of the proposals above (or extends the allowlist), that would be the thing to revisit — check `product.json`'s `extensionEnabledApiProposals` for the extension's publisher ID before investing time.
