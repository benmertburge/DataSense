import { storage } from "../storage";
import { db } from "../db";
import { stopAreas } from "@shared/schema";
import { eq, ilike, sql } from "drizzle-orm";
import type { Itinerary, Departure, Line, StopArea, Leg, TransitLeg, WalkLeg } from "@shared/schema";

// SL API integration
interface SLSite {
  id: number;
  name: string;
  lat: number;
  lon: number;
  stop_areas?: number[];
}

interface SLDeparture {
  direction: string;
  destination: string;
  state: string;
  scheduled: string;
  expected: string;
  display: string;
  line: {
    id: number;
    designation: string;
    transport_mode: string;
  };
  stop_area: {
    id: number;
    name: string;
    type: string;
  };
}

export class TransitService {
  private readonly RESROBOT_API = "https://api.resrobot.se/v2.1";
  private readonly SL_TRANSPORT_API = "https://transport.integration.sl.se/v1";
  private cachedSites: StopArea[] = [];
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private isInitialized: boolean = false;

  private mockLines: Line[] = [
    { id: "L1", number: "10", mode: "METRO", name: "T10 Kungsträdgården-Hjulsta", operatorId: "SL" },
    { id: "L2", number: "11", mode: "METRO", name: "T11 Kungsträdgården-Akalla", operatorId: "SL" },
    { id: "L3", number: "13", mode: "METRO", name: "T13 Norsborg-Ropsten", operatorId: "SL" },
    { id: "L4", number: "14", mode: "METRO", name: "T14 Fruängen-Mörby centrum", operatorId: "SL" },
    { id: "L5", number: "17", mode: "METRO", name: "T17 Åkeshov-Skarpnäck", operatorId: "SL" },
    { id: "L6", number: "18", mode: "METRO", name: "T18 Alvik-Farsta strand", operatorId: "SL" },
    { id: "L7", number: "19", mode: "METRO", name: "T19 Hässelby strand-Hagsätra", operatorId: "SL" },
    { id: "L8", number: "J35", mode: "TRAIN", name: "Commuter train towards Södertälje", operatorId: "SL" },
    { id: "L9", number: "J36", mode: "TRAIN", name: "Commuter train towards Nynäshamn", operatorId: "SL" },
    { id: "L10", number: "J38", mode: "TRAIN", name: "Commuter train towards Bålsta", operatorId: "SL" },
    { id: "L11", number: "AE", mode: "TRAIN", name: "Arlanda Express", operatorId: "AE" },
    { id: "L12", number: "43", mode: "BUS", name: "Bus 43", operatorId: "SL" },
    { id: "L13", number: "583", mode: "BUS", name: "Airport Bus 583", operatorId: "SL" },
  ];

  private async fetchSLSites(): Promise<StopArea[]> {
    try {
      console.log("Fetching real SL station data...");
      const response = await fetch(`${this.SL_TRANSPORT_API}/sites`);
      
      if (!response.ok) {
        console.error("SL API failed, using fallback data");
        return this.getFallbackStations();
      }

      const sites: SLSite[] = await response.json();
      
      return sites.slice(0, 500).map(site => ({ // Limit to first 500 stations
        id: site.id.toString(),
        name: site.name,
        lat: site.lat.toString(),
        lon: site.lon.toString(),
        type: this.determineStationType(site.name)
      }));
    } catch (error) {
      console.error("Error fetching SL sites:", error);
      return this.getFallbackStations();
    }
  }

