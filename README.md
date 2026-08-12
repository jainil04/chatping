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
| `chatping.playSound` | `true` | Play a sound when a chat needs attention |
| `chatping.sendOsNotification` | `true` | Send an OS notification when a chat needs attention |
| `chatping.pollIntervalSeconds` | `5` | How often ChatPing checks chat state |

## Commands

- **ChatPing: Toggle Sound Alerts**
- **ChatPing: Toggle OS Notifications**
- **ChatPing: Send Test Alert** — fires both alerts immediately so you can
  confirm they're working

## Status

This is an early scaffold. Detection logic (watching Copilot Chat state,
and heuristic polling for other AI extensions) is being built next —
currently the extension provides the settings, status bar toggle, and
alert-firing mechanism (sound + OS notification), triggerable manually via
the test command.

## Development

```bash
npm install
npm run watch
```

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT
