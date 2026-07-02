package com.promptly.bridge;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Promptly Bridge — pairs with a BLE remote (e.g. ZTYTO TikTok/camera remotes)
 * and relays its input to Promptly's remote-control HTTP server.
 *
 * The remote's buttons reach Android as key events (volume/media/camera keys)
 * and/or synthetic touch gestures (swipes, taps). While Capture mode is active
 * this activity intercepts ALL of them, shows what arrived (built-in inspector),
 * and fires the command mapped to that event via POST /command — the same
 * endpoint Promptly's web remote uses. Intercepted volume keys are consumed, so
 * the phone's volume does not change.
 *
 * No third-party dependencies: framework widgets + HttpURLConnection.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "bridge";
    private static final String KEY_SERVER = "serverUrl";
    private static final String KEY_SEEN = "seenEvents";
    private static final String MAP_PREFIX = "map:";

    /** Promptly commands, in dropdown order. value "" = None. */
    private static final String[][] COMMANDS = {
            {"", "None"},
            {"play-pause", "Play / Pause"},
            {"next-chapter", "Next chapter"},
            {"prev-chapter", "Previous chapter"},
            {"reset", "Reset to start"},
            {"speed-up", "Speed up"},
            {"speed-down", "Speed down"},
            {"camera-liveview-toggle", "Toggle live view"},
            {"camera-record-toggle", "Start/Stop recording"},
    };

    /** Events shown by default (before anything is pressed), with friendly names. */
    private static final String[][] DEFAULT_EVENTS = {
            {"key:KEYCODE_VOLUME_UP", "Volume Up key"},
            {"key:KEYCODE_VOLUME_DOWN", "Volume Down key"},
            {"key:KEYCODE_ENTER", "Enter key"},
            {"key:KEYCODE_DPAD_CENTER", "Center/OK key"},
            {"key:KEYCODE_HEADSETHOOK", "Shutter/Headset key"},
            {"key:KEYCODE_MEDIA_PLAY_PAUSE", "Play/Pause media key"},
            {"swipe-up", "Swipe up"},
            {"swipe-down", "Swipe down"},
            {"swipe-left", "Swipe left"},
            {"swipe-right", "Swipe right"},
            {"tap", "Tap"},
            {"double-tap", "Double tap"},
            {"long-press", "Long press"},
    };

    private SharedPreferences prefs;
    private final ExecutorService http = Executors.newSingleThreadExecutor();

    private EditText serverInput;
    private TextView statusText;
    private LinearLayout mappingList;
    private FrameLayout captureOverlay;
    private TextView captureEventText;
    private TextView captureLogText;
    private boolean capturing = false;
    private final List<String> log = new ArrayList<>();
    private GestureDetector gestures;
    /** Ordered eventId -> friendly label, defaults first then newly-seen. */
    private final Map<String, String> knownEvents = new LinkedHashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        for (String[] e : DEFAULT_EVENTS) knownEvents.put(e[0], e[1]);
        for (String seen : prefs.getStringSet(KEY_SEEN, java.util.Collections.<String>emptySet())) {
            if (!knownEvents.containsKey(seen)) knownEvents.put(seen, friendlyName(seen));
        }

        buildUi();
        rebuildMappingRows();

        gestures = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent e) { return true; }
            @Override public boolean onSingleTapConfirmed(MotionEvent e) { onRemoteEvent("tap"); return true; }
            @Override public boolean onDoubleTap(MotionEvent e) { onRemoteEvent("double-tap"); return true; }
            @Override public void onLongPress(MotionEvent e) { onRemoteEvent("long-press"); }
            @Override public boolean onFling(MotionEvent e1, MotionEvent e2, float vx, float vy) {
                if (e1 == null || e2 == null) return false;
                float dx = e2.getX() - e1.getX(), dy = e2.getY() - e1.getY();
                if (Math.abs(dx) < 60 && Math.abs(dy) < 60) return false; // too small to call a swipe
                if (Math.abs(dy) >= Math.abs(dx)) onRemoteEvent(dy < 0 ? "swipe-up" : "swipe-down");
                else onRemoteEvent(dx < 0 ? "swipe-left" : "swipe-right");
                return true;
            }
        });
    }

    // ---------- UI ----------

    private void buildUi() {
        int pad = dp(16);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Promptly Bridge");
        title.setTextSize(24);
        title.setTypeface(null, Typeface.BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Pair your BLE remote with this phone, map its buttons below, then start Capture.");
        subtitle.setTextColor(0xFF9CA3AF);
        subtitle.setPadding(0, dp(4), 0, dp(16));
        root.addView(subtitle);

        TextView serverLabel = new TextView(this);
        serverLabel.setText("Promptly server (shown in Promptly's Remote panel)");
        serverLabel.setTextColor(0xFF9CA3AF);
        root.addView(serverLabel);

        LinearLayout serverRow = new LinearLayout(this);
        serverRow.setOrientation(LinearLayout.HORIZONTAL);
        serverInput = new EditText(this);
        serverInput.setHint("http://192.168.1.20:3001");
        serverInput.setText(prefs.getString(KEY_SERVER, ""));
        serverInput.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_URI);
        serverInput.setSingleLine(true);
        LinearLayout.LayoutParams grow = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        serverRow.addView(serverInput, grow);
        Button testBtn = new Button(this);
        testBtn.setText("Test");
        testBtn.setOnClickListener(v -> testConnection());
        serverRow.addView(testBtn);
        root.addView(serverRow);

        statusText = new TextView(this);
        statusText.setText("Not connected yet");
        statusText.setTextColor(0xFF9CA3AF);
        statusText.setPadding(0, dp(4), 0, dp(16));
        root.addView(statusText);

        TextView mapLabel = new TextView(this);
        mapLabel.setText("Button / gesture mappings");
        mapLabel.setTextSize(18);
        mapLabel.setTypeface(null, Typeface.BOLD);
        mapLabel.setPadding(0, dp(8), 0, dp(8));
        root.addView(mapLabel);

        TextView mapHint = new TextView(this);
        mapHint.setText("Unknown buttons appear here automatically the first time you press them in Capture mode.");
        mapHint.setTextColor(0xFF9CA3AF);
        mapHint.setPadding(0, 0, 0, dp(8));
        root.addView(mapHint);

        mappingList = new LinearLayout(this);
        mappingList.setOrientation(LinearLayout.VERTICAL);
        root.addView(mappingList);

        Button captureBtn = new Button(this);
        captureBtn.setText("START CAPTURE");
        captureBtn.setTextSize(18);
        captureBtn.setBackgroundColor(0xFF7C3AED);
        captureBtn.setTextColor(Color.WHITE);
        captureBtn.setPadding(pad, pad, pad, pad);
        LinearLayout.LayoutParams cbp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cbp.topMargin = dp(16);
        captureBtn.setLayoutParams(cbp);
        captureBtn.setOnClickListener(v -> setCapturing(true));
        root.addView(captureBtn);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);

        // Capture overlay: fullscreen surface that owns all input while active.
        captureOverlay = new FrameLayout(this);
        captureOverlay.setBackgroundColor(0xFF111827);
        captureOverlay.setVisibility(View.GONE);
        captureOverlay.setClickable(true);
        captureOverlay.setFocusable(true);

        LinearLayout overlayContent = new LinearLayout(this);
        overlayContent.setOrientation(LinearLayout.VERTICAL);
        overlayContent.setGravity(Gravity.CENTER_HORIZONTAL);
        overlayContent.setPadding(pad, dp(48), pad, pad);

        TextView capTitle = new TextView(this);
        capTitle.setText("CAPTURING — press your remote");
        capTitle.setTextColor(0xFFA78BFA);
        capTitle.setTextSize(18);
        capTitle.setTypeface(null, Typeface.BOLD);
        overlayContent.addView(capTitle);

        captureEventText = new TextView(this);
        captureEventText.setText("—");
        captureEventText.setTextColor(Color.WHITE);
        captureEventText.setTextSize(30);
        captureEventText.setTypeface(null, Typeface.BOLD);
        captureEventText.setGravity(Gravity.CENTER);
        captureEventText.setPadding(0, dp(32), 0, dp(24));
        overlayContent.addView(captureEventText);

        captureLogText = new TextView(this);
        captureLogText.setTextColor(0xFF9CA3AF);
        captureLogText.setTextSize(13);
        captureLogText.setTypeface(Typeface.MONOSPACE);
        overlayContent.addView(captureLogText);

        Button exitBtn = new Button(this);
        exitBtn.setText("Stop capture");
        exitBtn.setOnClickListener(v -> setCapturing(false));
        LinearLayout.LayoutParams ebp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ebp.topMargin = dp(24);
        ebp.gravity = Gravity.CENTER_HORIZONTAL;
        exitBtn.setLayoutParams(ebp);
        overlayContent.addView(exitBtn);

        captureOverlay.addView(overlayContent);

        FrameLayout shell = new FrameLayout(this);
        shell.addView(scroll);
        shell.addView(captureOverlay);
        setContentView(shell);
    }

    private void rebuildMappingRows() {
        mappingList.removeAllViews();
        List<String> values = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        for (String[] c : COMMANDS) { values.add(c[0]); labels.add(c[1]); }

        for (Map.Entry<String, String> ev : knownEvents.entrySet()) {
            final String eventId = ev.getKey();

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(4), 0, dp(4));

            TextView name = new TextView(this);
            name.setText(ev.getValue());
            name.setTextColor(Color.WHITE);
            LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            row.addView(name, np);

            Spinner spinner = new Spinner(this);
            ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                    android.R.layout.simple_spinner_dropdown_item, labels);
            spinner.setAdapter(adapter);
            String current = prefs.getString(MAP_PREFIX + eventId, "");
            int idx = values.indexOf(current);
            spinner.setSelection(Math.max(idx, 0));
            spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                @Override public void onItemSelected(AdapterView<?> p, View v, int pos, long id) {
                    prefs.edit().putString(MAP_PREFIX + eventId, values.get(pos)).apply();
                }
                @Override public void onNothingSelected(AdapterView<?> p) {}
            });
            LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            row.addView(spinner, sp);

            mappingList.addView(row);
        }
    }

    private void setCapturing(boolean on) {
        capturing = on;
        captureOverlay.setVisibility(on ? View.VISIBLE : View.GONE);
        if (on) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            captureOverlay.requestFocus();
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            rebuildMappingRows(); // pick up any events discovered while capturing
        }
    }

    // ---------- Input interception ----------

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (!capturing) return super.dispatchKeyEvent(event);
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) setCapturing(false);
            return true;
        }
        // Fire on first DOWN only; consume both DOWN and UP so the system never
        // acts on the key (this is what stops volume keys changing the volume).
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            onRemoteEvent("key:" + KeyEvent.keyCodeToString(code));
        }
        return true;
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (!capturing) return super.dispatchTouchEvent(event);
        // Let the Stop button work: pass through touches that land on it.
        // Everything else (including the remote's synthetic swipes) feeds the
        // gesture detector.
        if (isOnStopButton(event)) return super.dispatchTouchEvent(event);
        gestures.onTouchEvent(event);
        return true;
    }

    private boolean isOnStopButton(MotionEvent event) {
        View btn = findStopButton(captureOverlay);
        if (btn == null) return false;
        int[] loc = new int[2];
        btn.getLocationOnScreen(loc);
        float x = event.getRawX(), y = event.getRawY();
        return x >= loc[0] && x <= loc[0] + btn.getWidth()
                && y >= loc[1] && y <= loc[1] + btn.getHeight();
    }

    private View findStopButton(ViewGroup group) {
        for (int i = 0; i < group.getChildCount(); i++) {
            View child = group.getChildAt(i);
            if (child instanceof Button) return child;
            if (child instanceof ViewGroup) {
                View found = findStopButton((ViewGroup) child);
                if (found != null) return found;
            }
        }
        return null;
    }

    // ---------- Event -> command ----------

    private void onRemoteEvent(String eventId) {
        if (!knownEvents.containsKey(eventId)) {
            knownEvents.put(eventId, friendlyName(eventId));
            java.util.Set<String> seen = new java.util.HashSet<>(
                    prefs.getStringSet(KEY_SEEN, java.util.Collections.<String>emptySet()));
            seen.add(eventId);
            prefs.edit().putStringSet(KEY_SEEN, seen).apply();
        }

        String command = prefs.getString(MAP_PREFIX + eventId, "");
        String display = friendlyName(eventId);
        captureEventText.setText(display);

        if (command.isEmpty()) {
            addLog(display + "  →  (not mapped)");
        } else {
            addLog(display + "  →  " + commandLabel(command));
            postCommand(command);
        }
    }

    private String commandLabel(String value) {
        for (String[] c : COMMANDS) if (c[0].equals(value)) return c[1];
        return value;
    }

    private String friendlyName(String eventId) {
        for (String[] e : DEFAULT_EVENTS) if (e[0].equals(eventId)) return e[1];
        if (eventId.startsWith("key:KEYCODE_")) {
            String raw = eventId.substring("key:KEYCODE_".length());
            return raw.replace('_', ' ').toLowerCase() + " key";
        }
        return eventId;
    }

    private void addLog(String line) {
        log.add(0, line);
        while (log.size() > 8) log.remove(log.size() - 1);
        captureLogText.setText(String.join("\n", log));
    }

    // ---------- HTTP ----------

    private String serverBase() {
        String url = serverInput.getText().toString().trim();
        if (url.isEmpty()) return null;
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://" + url;
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        prefs.edit().putString(KEY_SERVER, url).apply();
        return url;
    }

    private void testConnection() {
        final String base = serverBase();
        if (base == null) { statusText.setText("Enter the server address first"); return; }
        statusText.setText("Testing…");
        http.execute(() -> {
            String result;
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(base + "/state").openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
                result = conn.getResponseCode() == 200 ? "Connected ✓" : ("Server said HTTP " + conn.getResponseCode());
                conn.disconnect();
            } catch (Exception e) {
                result = "Can't reach Promptly: " + e.getMessage();
            }
            final String shown = result;
            runOnUiThread(() -> statusText.setText(shown));
        });
    }

    private void postCommand(String command) {
        final String base = serverBase();
        if (base == null) { addLog("(no server configured)"); return; }
        http.execute(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(base + "/command").openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                byte[] body = ("{\"command\":\"" + command + "\"}").getBytes(StandardCharsets.UTF_8);
                OutputStream out = conn.getOutputStream();
                out.write(body);
                out.close();
                int status = conn.getResponseCode();
                conn.disconnect();
                if (status != 200) runOnUiThread(() -> addLog("send failed: HTTP " + status));
            } catch (Exception e) {
                final String msg = e.getMessage();
                runOnUiThread(() -> addLog("send failed: " + msg));
            }
        });
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        http.shutdownNow();
    }
}