  private getFallbackStations(): StopArea[] {
    return [
      // Central Stockholm Metro stations
      { id: "9001", name: "Odenplan", lat: "59.3428", lon: "18.0484", type: "METROSTN" },
      { id: "9003", name: "Kungsträdgården", lat: "59.3312", lon: "18.0745", type: "METROSTN" },
      { id: "9004", name: "T-Centralen", lat: "59.3312", lon: "18.0592", type: "METROSTN" },
      { id: "9117", name: "Slussen", lat: "59.3199", lon: "18.0717", type: "METROSTN" },
      { id: "9170", name: "Gamla stan", lat: "59.3238", lon: "18.0686", type: "METROSTN" },
      { id: "1031", name: "Sergels torg", lat: "59.3326", lon: "18.0634", type: "METROSTN" },
      { id: "9118", name: "Östermalmstorg", lat: "59.3341", lon: "18.0759", type: "METROSTN" },
      { id: "9119", name: "Hötorget", lat: "59.3345", lon: "18.0637", type: "METROSTN" },
      { id: "9120", name: "Rådmansgatan", lat: "59.3378", lon: "18.0565", type: "METROSTN" },
      { id: "9121", name: "St Eriksplan", lat: "59.3389", lon: "18.0343", type: "METROSTN" },
      
      // Blue Line Metro stations
      { id: "9192", name: "Sundbyberg", lat: "59.3616", lon: "17.9706", type: "METROSTN" },
      { id: "9193", name: "Solna centrum", lat: "59.3603", lon: "18.0006", type: "METROSTN" },
      { id: "9194", name: "Västra skogen", lat: "59.3506", lon: "18.0156", type: "METROSTN" },
      { id: "9195", name: "Karlberg", lat: "59.3414", lon: "18.0342", type: "METROSTN" },
      { id: "9196", name: "Hjulsta", lat: "59.4133", lon: "17.9078", type: "METROSTN" },
      { id: "9197", name: "Akalla", lat: "59.4105", lon: "17.9132", type: "METROSTN" },
      
      // Red Line Metro stations
      { id: "9198", name: "Ropsten", lat: "59.3575", lon: "18.1036", type: "METROSTN" },
      { id: "9199", name: "Tekniska högskolan", lat: "59.3447", lon: "18.0722", type: "METROSTN" },
      { id: "9200A", name: "Universitetet", lat: "59.3644", lon: "18.0547", type: "METROSTN" },
      { id: "9201A", name: "Bergshamra", lat: "59.3844", lon: "18.0394", type: "METROSTN" },
      { id: "9202A", name: "Norsborg", lat: "59.2433", lon: "17.8294", type: "METROSTN" },
      { id: "9203A", name: "Fruängen", lat: "59.2597", lon: "17.9044", type: "METROSTN" },
      
      // Green Line Metro stations 
      { id: "9204", name: "Farsta strand", lat: "59.2358", lon: "18.0936", type: "METROSTN" },
      { id: "9205", name: "Skarpnäck", lat: "59.2644", lon: "18.1333", type: "METROSTN" },
      { id: "9206", name: "Alvik", lat: "59.3336", lon: "17.9886", type: "METROSTN" },
      { id: "9207", name: "Hässelby strand", lat: "59.3744", lon: "17.8336", type: "METROSTN" },
      { id: "9208", name: "Hagsätra", lat: "59.2714", lon: "18.1231", type: "METROSTN" },
      { id: "9209", name: "Åkeshov", lat: "59.3575", lon: "17.9239", type: "METROSTN" },
      
      // Railway stations (Pendeltåg/Commuter trains)
      { id: "9005", name: "Stockholm Central", lat: "59.3303", lon: "18.0591", type: "RAILWSTN" },
      { id: "9180", name: "Flemingsberg", lat: "59.2175", lon: "17.9447", type: "RAILWSTN" },
      { id: "9200", name: "Tumba", lat: "59.1994", lon: "17.8344", type: "RAILWSTN" },
      { id: "9201", name: "Huddinge", lat: "59.2364", lon: "17.9856", type: "RAILWSTN" },
      { id: "9202", name: "Älvsjö", lat: "59.2472", lon: "17.9614", type: "RAILWSTN" },
      { id: "9203", name: "Årstaberg", lat: "59.2797", lon: "18.0447", type: "RAILWSTN" },
      { id: "9002", name: "Arlanda Airport", lat: "59.6519", lon: "17.9186", type: "RAILWSTN" },
      { id: "9210", name: "Södertälje Syd", lat: "59.1722", lon: "17.6503", type: "RAILWSTN" },
      { id: "9211", name: "Gnesta", lat: "59.0472", lon: "17.3058", type: "RAILWSTN" },
      { id: "9212", name: "Märsta", lat: "59.6186", lon: "17.8572", type: "RAILWSTN" },
      { id: "9213", name: "Uppsala", lat: "59.8586", lon: "17.6389", type: "RAILWSTN" },
      { id: "9214", name: "Nässjö", lat: "59.6561", lon: "17.8961", type: "RAILWSTN" },
      { id: "9215", name: "Bro", lat: "59.5300", lon: "17.6744", type: "RAILWSTN" },
      { id: "9216", name: "Kungsängen", lat: "59.4775", lon: "17.7372", type: "RAILWSTN" },
      { id: "9217", name: "Bålsta", lat: "59.5611", lon: "17.5333", type: "RAILWSTN" },
      
      // Additional suburban areas
      { id: "9218", name: "Sollentuna", lat: "59.4281", lon: "17.9506", type: "RAILWSTN" },
      { id: "9219", name: "Upplands Väsby", lat: "59.5186", lon: "17.9133", type: "RAILWSTN" },
      { id: "9220", name: "Rotebro", lat: "59.4989", lon: "17.9094", type: "RAILWSTN" },
      { id: "9221", name: "Norrtälje", lat: "59.7578", lon: "18.7042", type: "BUSTERM" },
      
      // Bus terminals
      { id: "1080", name: "Cityterminalen", lat: "59.3317", lon: "18.0576", type: "BUSTERM" },
      { id: "1029", name: "Frihamnen", lat: "59.3469", lon: "18.1089", type: "BUSTERM" },
      { id: "1081", name: "Gullmarsplan", lat: "59.2989", lon: "18.0831", type: "BUSTERM" },
    ];
  }

