// server.js
const express = require("express");
const activeWin = require("active-win");
const { createObjectCsvWriter } = require("csv-writer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Serve your index.html + any static assets under ./public
app.use(express.static(path.join(__dirname, "public")));

// CSV setup
const csvPath = path.join(__dirname, "activity.csv");
const fileExists = fs.existsSync(csvPath);
const csvWriter = createObjectCsvWriter({
  path: csvPath,
  header: [
    { id: "start_time", title: "Start Time" },
    { id: "end_time", title: "End Time" },
    { id: "window_title", title: "Window Title" },
    { id: "app_name", title: "App Name" },
    { id: "duration_seconds", title: "Duration (seconds)" },
  ],
  append: true,
  alwaysWriteHeaders: !fileExists,
});

let previousApp = null;
let previousWindow = null;
let previousStartTime = null;
let intervalId = null;
let warnedNoPerm = false;

async function trackActiveWindow() {
  try {
    const win = await activeWin();
    const now = new Date();

    // no window/focused apps (e.g. screen locked)
    if (!win || !win.owner || !win.title) {
      if (previousApp) {
        const rec = {
          start_time: previousStartTime.toISOString(),
          end_time: now.toISOString(),
          window_title: `${previousWindow} (locked)`,
          app_name: previousApp,
          duration_seconds: ((now - previousStartTime) / 1000).toFixed(2),
        };
        await csvWriter.writeRecords([rec]);
        console.log("→ wrote record:", rec);
        previousApp = previousWindow = previousStartTime = null;
      }
      return;
    }

    const appName = win.owner.name;
    const windowTitle = win.title;

    // on change of active app or window title
    if (appName !== previousApp || windowTitle !== previousWindow) {
      if (previousApp) {
        const rec = {
          start_time: previousStartTime.toISOString(),
          end_time: now.toISOString(),
          window_title: previousWindow,
          app_name: previousApp,
          duration_seconds: ((now - previousStartTime) / 1000).toFixed(2),
        };
        await csvWriter.writeRecords([rec]);
        console.log("→ wrote record:", rec);
      }
      previousApp = appName;
      previousWindow = windowTitle;
      previousStartTime = now;
    }
  } catch (err) {
    // handle macOS screen-recording-permission error specially
    const out = (err.stdout || "").toString();
    if (
      !warnedNoPerm &&
      out.includes("requires the screen recording permission")
    ) {
      console.warn(
        "⚠️ active-win needs Screen Recording permission (System Settings › Privacy & Security › Screen Recording)."
      );
      warnedNoPerm = true;
      return;
    }
    console.error("Error in trackActiveWindow:", err);
  }
}

function startTracking() {
  if (intervalId) return;
  console.log("Starting tracking…");
  intervalId = setInterval(trackActiveWindow, 1000);
}

function stopTracking() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log("Stopped tracking.");
}

// API endpoints
app.get("/start", (req, res) => {
  startTracking();
  res.send("tracking started");
});

app.get("/stop", (req, res) => {
  stopTracking();
  res.send("tracking stopped");
});

// final flush if needed
app.get("/save", async (req, res) => {
  stopTracking();
  await trackActiveWindow();
  res.send("one final record flushed to CSV");
});

// serve index
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// graceful shutdown on Ctrl-C
process.on("SIGINT", () => {
  stopTracking();
  console.log("\nServer shutting down.");
  process.exit();
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
