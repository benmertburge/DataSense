import { db } from "./db";
import { stopAreas } from "@shared/schema";
import { sql } from "drizzle-orm";

const RESROBOT_API_BASE = 'https://api.resrobot.se/v2.1';

async function loadAllStockholmStations() {
  const apiKey = process.env.RESROBOT_API_KEY;
  if (!apiKey) {
    throw new Error("RESROBOT_API_KEY required");
  }

  console.log("Loading ALL Stockholm stations from ResRobot API...");

  // Clear existing stations
  await db.delete(stopAreas);

  // Stockholm area search points - comprehensive coverage
  const searchPoints = [
    // Central Stockholm
    { lat: 59.3293, lng: 18.0686 },
    { lat: 59.3500, lng: 18.0500 },
    { lat: 59.3000, lng: 18.0800 },
    { lat: 59.3300, lng: 17.9800 },
    { lat: 59.3300, lng: 18.1500 },
    // North Stockholm
    { lat: 59.4000, lng: 18.0500 },
    { lat: 59.4500, lng: 17.9500 },
    { lat: 59.5000, lng: 17.9000 },
    // South Stockholm  
    { lat: 59.2500, lng: 18.0000 },
    { lat: 59.2000, lng: 17.9500 },
    // East/West
    { lat: 59.3500, lng: 18.2000 },
    { lat: 59.3500, lng: 17.8500 },
  ];

  const allStations = new Map<string, any>();

  for (const point of searchPoints) {
    try {
      console.log(`Scanning area: ${point.lat}, ${point.lng}`);
      
      // Use trip search to discover stations
      const params = new URLSearchParams({
        originCoordLat: point.lat.toString(),
        originCoordLong: point.lng.toString(),
        destCoordLat: (point.lat + 0.05).toString(),
        destCoordLong: (point.lng + 0.05).toString(),
        format: 'json',
        accessId: apiKey,
        numTrips: '20'
      });

      const url = `${RESROBOT_API_BASE}/trip?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`Failed response for point ${point.lat}, ${point.lng}`);
        continue;
      }
      
      const data = await response.json();
      if (data.errorCode || !data.Trip) continue;

      const trips = Array.isArray(data.Trip) ? data.Trip : [data.Trip];
      
      for (const trip of trips) {
        if (!trip.LegList?.Leg) continue;
        
        const legs = Array.isArray(trip.LegList.Leg) ? trip.LegList.Leg : [trip.LegList.Leg];
        
        for (const leg of legs) {
          // Extract all stations from legs
          const stations = [leg.Origin, leg.Destination].filter(s => s);
          
          for (const station of stations) {
            if (station?.name && station?.lat && station?.lon) {
              const lat = parseFloat(station.lat);
              const lng = parseFloat(station.lon);
              
              // Stockholm region filter
              if (lat >= 59.0 && lat <= 60.0 && lng >= 17.5 && lng <= 18.5) {
                const key = `${station.name}_${lat}_${lng}`;
                
                if (!allStations.has(key)) {
                  allStations.set(key, {
                    id: station.extId || station.id || `RR_${allStations.size}`,
                    name: station.name,
                    lat: lat.toString(),
                    lng: lng.toString()
                  });
                }
              }
            }
          }
        }
      }
      
      // Be nice to API
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error scanning point ${point.lat}, ${point.lng}:`, error);
    }
  }

  // Insert all unique stations into database
  const stationsArray = Array.from(allStations.values());
  
  if (stationsArray.length > 0) {
    await db.insert(stopAreas).values(stationsArray);
    console.log(`✅ Loaded ${stationsArray.length} real Stockholm stations into database`);
  } else {
    console.error("❌ No stations found - check API key and connection");
  }

  return stationsArray.length;
}

// Run the loader
loadAllStockholmStations()
  .then(count => {
    console.log(`Successfully loaded ${count} stations`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Failed to load stations:", error);
    process.exit(1);
  });