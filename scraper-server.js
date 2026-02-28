const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const URL = 'https://reservation.forest-hill.fr/club/forest-hill-versailles/reservation/padel';
    const MAX_DAYS = 7;

    await page.goto(URL, { waitUntil: 'networkidle' });

    // 👉 ICI tu mets TON CODE de scraping actuel
    // La partie qui construit : { ok: true, courts: [...] }

    const result = {
      ok: true,
      courts: [] // remplace par ton vrai résultat
    };

    await browser.close();

    res.json(result);

  } catch (error) {
    res.json({
      ok: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper running on port ${PORT}`);
});