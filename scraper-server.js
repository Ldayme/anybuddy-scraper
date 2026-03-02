const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {

  const CENTER_ID = 'forest-hill-versailles';
  const MAX_DAYS = 7;

  const results = [];

  try {

    for (let d = 0; d < MAX_DAYS; d++) {

      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + d);

      const from = baseDate.toISOString().split('T')[0];
      const toDate = new Date(baseDate);
      toDate.setDate(toDate.getDate() + 1);
      const to = toDate.toISOString().split('T')[0];

      const url = `https://api-booking.anybuddyapp.com/v2/centers/${CENTER_ID}/availabilities?date.from=${from}&date.to=${to}T00:00&activities=padel&partySize=0`;

      console.log("Calling API:", url);

      const response = await fetch(url);
      const data = await response.json();

      if (!data.data) continue;

      for (const slot of data.data) {

        const dateTime = slot.startDateTime;
        const date = dateTime.split('T')[0];
        const time = dateTime.split('T')[1];

        for (const service of slot.services) {

          const ratio = service.priceComplete / service.price;

          if (ratio === 2) {
            console.log("⚠️ TERRAIN 2 JOUEURS DETECTE:", service);
          }

          results.push({
            date,
            time,
            totalCapacity: service.totalCapacity,
            availablePlaces: service.availablePlaces,
            priceTotal: service.priceComplete / 100,
            pricePerPlayer: service.price / 100,
            ratio
          });
        }
      }
    }

    res.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      slots: results
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scraper running on port ${PORT}`);
});