  private determineStationType(name: string): "METROSTN" | "RAILWSTN" | "BUSTERM" {
    const nameLower = name.toLowerCase();
    
    // Train stations (commuter train/pendeltåg stations)
    if (nameLower.includes('station') && !nameLower.includes('t-bana') ||
        nameLower.includes('central') || 
        nameLower.includes('pendel') || 
        nameLower.includes('commuter') ||
        nameLower.includes('c ') || // Stockholm C
        nameLower.includes('city') ||
        nameLower.includes('järnväg') ||
        nameLower.includes('rail')) {
      return "RAILWSTN";
    }
    
    // Metro stations (T-bana)
    if (nameLower.includes('t-bana') || nameLower.includes('metro') ||
        nameLower.includes('tunnelbana')) {
      return "METROSTN";  
    }
    
    // Bus terminals
    if (nameLower.includes('terminal') || nameLower.includes('busstation') ||
        nameLower.includes('busstop')) {
      return "BUSTERM";
    }
    
    // Default to metro for Stockholm city stations
    return "METROSTN";
  }

  private async initializeDatabase(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if we have stations in database
      const count = await db.$count(stopAreas);
      console.log(`Found ${count} stations in database`);

      if (count < 5000) { // If we have fewer than 5000 stations, sync from SL API
        console.log("Syncing stations from SL API to database...");
        await this.syncStationsToDatabase();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("Error initializing database:", error);
      this.isInitialized = true; // Mark as initialized to avoid infinite loops
    }
  }

  private async syncStationsToDatabase(): Promise<void> {
    try {
      // Use SL Transport API for comprehensive Stockholm data (6000+ stations)
      console.log("Using SL Transport API for comprehensive Stockholm station data...");
      await this.syncFromSLTransport();
    } catch (error) {
      console.error("Error syncing stations:", error);
      // Insert fallback stations as a last resort
      await this.insertFallbackStations();
    }
  }

  private async syncFromTrafiklab(): Promise<void> {
    console.log("Loading comprehensive Swedish transport data from ResRobot 2.1...");
    
    const allStations = new Map<string, any>();
    
    // Method 1: Use ResRobot to get comprehensive Swedish transport data
    try {
      // Search for major Swedish cities/regions to get comprehensive coverage
      const searchTerms = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 'Västerås', 'Norrköping', 'Helsingborg', 'Jönköping'];
      
      for (const term of searchTerms) {
        try {
          const response = await fetch(`${this.RESROBOT_API}/location.name?input=${encodeURIComponent(term)}?&format=json&maxNo=1000&type=S&accessId=${process.env.TRAFIKLAB_API_KEY}`);
          if (response.ok) {
            const data = await response.json();
            const stops = data.StopLocation || [];
            stops.forEach((stop: any) => {
              if (stop.id && stop.name) {
                allStations.set(stop.id, {
                  id: stop.id,
                  name: stop.name,
                  lat: stop.lat,
                  lon: stop.lon,
                  weight: stop.weight || 0
                });
              }
            });
          }
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          console.log(`ResRobot search for "${term}" failed, continuing...`);
        }
      }
      
      console.log(`ResRobot API: Found ${allStations.size} unique stations from searches`);
    } catch (e) {
      console.log("ResRobot API failed, continuing...");
    }

    // Method 2: Supplement with SL Transport API for Stockholm area details
    try {
      console.log("Supplementing with SL Transport API for Stockholm details...");
      const response2 = await fetch(`${this.SL_TRANSPORT_API}/sites`);
      if (response2.ok) {
        const sites: SLSite[] = await response2.json();
        sites.forEach((site: SLSite) => {
          if (site.id && site.name) {
            allStations.set(`sl_${site.id}`, {
              id: `sl_${site.id}`,
              name: site.name,
              lat: site.lat,
              lon: site.lon,
              weight: 1000 // Give SL stations good weight
            });
          }
        });
        console.log(`SL Transport API: Added ${sites.length} Stockholm area stations`);
      }
    } catch (e) {
      console.log("SL Transport API failed, continuing...");
    }

    const totalStations = Array.from(allStations.values());
    console.log(`Total unique stations found: ${totalStations.length}`);

    if (totalStations.length === 0) {
      throw new Error("No stations found from any API");
    }

