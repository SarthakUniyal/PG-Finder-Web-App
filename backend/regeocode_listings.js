require('dotenv').config();
const mongoose = require('mongoose');
const Listing = require('./models/Listing');

function buildQuery(...parts) {
  return parts.filter(Boolean).join(', ');
}

async function geocodeAddress({ plotNumber, street, landmark, area, city, pinCode }) {
  const queries = [
    buildQuery(plotNumber, street, landmark, area, city, pinCode, 'Uttarakhand', 'India'),
    buildQuery(plotNumber, street, area, city, pinCode, 'Uttarakhand', 'India'),
    buildQuery(street, landmark, area, city, pinCode, 'Uttarakhand', 'India'),
    buildQuery(street, area, city, pinCode, 'Uttarakhand', 'India'),
    buildQuery(area, city, pinCode, 'Uttarakhand', 'India'),
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PGFinderBackend/1.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const scored = data
        .map((item) => {
          const a = item.address || {};
          const text = `${item.display_name || ''} ${a.suburb || ''} ${a.neighbourhood || ''} ${a.city || ''} ${a.town || ''}`.toLowerCase();
          let score = Number(item.importance || 0);
          if (area && text.includes(String(area).toLowerCase())) score += 2;
          if (city && text.includes(String(city).toLowerCase())) score += 2;
          if (pinCode && text.includes(String(pinCode).toLowerCase())) score += 1;
          if (street && text.includes(String(street).toLowerCase())) score += 1;
          return { item, score };
        })
        .sort((x, y) => y.score - x.score);

      const best = scored[0]?.item;
      if (best?.lat && best?.lon) {
        return { lat: Number(best.lat), lng: Number(best.lon) };
      }
    } catch (e) {
      // try next pattern
    }
  }
  return null;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const listings = await Listing.find({}).select('title city area street plotNumber landmark pinCode lat lng');
  console.log(`Found ${listings.length} listing(s) to geocode`);

  let updated = 0;
  for (const l of listings) {
    const geo = await geocodeAddress(l);
    if (!geo) {
      console.log(`SKIP  ${l.title} -> no result`);
      continue;
    }

    const same = Number(l.lat) === Number(geo.lat) && Number(l.lng) === Number(geo.lng);
    if (!same) {
      l.lat = geo.lat;
      l.lng = geo.lng;
      await l.save();
      updated += 1;
      console.log(`UPDATE ${l.title} -> ${geo.lat}, ${geo.lng}`);
    } else {
      console.log(`OK    ${l.title} -> unchanged`);
    }

    // Nominatim courtesy delay
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(`Done. Updated ${updated} listing(s).`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

