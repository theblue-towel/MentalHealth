// server.js
const express = require('express');
const activeWin = require('active-win');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

const app = express();
const port = 3000;

// serve static files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// tracking state
let records = [];
let previousApp = null;
let previousWindow = null;
let previousStartTime = null;
let intervalId = null;

// CSV writer
const csvWriter = createObjectCsvWriter({
  path: 'activity_log.csv',
  header: [
    { id: 'start_time', title: 'Start Time' },
    { id: 'end_time', title: 'End Time' },
    { id: 'window_title', title: 'Window Title' },
    { id: 'app_name', title: 'App Name' },
    { id: 'duration_seconds', title: 'Duration (seconds)' }
  ]
});

async function trackActiveWindow() {
  try {
    const win = await activeWin();
    const now = new Date();

    if (!win) {
      // screen locked or no window
      if (previousApp) {
        const duration = (now - previousStartTime) / 1000;
        records.push({
          start_time: previousStartTime.toISOString(),
          end_time: now.toISOString(),
          window_title: previousWindow + ' (locked)',
          app_name: previousApp,
          duration_seconds: duration.toFixed(2)
        });
        console.log(`Logged (locked): ${previousApp} - "${previousWindow}" for ${duration.toFixed(2)}s`);
        previousApp = previousWindow = previousStartTime = null;
      }
      return;
    }

    const appName = win.owner.name;
    const windowTitle = win.title;

    if (appName !== previousApp || windowTitle !== previousWindow) {
      if (previousApp) {
        const duration = (now - previousStartTime) / 1000;
        records.push({
          start_time: previousStartTime.toISOString(),
          end_time: now.toISOString(),
          window_title: previousWindow,
          app_name: previousApp,
          duration_seconds: duration.toFixed(2)
        });
        console.log(`Logged: ${previousApp} - "${previousWindow}" for ${duration.toFixed(2)}s`);
      }
      previousApp = appName;
      previousWindow = windowTitle;
      previousStartTime = now;
    }
  } catch (err) {
    console.error('Error in trackActiveWindow:', err);
  }
}

function startTracking() {
  if (intervalId) return;
  console.log('Starting tracking');
  intervalId = setInterval(trackActiveWindow, 1000);
}

function stopTracking() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log('Stopping tracking');
}

// API endpoints for button
app.get('/start', (req, res) => {
  startTracking();
  res.send('tracking started');
});

app.get('/stop', (req, res) => {
  stopTracking();
  res.send('tracking stopped');
});

// manual save
app.get('/save', async (req, res) => {
  stopTracking();
  await trackActiveWindow();
  if (records.length) {
    await csvWriter.writeRecords(records);
    res.send('CSV saved');
  } else {
    res.send('No records to save');
  }
});

// health
app.get('/', (req, res) => {
  res.render('public/index.html');
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