    // Insert all stations in batches
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < totalStations.length; i += batchSize) {
      const batch = totalStations.slice(i, i + batchSize);
      const stationData = batch
        .filter((site: any) => site.id && site.name && site.lat && site.lon)
        .map((site: any) => ({
          id: site.id.toString(),
          name: site.name,
          lat: site.lat.toString(),
          lon: site.lon.toString(),
          type: this.determineStationType(site.name)
        }));

      if (stationData.length > 0) {
        await db.insert(stopAreas).values(stationData).onConflictDoUpdate({
          target: stopAreas.id,
          set: {
            name: sql`excluded.name`,
            lat: sql`excluded.lat`,
            lon: sql`excluded.lon`,
            type: sql`excluded.type`,
          },
        });
        insertedCount += stationData.length;
      }
    }

    console.log(`Successfully synced ${insertedCount} stations from ResRobot + SL to database`);
  }

  private async syncFromSLTransport(): Promise<void> {
    const response = await fetch(`${this.SL_TRANSPORT_API}/sites`);
    if (!response.ok) {
      throw new Error(`SL Transport API failed: ${response.status}`);
    }

    const sites: SLSite[] = await response.json();
    console.log(`Fetched ${sites.length} stations from SL Transport API`);

    const batchSize = 100;
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize);
      const stationData = batch
        .filter(site => site.id && site.name && site.lat && site.lon)
        .map(site => ({
          id: site.id.toString(),
          name: site.name,
          lat: site.lat.toString(),
          lon: site.lon.toString(),
          type: this.determineStationType(site.name)
        }));

      if (stationData.length > 0) {
        await db.insert(stopAreas).values(stationData).onConflictDoUpdate({
          target: stopAreas.id,
          set: {
            name: sql`excluded.name`,
            lat: sql`excluded.lat`,
            lon: sql`excluded.lon`,
            type: sql`excluded.type`,
          },
        });
      }
    }

    console.log(`Successfully synced ${sites.length} stations from SL Transport API`);
  }

  private async insertFallbackStations(): Promise<void> {
    console.log("Inserting fallback stations...");
    const fallbackStations = this.getFallbackStations();
    await db.insert(stopAreas).values(fallbackStations).onConflictDoNothing();
    console.log(`Inserted ${fallbackStations.length} fallback stations`);
  }

  async searchSites(query: string): Promise<StopArea[]> {
    await this.initializeDatabase();
    
    try {
      const results = await db
        .select()
        .from(stopAreas)
        .where(ilike(stopAreas.name, `%${query}%`))
        .limit(10);
      
      console.log(`Found ${results.length} stations matching "${query}"`);
      return results;
    } catch (error) {
      console.error("Error searching stations:", error);
      return this.getFallbackStations().filter(station => 
        station.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
    }
  }

  async searchRoutes(from: string, to: string, via?: string, dateTime?: Date): Promise<{
    best: Itinerary;
    alternatives: Itinerary[];
  }> {
    await this.initializeDatabase();
    
    // Find stop areas from database - try multiple approaches
    let fromArea = await db
      .select()
      .from(stopAreas)
      .where(ilike(stopAreas.name, `%${from}%`))
      .limit(1)
      .then(res => res[0]);
      
    let toArea = await db
      .select()
      .from(stopAreas)
      .where(ilike(stopAreas.name, `%${to}%`))
      .limit(1)
      .then(res => res[0]);

    // If exact search fails, try fallback stations
    if (!fromArea) {
      const fallbackFrom = this.getFallbackStations().find(station => 
        station.name.toLowerCase().includes(from.toLowerCase())
      );
      if (fallbackFrom) {
        await db.insert(stopAreas).values(fallbackFrom).onConflictDoNothing();
        fromArea = fallbackFrom;
      }
    }
    
    if (!toArea) {
      const fallbackTo = this.getFallbackStations().find(station => 
        station.name.toLowerCase().includes(to.toLowerCase())
      );
      if (fallbackTo) {
        await db.insert(stopAreas).values(fallbackTo).onConflictDoNothing();
        toArea = fallbackTo;
      }
    }

    if (!fromArea || !toArea) {
      console.error(`Route search failed - from: "${from}" (${fromArea ? 'found' : 'not found'}), to: "${to}" (${toArea ? 'found' : 'not found'})`);
      throw new Error("Stop areas not found");
    }

    console.log(`Route planning: ${fromArea.name} → ${toArea.name}`);

    const baseTime = dateTime || new Date();
    
    // Generate main itinerary
    const best = this.generateItinerary(fromArea, toArea, baseTime, "main");
    
    // Generate alternatives
    const alternatives = [
      this.generateItinerary(fromArea, toArea, new Date(baseTime.getTime() + 5 * 60000), "fast"),
      this.generateItinerary(fromArea, toArea, new Date(baseTime.getTime() + 10 * 60000), "direct"),
    ];

    return { best, alternatives };
  }

  private generateItinerary(from: StopArea, to: StopArea, baseTime: Date, type: "main" | "fast" | "direct"): Itinerary {
    const legs: Leg[] = [];
    let currentTime = new Date(baseTime);

    // Determine the best route based on actual stations
    const route = this.planBestRoute(from, to);
    let timeOffset = type === "fast" ? 5 : type === "direct" ? 10 : 0; // Offset for different route types
    
    if (route.direct) {
      // Direct route (same line or walking distance)
      const transitLeg: TransitLeg = {
        kind: "TRANSIT",
        line: route.line!,
        journeyId: `J_${Date.now()}_${route.line!.number}`,
        directionText: to.name,
        from: { areaId: from.id, name: from.name, platform: this.getPlatform(from, route.line!) },
        to: { areaId: to.id, name: to.name, platform: this.getPlatform(to, route.line!) },
        plannedDeparture: new Date(currentTime.getTime() + timeOffset * 60000).toISOString(),
        plannedArrival: new Date(currentTime.getTime() + (route.travelTime + timeOffset) * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + (timeOffset + route.delay) * 60000).toISOString(),
        expectedArrival: new Date(currentTime.getTime() + (route.travelTime + timeOffset + route.delay) * 60000).toISOString(),
      };
      legs.push(transitLeg);
    } else if (route.viaHub) {
      // Multi-leg journey via T-Centralen or another hub
      // First leg
      const firstLeg: TransitLeg = {
        kind: "TRANSIT",
        line: route.firstLine!,
        journeyId: `J_${Date.now()}_${route.firstLine!.number}`,
        directionText: route.viaHub,
        from: { areaId: from.id, name: from.name, platform: this.getPlatform(from, route.firstLine!) },
        to: { areaId: route.hubId!, name: route.viaHub, platform: this.getPlatform({ id: route.hubId! } as StopArea, route.firstLine!) },
        plannedDeparture: new Date(currentTime.getTime() + timeOffset * 60000).toISOString(),
        plannedArrival: new Date(currentTime.getTime() + ((route.firstLegTime || 20) + timeOffset) * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + (timeOffset + route.delay) * 60000).toISOString(),
        expectedArrival: new Date(currentTime.getTime() + ((route.firstLegTime || 20) + timeOffset + route.delay) * 60000).toISOString(),
        platformChange: type === "main",
      };
      legs.push(firstLeg);

      // Transfer walk if needed
      if (route.transferWalk > 0) {
        const walkLeg: WalkLeg = {
          kind: "WALK",
          fromAreaId: route.hubId!,
          toAreaId: route.hubId!,
          durationMinutes: route.transferWalk,
          meters: route.transferWalk * 80, // ~80m per minute walking
        };
        legs.push(walkLeg);
      }

      // Second leg
      currentTime = new Date(currentTime.getTime() + ((route.firstLegTime || 20) + route.transferWalk + timeOffset + route.delay) * 60000);
      const secondLeg: TransitLeg = {
        kind: "TRANSIT",
        line: route.secondLine!,
        journeyId: `J_${Date.now()}_${route.secondLine!.number}`,
        directionText: to.name,
        from: { areaId: route.hubId!, name: route.viaHub!, platform: this.getPlatform({ id: route.hubId! } as StopArea, route.secondLine!) },
        to: { areaId: to.id, name: to.name, platform: this.getPlatform(to, route.secondLine!) },
        plannedDeparture: new Date(currentTime.getTime() + 2 * 60000).toISOString(), // 2 min connection time
        plannedArrival: new Date(currentTime.getTime() + ((route.secondLegTime || 25) + 2) * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + 2 * 60000).toISOString(), // On time for second leg
        expectedArrival: new Date(currentTime.getTime() + ((route.secondLegTime || 25) + 2) * 60000).toISOString(),
      };
      legs.push(secondLeg);
    }

    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];
    
    const plannedDeparture = firstLeg.kind === "TRANSIT" ? firstLeg.plannedDeparture : baseTime.toISOString();
    const plannedArrival = lastLeg.kind === "TRANSIT" ? 
      lastLeg.plannedArrival : 
      new Date(baseTime.getTime() + 42 * 60000).toISOString();

    const expectedDeparture = firstLeg.kind === "TRANSIT" && firstLeg.expectedDeparture ? 
      firstLeg.expectedDeparture : plannedDeparture;
    const expectedArrival = lastLeg.kind === "TRANSIT" && lastLeg.expectedArrival ? 
      lastLeg.expectedArrival : plannedArrival;

    const delayMinutes = Math.round((new Date(expectedArrival).getTime() - new Date(plannedArrival).getTime()) / 60000);

    return {
      id: `IT_${Date.now()}_${type}`,
      legs,
      plannedDeparture,
      plannedArrival,
      expectedDeparture,
      expectedArrival,
      delayMinutes,
    };
  }

  async searchRoutesWithResRobot(from: string, to: string, dateTime: Date, searchType: 'departure' | 'arrival'): Promise<{
    best: Itinerary;
    alternatives: Itinerary[];
  }> {
    try {
      // First, find the station IDs
      const [fromSites, toSites] = await Promise.all([
        this.searchSites(from),
        this.searchSites(to)
      ]);

      if (fromSites.length === 0 || toSites.length === 0) {
        throw new Error("Could not find stations");
      }

      const fromStation = fromSites[0];
      const toStation = toSites[0];

      // Format for ResRobot API
      const date = dateTime.toISOString().slice(0, 10);
      const time = dateTime.toTimeString().slice(0, 5);
      const isArrival = searchType === 'arrival' ? '1' : '0';
      
      const url = `${this.RESROBOT_API}/trip?originId=${fromStation.id}&destId=${toStation.id}&date=${date}&time=${time}&searchForArrival=${isArrival}&format=json&accessId=${process.env.RESROBOT_API_KEY}&numF=3&numB=0`;
      
      console.log(`ResRobot trip search: ${from} (${fromStation.id}) → ${to} (${toStation.id}), ${searchType} at ${time}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ResRobot API error:", errorText);
        throw new Error(`ResRobot API failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.Error) {
        throw new Error(`ResRobot error: ${data.Error.errorText || 'API error'}`);
      }

      const trips = data.Trip || [];
      if (trips.length === 0) {
        throw new Error("No trips found");
      }

      // Convert ResRobot trips to our Itinerary format
      const convertedTrips = trips.slice(0, 3).map((trip: any, index: number) => 
        this.convertResRobotToItinerary(trip, fromStation, toStation, index === 0 ? 'main' : `alt_${index}`)
      );

      return {
        best: convertedTrips[0],
        alternatives: convertedTrips.slice(1)
      };

    } catch (error) {
      console.log("ResRobot failed, falling back to local search:", error);
      return this.searchRoutes(from, to, undefined, dateTime);
    }
  }

  private convertResRobotToItinerary(trip: any, fromStation: StopArea, toStation: StopArea, type: string): Itinerary {
    const legs: Leg[] = [];
    const legList = trip.LegList?.Leg || [];

    for (const leg of legList) {
      if (leg.type === 'WALK') {
        const walkLeg: WalkLeg = {
          kind: "WALK",
          fromAreaId: leg.Origin?.id || fromStation.id,
          toAreaId: leg.Destination?.id || toStation.id,
          durationMinutes: Math.ceil((leg.duration || "PT5M").replace('PT', '').replace('M', '') / 1) || 5,
          meters: leg.dist || 400,
        };
        legs.push(walkLeg);
      } else {
        // Transit leg
        const line = this.convertResRobotLine(leg);
        const transitLeg: TransitLeg = {
          kind: "TRANSIT",
          line,
          journeyId: leg.JourneyDetailRef?.ref || `J_${Date.now()}`,
          directionText: leg.direction || toStation.name,
          from: {
            areaId: leg.Origin?.id || fromStation.id,
            name: leg.Origin?.name || fromStation.name,
            platform: leg.Origin?.track || "1"
          },
          to: {
            areaId: leg.Destination?.id || toStation.id,
            name: leg.Destination?.name || toStation.name,
            platform: leg.Destination?.track || "1"
          },
          plannedDeparture: leg.Origin?.date + 'T' + leg.Origin?.time,
          plannedArrival: leg.Destination?.date + 'T' + leg.Destination?.time,
          expectedDeparture: leg.Origin?.rtDate && leg.Origin?.rtTime ? 
            leg.Origin.rtDate + 'T' + leg.Origin.rtTime : 
            leg.Origin?.date + 'T' + leg.Origin?.time,
          expectedArrival: leg.Destination?.rtDate && leg.Destination?.rtTime ? 
            leg.Destination.rtDate + 'T' + leg.Destination.rtTime : 
            leg.Destination?.date + 'T' + leg.Destination?.time,
        };
        legs.push(transitLeg);
      }
    }

    const plannedDeparture = trip.Origin?.date + 'T' + trip.Origin?.time;
    const plannedArrival = trip.Destination?.date + 'T' + trip.Destination?.time;
    const expectedDeparture = trip.Origin?.rtDate && trip.Origin?.rtTime ? 
      trip.Origin.rtDate + 'T' + trip.Origin.rtTime : plannedDeparture;
    const expectedArrival = trip.Destination?.rtDate && trip.Destination?.rtTime ? 
      trip.Destination.rtDate + 'T' + trip.Destination.rtTime : plannedArrival;

    const delayMinutes = Math.round(
      (new Date(expectedArrival).getTime() - new Date(plannedArrival).getTime()) / 60000
    );

    return {
      id: `IT_${Date.now()}_${type}`,
      legs,
      plannedDeparture,
      plannedArrival,
      expectedDeparture,
      expectedArrival,
      delayMinutes,
    };
  }

  private convertResRobotLine(leg: any): Line {
    const transportMode = leg.Product?.catIn || 'UNKNOWN';
    const lineNumber = leg.Product?.line || leg.Product?.num || 'Unknown';
    const lineName = leg.Product?.name || `${transportMode} ${lineNumber}`;
    
    let mode: "METRO" | "BUS" | "TRAIN" | "TRAM" | "FERRY" = "BUS";
    
    if (transportMode.includes('METRO') || lineName.includes('T-bana') || lineName.startsWith('T')) {
      mode = "METRO";
    } else if (transportMode.includes('TRAIN') || lineName.includes('pendel') || lineName.startsWith('J')) {
      mode = "TRAIN";
    } else if (transportMode.includes('TRAM') || lineName.includes('spårvagn')) {
      mode = "TRAM";
    } else if (transportMode.includes('FERRY') || lineName.includes('båt')) {
      mode = "FERRY";
    }

    return {
      id: `L_${lineNumber}`,
      number: lineNumber,
      mode,
      name: lineName,
      operatorId: "SL"
    };
  }

  private planBestRoute(from: StopArea, to: StopArea): {
    direct: boolean;
    viaHub?: string;
    hubId?: string;
    line?: Line;
    firstLine?: Line;
    secondLine?: Line;
    travelTime: number;
    firstLegTime?: number;
    secondLegTime?: number;
    transferWalk: number;
    delay: number;
  } {
    console.log(`Planning route: ${from.name} → ${to.name}`);
    
    // Check for direct single-line metro connections first
    const directLine = this.getDirectMetroConnection(from.name, to.name);
    if (directLine) {
      console.log(`Found direct metro connection: ${directLine.name}`);
      return {
        direct: true,
        line: directLine,
        travelTime: this.estimateMetroTime(from.name, to.name),
        transferWalk: 0,
        delay: Math.floor(Math.random() * 3), // 0-3 min delay
      };
    }
    
    // Check for commuter train connections
    if (this.isCommuterTrainRoute(from.name, to.name)) {
      const trainLine = this.mockLines.find(l => l.mode === "TRAIN" && l.number.startsWith("J"));
      if (trainLine) {
        console.log(`Found direct commuter train connection: ${trainLine.name}`);
        return {
          direct: true,
          line: trainLine,
          travelTime: this.estimateTrainTime(from.name, to.name),
          transferWalk: 0,
          delay: Math.floor(Math.random() * 5), // 0-5 min delay
        };
      }
    }

    // Multi-leg journey only if absolutely necessary
    console.log(`Multi-leg journey required: ${from.name} → ${to.name}`);
    return {
      direct: false,
      viaHub: "T-Centralen", 
      hubId: "9004",
      firstLine: this.getBestFirstLine(from.name),
      secondLine: this.getBestSecondLine(to.name),
      travelTime: 45,
      firstLegTime: 20,
      secondLegTime: 20,
      transferWalk: 5,
      delay: Math.floor(Math.random() * 8), // 0-8 min delay
    };
  }

  private getDirectMetroConnection(fromName: string, toName: string): Line | null {
    // Real Stockholm T-bana direct connections (single line journeys)
    const greenLineStations = [
      'sundbyberg centrum', 'rissne', 'tensta', 'hjulsta', 'västra skogen',
      'alvik', 'fridhemsplan', 'sankt eriksplan', 'odenplan', 'rådmansgatan',
      't-centralen', 'gamla stan', 'slussen', 'medborgarplatsen', 'skanstull'
    ];
    
    const blueLineStations = [
      'kungsträdgården', 'östermalmstorg', 't-centralen', 'rådhuset',
      'fridhemsplan', 'stadshagen', 'västra skogen', 'solna centrum', 'akalla'
    ];
    
    const redLineStations = [
      'norsborg', 'hallunda', 'alby', 'fittja', 'masmo', 't-centralen',
      'östermalmstorg', 'universitetet', 'ropsten'
    ];
    
    const fromLower = fromName.toLowerCase();
    const toLower = toName.toLowerCase();
    
    // Check if both stations are on the same line
    if (this.bothOnSameLine(fromLower, toLower, greenLineStations)) {
      return this.mockLines.find(l => l.number === "T17") || null; // Green line
    }
    if (this.bothOnSameLine(fromLower, toLower, blueLineStations)) {
      return this.mockLines.find(l => l.number === "T10") || null; // Blue line
    }
    if (this.bothOnSameLine(fromLower, toLower, redLineStations)) {
      return this.mockLines.find(l => l.number === "T13") || null; // Red line
    }
    
    return null;
  }

  private bothOnSameLine(from: string, to: string, stations: string[]): boolean {
    const fromMatch = stations.some(station => from.includes(station) || station.includes(from.split(' ')[0]));
    const toMatch = stations.some(station => to.includes(station) || station.includes(to.split(' ')[0]));
    return fromMatch && toMatch;
  }

  private isCommuterTrainRoute(fromName: string, toName: string): boolean {
    const commuterStations = [
      'sundbyberg station', 'solna station', 'stockholm city', 'stockholm c',
      'södermalm', 'flemingsberg', 'huddinge', 'tumba', 'södertälje'
    ];
    
    const fromLower = fromName.toLowerCase();
    const toLower = toName.toLowerCase();
    
    return commuterStations.some(station => fromLower.includes(station)) &&
           commuterStations.some(station => toLower.includes(station));
  }

  private estimateMetroTime(from: string, to: string): number {
    // Rough estimates for metro journey times in Stockholm
    return 15 + Math.floor(Math.random() * 20); // 15-35 minutes
  }

  private estimateTrainTime(from: string, to: string): number {
    // Commuter train times are generally longer
    return 25 + Math.floor(Math.random() * 25); // 25-50 minutes
  }

  private getBestFirstLine(fromName: string): Line {
    if (fromName.toLowerCase().includes('sundbyberg centrum')) {
      return this.mockLines.find(l => l.number === "T17")!; // Green line from Sundbyberg centrum
    }
    return this.mockLines.find(l => l.mode === "METRO")!; // Default metro
  }

  private getBestSecondLine(toName: string): Line {
    if (toName.toLowerCase().includes('flemingsberg')) {
      return this.mockLines.find(l => l.mode === "TRAIN")!; // Commuter train to Flemingsberg
    }
    return this.mockLines.find(l => l.mode === "METRO")!; // Default metro
  }

  private getPlatform(station: StopArea, line: Line): string {
    if (line.mode === "METRO") {
      return ["1", "2", "3", "4"][Math.floor(Math.random() * 4)];
    } else if (line.mode === "TRAIN") {
      return ["A", "B", "C", "1", "2"][Math.floor(Math.random() * 5)];
    }
    return ["A", "B", "C"][Math.floor(Math.random() * 3)];
  }

  async getDepartures(areaId: string): Promise<Departure[]> {
    const departures: Departure[] = [];
    const now = new Date();

    // Generate mock departures for the next hour
    for (let i = 0; i < 6; i++) {
      const departureTime = new Date(now.getTime() + i * 10 * 60000); // Every 10 minutes
      const expectedTime = new Date(departureTime.getTime() + (Math.random() < 0.3 ? Math.floor(Math.random() * 10) * 60000 : 0));
      
      departures.push({
        stopAreaId: areaId,
        line: this.mockLines[Math.floor(Math.random() * this.mockLines.length)],
        journeyId: `J_${Date.now()}_${i}`,
        directionText: ["Arlanda Airport", "Kungsträdgården", "Nynäshamn", "Bålsta"][Math.floor(Math.random() * 4)],
        plannedTime: departureTime.toISOString(),
        expectedTime: expectedTime.toISOString(),
        state: expectedTime > departureTime ? "EXPECTED" : "NORMALPROGRESS",
        platform: ["1", "2", "3", "A", "B", "C"][Math.floor(Math.random() * 6)],
      });
    }

    return departures.sort((a, b) => new Date(a.plannedTime).getTime() - new Date(b.plannedTime).getTime());
  }

  async searchStopAreas(query: string): Promise<StopArea[]> {
    if (!query.trim()) return [];
    return this.searchSites(query);
  }

  async updateJourneyRealtime(journeyId: string): Promise<Partial<Itinerary>> {
    // Simulate real-time updates
    const delayChange = Math.floor(Math.random() * 10) - 5; // -5 to +5 minutes
    const newDelayMinutes = Math.max(0, 12 + delayChange); // Current delay + change

    return {
      delayMinutes: newDelayMinutes,
      expectedArrival: new Date(Date.now() + (42 + newDelayMinutes) * 60000).toISOString(),
    };
  }

  async getStopAreas(): Promise<StopArea[]> {
    await this.initializeDatabase();
    return await db.select().from(stopAreas).limit(100);
  }

  getLines(): Line[] {
    return this.mockLines;
  }
}

export const transitService = new TransitService();
