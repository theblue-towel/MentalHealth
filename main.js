const activeWin = require('active-win');
const fs = require('fs');
const { Parser } = require('json2csv');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const SLEEP_INTERVAL = 1000; // milliseconds
const CSV_FILE = 'website_time_tracking.csv';

let currentWindow = null;
let startTime = null;
let records = [];

async function getActiveWindowTitle() {
    try {
        const window = await activeWin();
        return window ? window.title : null;
    } catch (error) {
        console.error('Error getting active window:', error);
        return null;
    }
}

async function trackWindows() {
    console.log('Tracking active windows... Press CTRL+C to stop.');

    try {
        while (true) {
            const activeWindow = await getActiveWindowTitle();

            if (activeWindow !== currentWindow) {
                if (currentWindow && startTime) {
                    const endTime = Date.now();
                    const durationSeconds = (endTime - startTime) / 1000;
                    records.push({
                        window_title: currentWindow,
                        start_time: new Date(startTime).toISOString(),
                        end_time: new Date(endTime).toISOString(),
                        duration_seconds: durationSeconds.toFixed(2)
                    });
                }
                currentWindow = activeWindow;
                startTime = Date.now();
            }

            await sleep(SLEEP_INTERVAL);
        }
    } catch (err) {
        console.error('Error during tracking:', err);
    }
}

// Handle exiting cleanly
process.on('SIGINT', () => {
    console.log('\nStopping tracking. Saving data to CSV...');
    if (currentWindow && startTime) {
        const endTime = Date.now();
        const durationSeconds = (endTime - startTime) / 1000;
        records.push({
            window_title: currentWindow,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            duration_seconds: durationSeconds.toFixed(2)
        });
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(records);

    fs.writeFileSync(CSV_FILE, csv);
    console.log(`Data saved to ${CSV_FILE}`);
    process.exit();
});

// Start tracking
trackWindows();
