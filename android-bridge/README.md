# Promptly Bridge (Android)

Sideloaded companion app that turns a phone-oriented BLE remote (ZTYTO-style
TikTok/camera/Kindle clickers) into a Promptly controller. The remote pairs
with the **phone**, where its buttons work natively; this app captures those
events and relays them to Promptly's remote-control HTTP server.

```
BLE remote ──Bluetooth──> Android phone (this app) ──WiFi──> Promptly  POST /command
```

## Why

These remotes emulate touchscreen swipes and phone keys (volume, shutter) —
signals Windows can't bind to app shortcuts. Android receives them natively:
key events arrive via `dispatchKeyEvent` (and are **consumed**, so the phone's
volume doesn't change) and synthetic swipes arrive as touch gestures.

## Use

1. Sideload `PromptlyBridge-x.y.apk` (Settings → allow installs from your
   file manager / browser).
2. Pair the BLE remote with the phone (Bluetooth settings).
3. In Promptly: Settings → Remote → start the remote server; note the local
   URL (e.g. `http://192.168.1.20:3001`).
4. In Promptly Bridge: enter that URL → **Test** (expect "Connected ✓").
5. Map events to commands. Unknown buttons are added to the list automatically
   the first time you press them in Capture mode (built-in inspector).
6. **START CAPTURE** — screen stays on; every remote press fires its mapped
   command. Phone must stay on this screen (foreground-only capture is an
   Android platform constraint).

## Build

No Android Studio needed:

```
cd android-bridge
gradle assembleDebug   # needs JDK 17 + Android SDK 34 (local.properties)
```

Plain Java, zero dependencies — the APK is ~20 KB.
