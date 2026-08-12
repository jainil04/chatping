import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import * as notifier from 'node-notifier';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'chatping.toggleSound';
  updateStatusBarItem();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('chatping.toggleSound', () => {
      const config = vscode.workspace.getConfiguration('chatping');
      const current = config.get<boolean>('playSound', true);
      config.update('playSound', !current, vscode.ConfigurationTarget.Global);
      vscode.window.setStatusBarMessage(
        `ChatPing: sound ${!current ? 'enabled' : 'disabled'}`,
        2000
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chatping.toggleNotification', () => {
      const config = vscode.workspace.getConfiguration('chatping');
      const current = config.get<boolean>('sendOsNotification', true);
      config.update('sendOsNotification', !current, vscode.ConfigurationTarget.Global);
      vscode.window.setStatusBarMessage(
        `ChatPing: OS notifications ${!current ? 'enabled' : 'disabled'}`,
        2000
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chatping.testAlert', () => {
      triggerAlert(
        'ChatPing Test',
        'This is what an alert looks like when a chat needs your attention.',
        context
      );
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('chatping')) {
        updateStatusBarItem();
      }
    })
  );
}

function updateStatusBarItem() {
  const config = vscode.workspace.getConfiguration('chatping');
  const soundOn = config.get<boolean>('playSound', true);
  const notifyOn = config.get<boolean>('sendOsNotification', true);

  const icon = soundOn || notifyOn ? '$(bell)' : '$(bell-slash)';
  statusBarItem.text = `${icon} ChatPing`;
  statusBarItem.tooltip = `ChatPing — sound: ${soundOn ? 'on' : 'off'}, OS notifications: ${
    notifyOn ? 'on' : 'off'
  } (click to toggle sound)`;
}

/**
 * Fires the configured alerts (sound and/or OS notification) based on
 * the user's current settings. This is the function future detection
 * logic (Copilot events, polling, etc.) should call when it determines
 * a chat needs user attention.
 */
export function triggerAlert(
  title: string,
  message: string,
  context: vscode.ExtensionContext
) {
  const config = vscode.workspace.getConfiguration('chatping');

  if (config.get<boolean>('playSound', true)) {
    playSound(context);
  }

  if (config.get<boolean>('sendOsNotification', true)) {
    sendOsNotification(title, message);
  }
}

function playSound(context: vscode.ExtensionContext) {
  const soundPath = path.join(context.extensionPath, 'media', 'ping.wav');
  let cmd: string;

  switch (process.platform) {
    case 'darwin':
      cmd = `afplay "${soundPath}"`;
      break;
    case 'win32':
      cmd = `powershell -c (New-Object Media.SoundPlayer '${soundPath}').PlaySync()`;
      break;
    default:
      // Linux: try paplay first, fall back to aplay
      cmd = `paplay "${soundPath}" || aplay "${soundPath}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.error('ChatPing: failed to play sound', err);
    }
  });
}

function sendOsNotification(title: string, message: string) {
  notifier.notify({
    title,
    message,
    sound: false // sound is handled separately via playSound()
  });
}

export function deactivate() {}
