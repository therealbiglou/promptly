import { CommandAction, AdjustmentAction, type AdjustmentActionExecuteEvent } from '@logitech/plugin-sdk';
import type { PromptlyClient } from './promptly-client.js';

const JOG_PX_PER_TICK = 40;

/** Helper base so each action holds a reference to the shared PromptlyClient. */
abstract class PromptlyCommandAction extends CommandAction {
  constructor(protected client: PromptlyClient) {
    super();
  }
}

abstract class PromptlyAdjustmentAction extends AdjustmentAction {
  constructor(protected client: PromptlyClient) {
    super();
  }
}

// ===== Command actions (buttons) =====

export class PlayPauseAction extends PromptlyCommandAction {
  name = 'play-pause';
  displayName = 'Play / Pause';
  description = 'Start or pause script playback';
  async onKeyDown() { this.client.send('play-pause'); }
}

export class ResetAction extends PromptlyCommandAction {
  name = 'reset';
  displayName = 'Reset to Start';
  description = 'Stop playback and return to the top of the script';
  async onKeyDown() { this.client.send('reset'); }
}

export class NextChapterAction extends PromptlyCommandAction {
  name = 'next-chapter';
  displayName = 'Next Chapter';
  description = 'Jump to the next chapter';
  async onKeyDown() { this.client.send('next-chapter'); }
}

export class PrevChapterAction extends PromptlyCommandAction {
  name = 'prev-chapter';
  displayName = 'Previous Chapter';
  description = 'Jump to the previous chapter';
  async onKeyDown() { this.client.send('prev-chapter'); }
}

export class OpenPresenterAction extends PromptlyCommandAction {
  name = 'open-presenter';
  displayName = 'Open Presenter Window';
  description = 'Open (or refresh) the presenter window';
  async onKeyDown() { this.client.send('open-presenter'); }
}

export class ToggleFullscreenAction extends PromptlyCommandAction {
  name = 'toggle-fullscreen';
  displayName = 'Toggle Fullscreen';
  description = 'Enter or exit fullscreen on the presenter window';
  async onKeyDown() { this.client.send('toggle-fullscreen'); }
}

export class ToggleManualScrollAction extends PromptlyCommandAction {
  name = 'toggle-manual-scroll';
  displayName = 'Toggle Manual Scroll';
  description = 'Enter or exit manual scroll (jog) mode';
  async onKeyDown() { this.client.send('toggle-manual-scroll'); }
}

export class ToggleSpotlightAction extends PromptlyCommandAction {
  name = 'toggle-spotlight';
  displayName = 'Toggle Mouse Spotlight';
  description = 'Show or hide the red mouse spotlight on the presenter';
  async onKeyDown() { this.client.send('toggle-spotlight'); }
}

export class ToggleCountdownAction extends PromptlyCommandAction {
  name = 'toggle-countdown';
  displayName = 'Toggle Delayed Start';
  description = 'Turn the countdown before play on or off';
  async onKeyDown() { this.client.send('toggle-countdown'); }
}

export class CycleTimerAction extends PromptlyCommandAction {
  name = 'cycle-timer';
  displayName = 'Cycle Timer Display';
  description = 'Cycle the presenter timer between full, speed-only, and hidden';
  async onKeyDown() { this.client.send('cycle-timer'); }
}

// ===== Adjustment actions (dial / roller) =====

export class SpeedShuttleAction extends PromptlyAdjustmentAction {
  name = 'speed-shuttle';
  displayName = 'Speed (Shuttle)';
  description = 'Adjust scroll speed by ±0.1x per detent. Crosses zero into reverse. Press to reset to 1.5x.';
  hasReset = true;

  async execute(event: AdjustmentActionExecuteEvent) {
    this.client.send('speed-adjust', event.tick);
  }
}

/** Paired with SpeedShuttleAction — the SDK invokes this command when the
 *  user presses the dial assigned to a hasReset adjustment action.
 *  Name format `<adjustment-name>_RESET` is dictated by the SDK
 *  (see AdjustmentAction.resetCommandName in @logitech/plugin-sdk). */
export class SpeedShuttleResetAction extends PromptlyCommandAction {
  name = 'speed-shuttle_RESET';
  displayName = 'Speed Shuttle Reset';
  description = 'Reset speed to default 1.5x (internal: dial press for Speed Shuttle)';
  async onKeyDown() { this.client.send('set-speed', 1.5); }
}

export class JogAction extends PromptlyAdjustmentAction {
  name = 'jog';
  displayName = 'Jog (Manual Scroll)';
  description = 'Scroll the script by a few pixels per detent. Useful on the roller.';
  hasReset = false;

  async execute(event: AdjustmentActionExecuteEvent) {
    this.client.send('jog', event.tick * JOG_PX_PER_TICK);
  }
}
