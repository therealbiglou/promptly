import { PluginSDK } from '@logitech/plugin-sdk';
import { PromptlyClient } from './src/promptly-client.js';
import {
  PlayPauseAction,
  ResetAction,
  NextChapterAction,
  PrevChapterAction,
  OpenPresenterAction,
  ToggleFullscreenAction,
  ToggleManualScrollAction,
  ToggleSpotlightAction,
  ToggleCountdownAction,
  CycleTimerAction,
  SpeedShuttleAction,
  SpeedShuttleResetAction,
  JogAction
} from './src/actions.js';

const client = new PromptlyClient();
client.start();

const sdk = new PluginSDK();

sdk.registerAction(new PlayPauseAction(client));
sdk.registerAction(new ResetAction(client));
sdk.registerAction(new NextChapterAction(client));
sdk.registerAction(new PrevChapterAction(client));
sdk.registerAction(new OpenPresenterAction(client));
sdk.registerAction(new ToggleFullscreenAction(client));
sdk.registerAction(new ToggleManualScrollAction(client));
sdk.registerAction(new ToggleSpotlightAction(client));
sdk.registerAction(new ToggleCountdownAction(client));
sdk.registerAction(new CycleTimerAction(client));
sdk.registerAction(new SpeedShuttleAction(client));
sdk.registerAction(new SpeedShuttleResetAction(client));
sdk.registerAction(new JogAction(client));

await sdk.connect();
