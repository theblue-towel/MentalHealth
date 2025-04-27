const express = require("express");
const activeWin = require("active-win");
const { createObjectCsvWriter } = require("csv-writer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { promises: fsPromises } = require("fs");

const app = express();
const PORT = 3000;

// Static UI
app.use(express.static(path.join(__dirname, "public")));

// CSV writer factory (so we can re-create after clearing)
const csvPath = path.join(__dirname, "activity.csv");
let csvWriter = getCsvWriter(fs.existsSync(csvPath));

function getCsvWriter(writeHeaders) {
  return createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "start_time", title: "Start Time" },
      { id: "end_time", title: "End Time" },
      { id: "window_title", title: "Window Title" },
      { id: "app_name", title: "App Name" },
      { id: "duration_seconds", title: "Duration (seconds)" },
    ],
    append: true,
    alwaysWriteHeaders: !writeHeaders,
  });
}

// Active-window tracking
let prevApp = null,
  prevWin = null,
  prevStart = null;
let intervalId = null,
  warned = false;

async function trackActiveWindow() {
  try {
    const win = await activeWin();
    const now = new Date();

    // Locked case
    if (!win || !win.owner || !win.title) {
      if (prevApp) {
        await csvWriter.writeRecords([
          {
            start_time: prevStart.toISOString(),
            end_time: now.toISOString(),
            window_title: `${prevWin} (locked)`,
            app_name: prevApp,
            duration_seconds: ((now - prevStart) / 1000).toFixed(2),
          },
        ]);
        prevApp = prevWin = prevStart = null;
      }
      return;
    }

    // Title/app change
    const appName = win.owner.name,
      winTitle = win.title;
    if (appName !== prevApp || winTitle !== prevWin) {
      if (prevApp) {
        await csvWriter.writeRecords([
          {
            start_time: prevStart.toISOString(),
            end_time: now.toISOString(),
            window_title: prevWin,
            app_name: prevApp,
            duration_seconds: ((now - prevStart) / 1000).toFixed(2),
          },
        ]);
      }
      prevApp = appName;
      prevWin = winTitle;
      prevStart = now;
    }
  } catch (err) {
    const out = (err.stdout || "").toString();
    if (!warned && out.includes("requires the screen recording permission")) {
      console.warn("⚠️ Grant Screen Recording permission.");
      warned = true;
      return;
    }
    console.error("trackActiveWindow error:", err);
  }
}

function startTracking() {
  if (intervalId) return;
  intervalId = setInterval(trackActiveWindow, 1000);
}
function stopTracking() {
  clearInterval(intervalId);
  intervalId = null;
}

// Emotion subprocess
let emotionProc = null;
function startEmotionTracker() {
  if (emotionProc) return;
  emotionProc = spawn(
    process.platform === "win32" ? "python" : "python3",
    ["emotion.py"],
    { cwd: __dirname }
  );
  emotionProc.stdout.on("data", (d) => process.stdout.write(`[EMOTION] ${d}`));
  emotionProc.stderr.on("data", (d) =>
    process.stderr.write(`[EMOTION ERR] ${d}`)
  );
  emotionProc.on("close", (c) => {
    console.log(`Emotion exited ${c}`);
    emotionProc = null;
  });
}
function stopEmotionTracker() {
  if (!emotionProc) return;
  emotionProc.kill("SIGTERM");
  emotionProc = null;
}

// Helper to run any Python script by name
function runPython(script) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === "win32" ? "python" : "python3";
    console.log(`➤ Running ${script}…`);
    const p = spawn(cmd, [script], { cwd: __dirname });
    p.stdout.on("data", (d) => process.stdout.write(`[${script}] ${d}`));
    p.stderr.on("data", (d) => process.stderr.write(`[${script} ERR] ${d}`));
    p.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${script} succeeded`);
        resolve();
      } else {
        reject(new Error(`${script} failed (${code})`));
      }
    });
  });
}

// Flush one last tick
async function flushLastWindow() {
  try {
    await trackActiveWindow();
  } catch {}
}

// Routes
app.get("/start", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  startTracking();
  startEmotionTracker();
});

app.get("/stop", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  stopTracking();
  stopEmotionTracker();
});

app.get("/save", async (req, res) => {
  try {
    stopTracking();
    stopEmotionTracker();
    await flushLastWindow();

    // 1) merge.py → final.csv
    console.log("🔄 merge.py");
    await runPython("merge.py");

    // 2) Check final.csv
    const finalPath = path.join(__dirname, "final.csv");
    await fsPromises.access(finalPath);
    const { size } = await fsPromises.stat(finalPath);
    if (size === 0) throw new Error("final.csv empty");
    console.log(`✅ final.csv (${size} bytes)`);

    // 3) analyze.py → reports
    console.log("🔄 analyze.py");
    await runPython("analyze.py");

    // 4) deliver report
    const rpt = path.join(__dirname, "emotion_websites_report.txt");
    await fsPromises.access(rpt);
    res.download(rpt);
  } catch (err) {
    console.error("/save error:", err);
    res.status(500).send(err.message);
  }
});

app.post("/clear", async (req, res) => {
  const toClear = [
    "activity.csv",
    "emotion.csv",
    "final.csv",
    "emotion_analysis.csv",
    "emotion_websites_report.txt",
  ];
  for (const f of toClear) {
    try {
      await fsPromises.access(f);
      await fsPromises.writeFile(f, "", "utf8");
    } catch {}
  }
  // re-create writer so header is back next time
  csvWriter = getCsvWriter(false);
  res.send("Cleared.");
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

process.on("SIGINT", () => {
  stopTracking();
  stopEmotionTracker();
  process.exit();
});

app.listen(PORT, () => console.log(`Listening on :${PORT}`));
