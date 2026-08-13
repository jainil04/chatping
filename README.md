# ChatPing

Get a sound and/or OS-level notification when your AI chat (GitHub Copilot,
Claude, ChatGPT extensions) needs your input — even when VS Code isn't in
focus.

## Features

- 🔔 Play a sound when a chat needs your attention
- 🖥️ Send an OS-level notification (Notification Center / Action Center / etc.)
- ⚙️ Both alerts are independently toggleable
- 📍 Status bar item shows current state; click to quickly toggle sound

## Settings

| Setting | Default | Description |
|---|---|---|
| `chatping.playSound` | `true` | Play a sound when an alert fires |
| `chatping.sendOsNotification` | `true` | Send an OS notification when an alert fires |
| `chatping.pollIntervalSeconds` | `5` | How often the away-reminder timer checks whether VS Code is still unfocused |
| `chatping.awayReminder.enabled` | `false` | Fire a reminder after VS Code has been unfocused for a while. **Not chat-aware** — see [Status](#status) |
| `chatping.awayReminder.afterMinutes` | `5` | Minutes unfocused before the away reminder fires |
| `chatping.debugLogging` | `false` | Log focus transitions and away-reminder firings to the "ChatPing" output channel |

## Commands

- **ChatPing: Toggle Sound Alerts**
- **ChatPing: Toggle OS Notifications**
- **ChatPing: Toggle Away Reminder**
- **ChatPing: Send Test Alert** — fires both alerts immediately so you can
  confirm they're working

## Status

**There is no real Copilot Chat state detection, and there can't currently
be one.** This was investigated directly (reading `@types/vscode`,
inspecting the bundled `copilot-chat` extension in both stable and
Insiders VS Code, and empirically testing terminal-execution events against
a real Copilot Chat agent session):

- `vscode.chat` only exposes `createChatParticipant()` — for building your
  *own* `@participant`, not for observing another extension's chat activity.
  There's no event for "a chat needs confirmation" or "a chat went idle."
- The built-in Chat panel lives in the sidebar/panel by default, not the
  editor tab area, so `vscode.window.tabGroups` doesn't even see it unless
  the user manually pops it out to an editor tab — and even then, `Tab` has
  no badge, description, or content-state field to read.
- `vscode.window.onDidStartTerminalShellExecution` /
  `onDidEndTerminalShellExecution` were tested directly against Copilot's
  agent-mode terminal tool. The confirmation UI Copilot shows lives entirely
  inside its own chat webview, before it ever creates a
  `TerminalShellExecution` — so these events structurally cannot fire during
  an approval wait; `START` only exists once a command has already begun
  running.
- Copilot Chat itself uses several *proposed* VS Code APIs that look purpose
  -built for this (`chatParticipantAdditions`, `chatStatusItem`,
  `chatInputNotification`, `toolInvocationApproveCombination`, etc.), but
  every one of them is allowlisted in VS Code's `product.json` to specific
  extension IDs (`GitHub.copilot-chat` and a few Microsoft partners) — a
  third-party extension can't use them, and the Marketplace refuses to
  publish an extension that declares `enabledApiProposals` at all.

Given that, ChatPing currently ships two clearly separate, honestly-labeled
features instead of pretending to detect chat state:

1. **Manual test alert** — `ChatPing: Send Test Alert` fires the configured
   sound/notification on demand. This is the only way to see what an alert
   looks like; nothing calls it automatically.
2. **Away reminder** (opt-in, off by default) — watches
   `vscode.window.state.focused` only, and fires a reminder once VS Code has
   been continuously unfocused for `chatping.awayReminder.afterMinutes`. It
   has no knowledge of chat state at all — it's a "you wandered off" nudge,
   not a "chat needs you" alert, and is deliberately never conflated with
   one in its title, message, or settings.

## Development

```bash
npm install
npm run watch
```

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT
