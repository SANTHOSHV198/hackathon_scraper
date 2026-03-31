const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logger');

async function fetchDevpostHackathons(runId) {
  logger.info(`[${runId}] [DEVPOST] Scraper started`);
  const metrics = { found: 0, valid: 0, skipped: 0, errors: 0 };

  try {
    logger.info(`[${runId}] [DEVPOST] Fetching data from API -> https://devpost.com/api/hackathons`);
    const response = await axios.get('https://devpost.com/api/hackathons', { timeout: 15000 });
    logger.info(`[${runId}] [DEVPOST] Fetch successful. Status: ${response.status}`);
    
    logger.info(`[${runId}] [DEVPOST] Parsing stage began`);
    const rawHackathons = response.data.hackathons;
    
    if (!rawHackathons || !Array.isArray(rawHackathons)) {
      logger.warn(`[${runId}] [DEVPOST] Data structure mismatch: expected 'hackathons' array`);
      metrics.errors++;
      return { hackathons: [], metrics };
    }

    metrics.found = rawHackathons.length;
    logger.info(`[${runId}] [DEVPOST] Detected ${metrics.found} raw hackathon elements`);

    const hackathons = [];

    for (const h of rawHackathons) {
      if (!h.title || !h.url) {
        metrics.skipped++;
        logger.warn(`[${runId}] [DEVPOST] Skipped item due to missing title or url (ID: ${h.id || 'unknown'})`);
        continue;
      }

      const cleanPrize = h.prize_amount ? h.prize_amount.replace(/<[^>]+>/g, '') : '';
      
      hackathons.push({
        id: `devpost-${h.id}`,
        source: 'DEVPOST',
        title: h.title,
        url: h.url,
        date_raw: h.submission_period_dates || 'N/A',
        location: h.displayed_location?.location || 'Online',
        themes: h.themes ? h.themes.map(t => t.name) : [],
        prize_amount: cleanPrize,
        thumbnail_url: h.thumbnail_url ? 'https:' + h.thumbnail_url : ''
      });
      metrics.valid++;
    }

    logger.info(`[${runId}] [DEVPOST] Validation complete: ${metrics.valid} valid entries, ${metrics.skipped} skipped`);
    return { hackathons, metrics };

  } catch (error) {
    metrics.errors++;
    logger.error(`[${runId}] [DEVPOST] Stage: Fetching/Parsing Failed | Reason: ${error.message}`);
    return { hackathons: [], metrics };
  }
}

async function fetchMLHHackathons(runId) {
  logger.info(`[${runId}] [MLH] Scraper started`);
  const metrics = { found: 0, valid: 0, skipped: 0, errors: 0 };

  try {
    logger.info(`[${runId}] [MLH] Fetching data from URL -> https://mlh.io/seasons/2026/events`);
    const response = await axios.get('https://mlh.io/seasons/2026/events', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });
    logger.info(`[${runId}] [MLH] Fetch successful. Status: ${response.status}`);
    
    logger.info(`[${runId}] [MLH] Parsing HTML stage began`);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // New MLH Structure Targeting (a tags with itemtype Event)
    const elements = $('a[itemtype="https://schema.org/Event"]');
    metrics.found = elements.length;
    logger.info(`[${runId}] [MLH] Detected ${metrics.found} raw event elements`);

    if (metrics.found === 0) {
      logger.warn(`[${runId}] [MLH] Expected DOM elements not found. HTML structure might have changed again.`);
    }

    const hackathons = [];

    elements.each((i, el) => {
      const url = $(el).attr('href');
      const title = $(el).find('h4').text().trim();
      
      const spans = $(el).find('.text-sm.truncate');
      const date_raw = spans.eq(0).text().trim() || 'N/A';
      const location = spans.eq(1).text().trim() || 'Online';
      
      // Attempt to find logo image inside the rounded-container (usually second image or the one enclosed with absolute container)
      // The background image uses group-hover:scale-105, we typically want the actual icon
      let thumbnail_url = $(el).find('.absolute img').attr('src');
      if (!thumbnail_url) thumbnail_url = $(el).find('img').first().attr('src');
      
      if (title && url) {
        hackathons.push({
          id: `mlh-${i}-${title.replace(/\s+/g,'-').substring(0,10)}`,
          source: 'MLH',
          title,
          url,
          date_raw,
          location,
          themes: ['Beginner Friendly'], // MLH generally targets university/beginners
          prize_amount: 'TBD',
          thumbnail_url: thumbnail_url || ''
        });
        metrics.valid++;
      } else {
        metrics.skipped++;
        logger.warn(`[${runId}] [MLH] Skipped DOM element missing title or url at index ${i}`);
      }
    });

    logger.info(`[${runId}] [MLH] Validation complete: ${metrics.valid} valid entries, ${metrics.skipped} skipped`);
    return { hackathons, metrics };

  } catch (error) {
    metrics.errors++;
    logger.error(`[${runId}] [MLH] Stage: Fetching/Parsing Failed | Reason: ${error.message}`);
    return { hackathons: [], metrics };
  }
}

module.exports = {
  fetchDevpostHackathons,
  fetchMLHHackathons
};
