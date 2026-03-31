const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const crypto = require('crypto');
const { fetchDevpostHackathons, fetchMLHHackathons } = require('./scrapers');
const logger = require('./logger');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Main orchestrator function for synchronizing across platforms
async function syncHackathons(triggerSource = 'Manual Run') {
  const runId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  logger.info(`[${runId}] [SCRAPER] Engine started via ${triggerSource}.`);

  try {
    // Process sources concurrently, expecting explicit structure from scrapers.js
    const [devpostResult, mlhResult] = await Promise.all([
      fetchDevpostHackathons(runId),
      fetchMLHHackathons(runId)
    ]);
    
    logger.info(`[${runId}] [SCRAPER] Extraction modules completed.`);

    // Flatten logic
    const combined = [...devpostResult.hackathons, ...mlhResult.hackathons];
    const totalFound = combined.length;
    
    if (totalFound === 0) {
      logger.warn(`[${runId}] [SCRAPER] No hackathons recovered from any source. Aborting database operations.`);
      return;
    }

    // Deduplication Phase memory tracking
    logger.info(`[${runId}] [SCRAPER] Filtering duplicates...`);
    const uniqueTitles = new Set();
    const filtered = [];
    let duplicatesSkipped = 0;
    
    for (const h of combined) {
        if (!uniqueTitles.has(h.title)) { 
            uniqueTitles.add(h.title);
            filtered.push(h);
        } else {
            duplicatesSkipped++;
        }
    }

    logger.info(`[${runId}] [SCRAPER] Skipped ${duplicatesSkipped} duplicate entries. Preparing ${filtered.length} unique hackathons for database processing.`);

    // Secure database processing scope
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO hackathons 
      (id, source, title, url, date_raw, location, themes, prize_amount, thumbnail_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      let insertCount = 0;
      let dbErrorCount = 0;

      for (const h of filtered) {
        stmt.run(
          h.id,
          h.source,
          h.title,
          h.url,
          h.date_raw,
          h.location,
          JSON.stringify(h.themes),
          h.prize_amount,
          h.thumbnail_url,
          function(err) {
            if (err) {
              dbErrorCount++;
              logger.error(`[${runId}] [DATABASE] Stage: Database Error | Reason: ${err.message} | Payload ID: ${h.id}`);
            } else {
              insertCount++;
            }
          }
        );
      }

      db.run('COMMIT', (dbErr) => {
        stmt.finalize();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (dbErr) {
          logger.error(`[${runId}] [DATABASE] Stage: Commit Rollback | Reason: ${dbErr.message}`);
        } else {
          logger.info(`[${runId}] [DATABASE] Database transaction committed successfully.`);
          
          let nextRunText = "N/A (Manual Trigger)";
          if (triggerSource === 'Scheduled Cron Interval') {
            const nextTime = new Date();
            nextTime.setHours(nextTime.getHours() + 6);
            nextRunText = nextTime.toLocaleString();
          } else {
            const nextTime = new Date();
            // Estimate next 6h block alignment conceptually if they want it on boot
            const curHour = nextTime.getHours();
            const remainder = curHour % 6;
            const hoursToAdd = 6 - remainder;
            nextTime.setHours(curHour + hoursToAdd, 0, 0, 0);
            nextRunText = nextTime.toLocaleString();
          }

          // COMPREHENSIVE SCRAPER COMPLETION LOG
          logger.info(`
============== [${runId}] SCRAPER COMPLETION SUMMARY ==============
• EXECUTION CONTEXT 
   Trigger Source : ${triggerSource}
   Time Elapsed   : ${duration} seconds
   Next Sched Run : ${nextRunText}

• SOURCE BREAKDOWN 
   [DEVPOST] => Fetched: ${devpostResult.metrics.found} | Valid: ${devpostResult.metrics.valid} | Skipped: ${devpostResult.metrics.skipped} | Errors: ${devpostResult.metrics.errors}
   [MLH]     => Fetched: ${mlhResult.metrics.found} | Valid: ${mlhResult.metrics.valid} | Skipped: ${mlhResult.metrics.skipped} | Errors: ${mlhResult.metrics.errors}

• GLOBAL SUMMARY 
   Total Processed   : ${totalFound} hackathons processed
   Duplicates Skipped: ${duplicatesSkipped} skipped
   Database Inserts  : Inserted ${insertCount} new records
   Total Flow Errors : ${(devpostResult.metrics.errors || 0) + (mlhResult.metrics.errors || 0) + dbErrorCount} errors
===================================================================`);
        }
      });
    });

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error(`[${runId}] [SCRAPER] Stage: Master Thread Exception | Reason: ${error.message} | Elapsed: ${duration}s`);
  }
}

// System API Routing Configuration
app.get('/', (req, res) => res.send('Welcome to the Hackathon Aggregator API'));

app.get('/api/hackathons', (req, res) => {
  const { search = '', theme = '' } = req.query;
  
  let query = 'SELECT * FROM hackathons WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (title LIKE ? OR location LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (theme) {
    query += ' AND themes LIKE ?';
    params.push(`%${theme}%`);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      logger.error(`[SYSTEM] [API] Database query error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to fetch data' });
    }

    const parsedRows = rows.map(row => {
      try {
        row.themes = JSON.parse(row.themes);
      } catch (e) {
        row.themes = [];
      }
      return row;
    });

    res.json({
      meta: {
        total_count: parsedRows.length,
        retrieved_at: new Date()
      },
      hackathons: parsedRows
    });
  });
});

// Start listening first
app.listen(PORT, () => {
  logger.info(`[SYSTEM] [INIT] 🚀 Backend server initialized and listening on http://localhost:${PORT}`);
  
  // Delay the manual sync boot by 1 second to explicitly separate it from INIT phase logs
  setTimeout(() => {
    syncHackathons('Manual Startup Boot');
  }, 1000);
});

// Schedule automated long-term jobs (runs at 0th minute of every 6th hour)
cron.schedule('0 */6 * * *', () => {
    syncHackathons('Scheduled Cron Interval');
});
