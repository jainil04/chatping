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

### What works today

- **`ChatPing: Send Test Alert`** (manual) — fires the configured
  sound + OS notification on demand. This is the only way to see what an
  alert looks like; nothing calls it automatically.
- **Away Reminder** (opt-in, off by default) — fires once after VS Code has
  been continuously unfocused for `chatping.awayReminder.afterMinutes`.
  Explicitly **not chat-aware** — it only tracks window focus
  (`vscode.window.state.focused`), not any chat's state, and its title/
  message never claim otherwise.
- Toggleable sound / OS notification flags, a status bar toggle, and debug
  logging of state transitions to the "ChatPing" output channel.

### What was investigated and found not possible (Copilot Chat)

This was investigated directly — reading `@types/vscode`, inspecting the
bundled `copilot-chat` extension in both stable and Insiders VS Code, and
empirically testing terminal-execution and elicitation behavior against a
real Copilot Chat agent session. Full technical trail is in `CLAUDE.md`.
Summary:

- No public VS Code API lets one extension observe another extension's chat
  state — no event for "a chat needs confirmation" or "a chat went idle."
- Confirmation/tool-approval APIs exist (`chatParticipantAdditions`,
  `chatStatusItem`, `toolInvocationApproveCombination`, etc.) but are
  allowlisted in VS Code's `product.json` specifically to
  `GitHub.copilot-chat`'s extension ID — not usable by third parties, and
  wouldn't be publishable to the Marketplace even if used.
- MCP's elicitation feature (the structured question-card UI, with
  numbered options and pagination) is implemented entirely inside VS
  Code core's internal workbench layer (`IMcpElicitationService` and
  friends) — it never crosses into the extension host, so there's no event
  or type to hook into even in principle, not even a gated one.
- A look at other Marketplace extensions claiming to solve this problem
  found the same pattern every time: either a manual trigger command, or
  the same focus/idle heuristic ChatPing already implements as "Away
  Reminder." Nobody has actually cracked real event-based detection for
  Copilot Chat.

### What's real but different (Claude Code CLI)

Claude Code (the CLI tool, separate from VS Code's Copilot Chat) has its
own first-party hooks system — a `Notification` event with `idle_prompt`
and `permission_prompt` types that fires on genuine state transitions. This
is a real, documented, supported mechanism, unlike anything found for
Copilot Chat. Not yet wired into ChatPing.

### What's unexplored

Third-party ChatGPT VS Code extensions that render their chat UI as a
webview may be a fundamentally different — and more observable — case than
Copilot's native panel, since a webview panel is a first-class citizen of
`vscode.window.tabGroups` in a way Copilot's native panel isn't. Untested
so far.

## Development

```bash
npm install
npm run watch
```

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT
