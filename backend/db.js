const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');

const dbPath = path.resolve(__dirname, 'hackathons.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error(`[SYSTEM] [INIT] Error connecting to SQLite DB: ${err.message}`);
  } else {
    logger.info('[SYSTEM] [INIT] ✅ Connected to SQLite database.');
  }
});

const initSchema = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS hackathons (
      id TEXT PRIMARY KEY,
      source TEXT,
      title TEXT,
      url TEXT,
      date_raw TEXT,
      location TEXT,
      themes TEXT,
      prize_amount TEXT,
      thumbnail_url TEXT
    )
  `, (err) => {
    if (err) {
      logger.error(`[SYSTEM] [INIT] Error creating table: ${err.message}`);
    } else {
      logger.info('[SYSTEM] [INIT] 📌 Hackathons table initialized.');
    }
  });
};

initSchema();

module.exports = db;
