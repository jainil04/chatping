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

## Detection Investigation

Consolidated technical trail of everything investigated for real Copilot Chat state detection, so this is not re-investigated from scratch in a future session. Investigated directly against a real Copilot Chat agent session (both VS Code Insiders and stable VS Code 1.133.0).

**Extension location discovery**: Copilot Chat ships built into the app bundle at `<app>/Contents/Resources/app/extensions/copilot/` since VS Code 1.116, not under `~/.vscode/extensions/`. A naive extensions-folder scan (`ls ~/.vscode/extensions | grep copilot`) will find nothing and wrongly conclude Copilot isn't installed — this caused a false negative earlier in the investigation. Always check the app bundle's `extensions/` dir too, and cross-check with `Help → About` to confirm which VS Code install (stable vs. Insiders) is actually in use, since both apps can be installed and running simultaneously and look near-identical.

1. **`vscode.chat` namespace** exposes exactly `createChatParticipant()` — for building your own `@participant`, not for observing another extension's chat. No event exists for "a chat needs confirmation" or "a chat went idle."
2. **`vscode.window.tabGroups` / `Tab` interface**: the built-in Chat panel lives in the sidebar by default, not the editor tab area, so it's usually invisible to `tabGroups` entirely. Even when popped out to an editor tab (view type `workbench.editor.chatSession`), the `Tab` interface has no badge/description/content-state field — just `label`, `group`, `input`, `isActive`, `isDirty`, `isPinned`, `isPreview`. `ViewBadge` exists (`index.d.ts` ~10251, ~12118) but is write-only for the view's own owning extension — no public event lets another extension read it.
3. **`vscode.window.onDidStartTerminalShellExecution` / `onDidEndTerminalShellExecution`**: tested empirically — registered a probe extension (logging to a file via `fs.appendFileSync`, since output channels/GUI state aren't independently observable), launched a real Extension Development Host, and had Copilot's agent mode run terminal commands (`ls -la`, `touch test.txt && rm test.txt`). Confirmed structurally and empirically that `START` cannot fire during an approval wait — Copilot's confirmation UI renders inside its own chat webview before it ever calls `TerminalShellIntegration.executeCommand()`, so the `TerminalShellExecution` object doesn't exist yet while a user is looking at Allow/Deny. (Both test runs were actually auto-approved due to a local `chat.tools.terminal.autoApprove` setting in `settings.json`, so no gap was observed directly, but `START`→`END` were back-to-back — 67ms and 51ms respectively — in both cases with no pending state exposed in between, consistent with the structural reasoning.)
4. **Proposed APIs**: Copilot Chat's own `package.json` (`enabledApiProposals`) declares proposals that sound purpose-built for this — `chatParticipantAdditions`, `chatStatusItem`, `chatInputNotification`, `toolInvocationApproveCombination`, `chatHooks`, `chatDebug`. But VS Code's `product.json` (`extensionEnabledApiProposals`) allowlists every one of them to specific extension IDs (`GitHub.copilot-chat`, `GitHub.copilot`, and a handful of Microsoft partners like `ms-azuretools.vscode-azure-github-copilot`) — confirmed in both the stable (v0.61.0 bundled) and Insiders (v0.30.x) builds on this machine. A third-party extension can't use them even if it declares them (VS Code enforces the allowlist at runtime), and the Marketplace refuses to publish any extension that declares `enabledApiProposals` at all.
5. **MCP elicitation** (structured question-card UI with numbered options, custom-answer input, and pagination — visually distinct from the terminal-approval buttons in point 3): grepping VS Code core's `workbench.desktop.main.js` (not the Copilot extension bundle) turns up a full internal implementation — `IMcpElicitationService`, `_elicitationRequestHandler`, `_doElicitForm`, `_doElicitUrl`, `renderElicitation`, `onDidReceiveElicitationCompleteNotification`. This confirms elicitation is a generic VS Code-core MCP-client feature (per the MCP spec, a server can ask the client to collect structured input from the user), not something Copilot built privately. However: it never crosses into the extension host. Checked both `@types/vscode` (no `elicit`/`Elicitation` matches at all) and `product.json`'s `extensionEnabledApiProposals` (no proposal name containing "elicit") — there is no proposed or stable API surface to even be gated. `IMcpElicitationService` is a pure internal workbench DI service; VS Code core talks to MCP servers directly as the MCP client and resolves elicitation requests entirely internally, with no extension-host mediation step for any extension (Copilot's own or third-party) to hook into, even in principle. This is a structurally different dead end from point 4 — not an allowlist that could theoretically be extended, but an API that doesn't exist yet at any layer reachable by extensions.

**Conclusion**: there is no supported path to real Copilot Chat state detection today, across three structurally different mechanisms (tool-confirmation UI, proposed APIs, MCP elicitation). If VS Code ever stabilizes one of the proposals in point 4 (or extends the allowlist), or ships an extension-host-facing elicitation API, that would be the thing to revisit — check `product.json`'s `extensionEnabledApiProposals` for the extension's publisher ID, and `@types/vscode` for new `elicit`/`Elicitation` symbols, before investing time again.

**Not yet investigated**: Claude Code's own hooks system (`Notification` event, `idle_prompt`/`permission_prompt` types) is a real first-party mechanism, structurally different from anything found for Copilot — but not yet wired into ChatPing. Third-party ChatGPT VS Code extensions that render as webviews are also untested — a webview panel is a first-class citizen of `tabGroups` in a way Copilot's native panel isn't, so that case may not be subject to finding 2 above.
