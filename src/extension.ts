import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import * as notifier from 'node-notifier';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

// Away-reminder state (see startAwayReminder). Not chat-aware — see README/CLAUDE.md
// for why real Copilot Chat state detection isn't possible via public API.
let awayReminderTimer: ReturnType<typeof setInterval> | undefined;
let unfocusedSince: number | undefined;
let awayAlertFiredForThisAbsence = false;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ChatPing');
  context.subscriptions.push(outputChannel);

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
    vscode.commands.registerCommand('chatping.toggleAwayReminder', () => {
      const config = vscode.workspace.getConfiguration('chatping');
      const current = config.get<boolean>('awayReminder.enabled', false);
      config.update('awayReminder.enabled', !current, vscode.ConfigurationTarget.Global);
      vscode.window.setStatusBarMessage(
        `ChatPing: away reminder ${!current ? 'enabled' : 'disabled'}`,
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
    vscode.window.onDidChangeWindowState((state) => {
      onWindowStateChanged(state);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('chatping')) {
        updateStatusBarItem();
        restartAwayReminder(context);
      }
    })
  );

  restartAwayReminder(context);
}

function updateStatusBarItem() {
  const config = vscode.workspace.getConfiguration('chatping');
  const soundOn = config.get<boolean>('playSound', true);
  const notifyOn = config.get<boolean>('sendOsNotification', true);
  const awayReminderOn = config.get<boolean>('awayReminder.enabled', false);

  const icon = soundOn || notifyOn ? '$(bell)' : '$(bell-slash)';
  statusBarItem.text = `${icon} ChatPing`;
  statusBarItem.tooltip = `ChatPing — sound: ${soundOn ? 'on' : 'off'}, OS notifications: ${
    notifyOn ? 'on' : 'off'
  }, away reminder: ${awayReminderOn ? 'on' : 'off'} (click to toggle sound)`;
}

/**
 * Fires the configured alerts (sound and/or OS notification) based on
 * the user's current settings. This is the function future detection
 * logic should call when it determines the user's attention is needed.
 *
 * NOTE: there is currently no wiring from real Copilot Chat state into this
 * function — investigation found no public VS Code API that exposes whether
 * Copilot Chat is waiting on a confirmation or has gone idle after a
 * response. See README.md / CLAUDE.md for details. The only automatic
 * caller today is the away-reminder heuristic (window focus only, not
 * chat-aware) — everything else is manual, via the test command.
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

function debugLog(message: string) {
  const config = vscode.workspace.getConfiguration('chatping');
  if (config.get<boolean>('debugLogging', false)) {
    const stamp = new Date().toISOString();
    outputChannel.appendLine(`[${stamp}] ${message}`);
  }
}

/**
 * Away reminder: a deliberately chat-unaware heuristic. It only watches
 * vscode.window.state.focused/active and fires a reminder alert once VS
 * Code has been unfocused continuously for a configurable duration. It does
 * NOT know whether any AI chat needs input — it's a "you wandered off,
 * here's what's still open" nudge, kept as an explicitly separate, opt-in
 * feature so it's never confused with real chat-attention detection.
 */
function onWindowStateChanged(state: vscode.WindowState) {
  if (state.focused) {
    if (unfocusedSince !== undefined) {
      debugLog('window focused again — away timer reset');
    }
    unfocusedSince = undefined;
    awayAlertFiredForThisAbsence = false;
  } else {
    unfocusedSince = Date.now();
    awayAlertFiredForThisAbsence = false;
    debugLog('window unfocused — away timer started');
  }
}

function checkAwayReminder(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('chatping');
  if (!config.get<boolean>('awayReminder.enabled', false)) {
    return;
  }
  if (unfocusedSince === undefined || awayAlertFiredForThisAbsence) {
    return;
  }

  const afterMinutes = config.get<number>('awayReminder.afterMinutes', 5);
  const elapsedMinutes = (Date.now() - unfocusedSince) / 60000;

  if (elapsedMinutes >= afterMinutes) {
    awayAlertFiredForThisAbsence = true;
    debugLog(`away reminder fired after ${elapsedMinutes.toFixed(1)} min unfocused`);
    triggerAlert(
      'ChatPing: Away Reminder',
      `VS Code has been unfocused for ${afterMinutes}+ minutes. This is a focus reminder, not a chat-attention alert.`,
      context
    );
  }
}

function restartAwayReminder(context: vscode.ExtensionContext) {
  if (awayReminderTimer) {
    clearInterval(awayReminderTimer);
    awayReminderTimer = undefined;
  }

  const config = vscode.workspace.getConfiguration('chatping');
  const pollIntervalSeconds = config.get<number>('pollIntervalSeconds', 5);

  awayReminderTimer = setInterval(() => {
    checkAwayReminder(context);
  }, Math.max(1, pollIntervalSeconds) * 1000);

  if (!vscode.window.state.focused) {
    unfocusedSince = Date.now();
  }
}

export function deactivate() {
  if (awayReminderTimer) {
    clearInterval(awayReminderTimer);
  }
}
