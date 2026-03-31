const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const { data } = await axios.get('https://mlh.io/seasons/2026/events', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(data);
  let out = '';
  
  const prevSelector = $('.event-wrapper');
  out += 'Prev selector .event-wrapper count: ' + prevSelector.length + '\n';
  
  const firstLink = $('a').filter((i, el) => {
    const href = $(el).attr('href');
    return href && href.includes('utm_source=mlh');
  }).first();

  out += 'First link parent HTML:\n' + (firstLink.parent().html() || firstLink.html());
  fs.writeFileSync('mlh_out_utf8.txt', out, 'utf8');
}

test();
