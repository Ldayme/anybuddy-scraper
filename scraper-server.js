const express = require('express');
const axios = require('axios');

const API_KEY = process.env.API_KEY;
const app = express();

app.use(express.json());

// ===============================
// Liste des clubs autorisés
// ===============================

const ALLOWED_CENTERS = [
  "forest-hill-versailles",
  "forest-hill-marnes-la-coquette",
  "ucpa-sport-station-meudon-meudon",
  "es-massy",
  "tennis-du-golf-de-la-boulie-versailles",
  "padel-versaille-versailles",
];

// ===============================
// ROUTE SCRAPE
// ===============================

app.post('/scrape', async (req, res) => {

  const clientKey = req.headers['x-api-key'];

  if (!clientKey || clientKey !== API_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const CENTER_ID_RAW = req.body.club;
console.log("RAW CLUB VALUE:", JSON.stringify(CENTER_ID_RAW));

const CENTER_ID = (CENTER_ID_RAW || "")
  .replace(/^=/, "")   // supprime = au début
  .trim()
  .toLowerCase();

console.log("CLEANED CENTER_ID:", JSON.stringify(CENTER_ID));

  console.log("CENTER_ID RECEIVED:", CENTER_ID);

  if (!CENTER_ID) {
    return res.status(400).json({
      ok: false,
      error: "Missing club parameter"
    });
  }

  if (!ALLOWED_CENTERS.includes(CENTER_ID)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid club"
    });
  }

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

      const url =
        `https://api-booking.anybuddyapp.com/v2/centers/${CENTER_ID}/availabilities?date.from=${from}&date.to=${to}T00:00&activities=padel&partySize=0`;

      console.log("Calling API:", url);

      const response = await axios.get(url);

      if (!response.data?.data) continue;

      for (const slot of response.data.data) {

        const dateTime = slot.startDateTime;
        const date = dateTime.split('T')[0];
        const time = dateTime.split('T')[1];

        for (const service of slot.services) {

          const priceTotalCents =
            service.priceComplete ??
            service.discountPrice ??
            service.price ??
            0;

          results.push({
            date,
            time,
            totalCapacity: service.totalCapacity ?? null,
            availablePlaces: service.availablePlaces ?? null,
            priceTotal: priceTotalCents / 100,
            pricePerPlayer: service.price ? service.price / 100 : null
          });
        }
      }
    }

    return res.json({
      ok: true,
      center: CENTER_ID,
      fetchedAt: new Date().toISOString(),
      slots: results
    });

  } catch (err) {

    console.error("ANYBUDDY ERROR FULL:", err.response?.data || err.message);

    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message
    });
  }
});

// ===============================
// SERVER
// ===============================

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scraper running on port ${PORT}`);
});