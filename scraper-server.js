const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {

  const URL = 'https://reservation.forest-hill.fr/club/forest-hill-versailles/reservation/padel';
  const MAX_DAYS = 7;

  const normalizeHHMM = (t) => {
    const m = String(t).match(/\b(\d{1,2}):(\d{2})\b/);
    if (!m) return null;
    return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
  };

  // 🔥 Nouvelle version robuste
  const parseDetails = (text) => {
  const raw = String(text || '').replace(/\u00A0/g, ' ').trim();
  const lower = raw.toLowerCase();

  const hasSimple = /\bsimple\b/.test(lower);
  const hasDouble = /\bdouble\b/.test(lower);

  const lit =
    /\béclair/i.test(lower) ||
    /\beclair/i.test(lower) ||
    /\blumi[eè]re\b/i.test(raw);

  const results = [];

  if (hasSimple) {
    results.push({
      mode: 'simple',
      capacity: 2,
      lit
    });
  }

  if (hasDouble) {
    results.push({
      mode: 'double',
      capacity: 4,
      lit
    });
  }

  return results;
};

  let browser;

  try {

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Fermer popup cookies
    const cookieBtn = page.locator('button:has-text("OK pour moi")');
    if (await cookieBtn.count()) {
      await cookieBtn.first().click().catch(() => {});
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2000);

    const slots = [];

    for (let d = 0; d < MAX_DAYS; d++) {

      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + d);
      const isoDate = baseDate.toISOString().split('T')[0];
      const dayNumber = baseDate.getDate().toString();

      console.log("Scraping date:", isoDate);

      // 🔥 Cliquer directement sur le bouton du jour
      const dayButton = page.locator(`button:has-text("${dayNumber}")`).first();

      if (await dayButton.count()) {
        await dayButton.click().catch(() => {});
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      }

      const hourButtons = page.locator('button:visible');

      const metas = await hourButtons.evaluateAll((btns) => {
        const norm = (s) => (s || '').replace(/\u00A0/g, ' ').trim();
        return btns
          .map((b, idx) => ({ idx, t: norm(b.textContent) }))
          .filter(x => /^\d{1,2}:\d{2}$/.test(x.t));
      });

      for (const meta of metas) {

        const btn = hourButtons.nth(meta.idx);
        const time = normalizeHHMM(meta.t);

        const cardText = await btn.evaluate(el => {
  return el.closest('[class*="card"], [class*="slot"], [class*="booking"]')?.innerText || el.innerText;
});

	
        const parsedModes = parseDetails(cardText);

        for (const parsed of parsedModes) {
          slots.push({
            date: isoDate,
            day: baseDate.getDate(),
            time,
            mode: parsed.mode,
            lit: parsed.lit,
            capacity: parsed.capacity
          });
        }
      }
    }

    // 🔥 GROUPING PROPRE
    const grouped = new Map();

    for (const s of slots) {
      const key = `${s.date}-${s.time}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: s.date,
          day: s.day,
          time: s.time,
          capacities: new Set(),
        });
      }

      if (s.capacity) {
        grouped.get(key).capacities.add(s.capacity);
      }
    }

    const courts = Array.from(grouped.values())
      .map(x => ({
        date: x.date,
        day: x.day,
        hours: [x.time],
        capacity: Array.from(x.capacities).sort((a,b) => a-b)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      courts,
      slots
    });

  } catch (err) {

    console.error("SCRAPER ERROR:", err);

    res.status(500).json({
      ok: false,
      error: err.message,
      stack: err.stack
    });

  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scraper running on port ${PORT}`);
});