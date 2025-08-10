import { storage } from "../storage";
import { db } from "../db";
import { stopAreas } from "@shared/schema";
import { eq, ilike, sql } from "drizzle-orm";
import type { Itinerary, Departure, Line, StopArea, Leg, TransitLeg, WalkLeg } from "@shared/schema";

export class TransitService {
  private readonly RESROBOT_API_BASE = 'https://api.resrobot.se/v2.1';
  private readonly TRAFIKLAB_REALTIME_API = 'https://realtime-api.trafiklab.se/v1';
  
  // ONLY REAL SWEDISH TRANSPORT DATA - NO MOCK DATA EVER

  async searchTrips(fromCoord: [number, number], toCoord: [number, number], dateTime?: Date): Promise<Itinerary[]> {
    try {
      console.log(`REAL TRIP SEARCH: ${fromCoord} → ${toCoord} at ${dateTime?.toISOString()}`);
      
      // Use ResRobot Trip API for real journey planning
      const trips = await this.searchRealTripsWithResRobot(fromCoord, toCoord, dateTime);
      
      if (trips.length === 0) {
        throw new Error("No real trips found - ResRobot API returned empty results");
      }
      
      // Enhance with real-time data from Trafiklab
      const enhancedTrips = await this.enhanceTripsWithRealTimeData(trips);
      
      console.log(`REAL DATA SUCCESS: ${enhancedTrips.length} trips with real Swedish transport data`);
      return enhancedTrips;
      
    } catch (error) {
      console.error("CRITICAL: Real API search failed:", error);
      throw new Error(`Real transport data unavailable: ${error}`);
    }
  }

  private async searchRealTripsWithResRobot(
    fromCoord: [number, number], 
    toCoord: [number, number], 
    dateTime?: Date
  ): Promise<Itinerary[]> {
    
    const apiKey = process.env.RESROBOT_API_KEY;
    if (!apiKey) {
      throw new Error("RESROBOT_API_KEY environment variable is required for real data");
    }

    const params = new URLSearchParams({
      originCoordLat: fromCoord[0].toString(),
      originCoordLong: fromCoord[1].toString(),
      destCoordLat: toCoord[0].toString(),
      destCoordLong: toCoord[1].toString(),
      format: 'json',
      accessId: apiKey,
      numTrips: '5',
      searchForArrival: '0'
    });

    if (dateTime) {
      const timeStr = dateTime.toISOString().slice(0, 16).replace('T', ' ');
      params.append('time', timeStr);
      params.append('date', dateTime.toISOString().slice(0, 10));
    }

    const url = `${this.RESROBOT_API_BASE}/trip?${params}`;
    console.log(`ResRobot Trip API: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ResRobot API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errorCode) {
      throw new Error(`ResRobot API error: ${data.errorCode} - ${data.errorText}`);
    }

    if (!data.Trip || !Array.isArray(data.Trip)) {
      throw new Error("ResRobot API returned no trips");
    }

    console.log(`ResRobot returned ${data.Trip.length} real trips`);
    
    return data.Trip.map((trip: any, index: number) => this.convertResRobotTripToItinerary(trip, index));
  }

  private convertResRobotTripToItinerary(resRobotTrip: any, index: number): Itinerary {
    const legs: Leg[] = [];
    
    if (!resRobotTrip.LegList?.Leg) {
      throw new Error("Invalid ResRobot trip format - no legs found");
    }

    const legArray = Array.isArray(resRobotTrip.LegList.Leg) 
      ? resRobotTrip.LegList.Leg 
      : [resRobotTrip.LegList.Leg];

    for (const leg of legArray) {
      if (leg.type === 'WALK') {
        legs.push({
          type: 'walk',
          from: {
            name: leg.Origin?.name || 'Unknown',
            coord: [parseFloat(leg.Origin?.lat || '0'), parseFloat(leg.Origin?.lon || '0')]
          },
          to: {
            name: leg.Destination?.name || 'Unknown', 
            coord: [parseFloat(leg.Destination?.lat || '0'), parseFloat(leg.Destination?.lon || '0')]
          },
          duration: this.parseDuration(leg.duration || '00:00:00'),
          distance: parseInt(leg.dist || '0')
        } as WalkLeg);
      } else {
        // Transit leg
        legs.push({
          type: 'transit',
          from: {
            name: leg.Origin?.name || 'Unknown',
            coord: [parseFloat(leg.Origin?.lat || '0'), parseFloat(leg.Origin?.lon || '0')],
            platform: leg.Origin?.track || undefined
          },
          to: {
            name: leg.Destination?.name || 'Unknown',
            coord: [parseFloat(leg.Destination?.lat || '0'), parseFloat(leg.Destination?.lon || '0')],
            platform: leg.Destination?.track || undefined
          },
          line: {
            id: `RR_${leg.Product?.num || leg.Product?.name || 'unknown'}`,
            number: leg.Product?.num || leg.Product?.name || 'Unknown',
            mode: this.mapResRobotProductToMode(leg.Product),
            name: `${this.getTransportTypeText(leg.Product)} ${leg.Product?.num || leg.Product?.name || 'Unknown'}`,
            operatorId: leg.Product?.operator || 'Unknown',
            color: this.getLineColor(leg.Product)
          },
          departureTime: leg.Origin?.rtTime || leg.Origin?.time || new Date().toISOString(),
          arrivalTime: leg.Destination?.rtTime || leg.Destination?.time || new Date().toISOString(),
          duration: this.parseDuration(leg.duration || '00:00:00'),
          direction: leg.direction || leg.Destination?.name || 'Unknown Direction'
        } as TransitLeg);
      }
    }

    return {
      id: `ResRobot_${Date.now()}_${index}`,
      legs,
      duration: this.parseDuration(resRobotTrip.duration || '00:00:00'),
      transfers: legs.filter(leg => leg.type === 'transit').length - 1,
      departure: legs[0]?.type === 'transit' 
        ? (legs[0] as TransitLeg).departureTime 
        : new Date().toISOString(),
      arrival: legs[legs.length - 1]?.type === 'transit'
        ? (legs[legs.length - 1] as TransitLeg).arrivalTime
        : new Date().toISOString(),
      co2: 0 // Calculate if needed
    };
  }

  private mapResRobotProductToMode(product: any): "METRO" | "BUS" | "TRAIN" | "TRAM" | "FERRY" {
    if (!product?.catOutS) return "BUS";
    
    const category = product.catOutS.toLowerCase();
    
    if (category.includes('tunnelbana') || category.includes('metro')) return "METRO";
    if (category.includes('pendeltåg') || category.includes('tåg') || category.includes('train')) return "TRAIN";
    if (category.includes('spårvagn') || category.includes('tram')) return "TRAM";
    if (category.includes('båt') || category.includes('ferry')) return "FERRY";
    
    return "BUS";
  }

  private getTransportTypeText(product: any): string {
    const mode = this.mapResRobotProductToMode(product);
    
    switch (mode) {
      case "METRO": return "Tunnelbana";
      case "TRAIN": return product?.catOutS?.includes('Pendeltåg') ? "Pendeltåg" : "Tåg";
      case "TRAM": return "Spårvagn"; 
      case "FERRY": return "Båt";
      case "BUS": return "Buss";
      default: return "Transport";
    }
  }

  private getLineColor(product: any): string {
    const mode = this.mapResRobotProductToMode(product);
    
    switch (mode) {
      case "METRO": return "#0089CA"; // SL Blue
      case "TRAIN": return "#9B59B6"; // Purple
      case "BUS": return "#E3000F"; // SL Red
      case "TRAM": return "#00A651"; // Green
      case "FERRY": return "#0089CA"; // Blue
      default: return "#666666";
    }
  }

  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(':');
    if (parts.length !== 3) return 0;
    
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  private async enhanceTripsWithRealTimeData(trips: Itinerary[]): Promise<Itinerary[]> {
    console.log(`ENHANCING: ${trips.length} trips with real-time data from Trafiklab`);
    
    // For each transit leg, try to get real-time departure data
    for (const trip of trips) {
      for (const leg of trip.legs) {
        if (leg.type === 'transit') {
          const transitLeg = leg as TransitLeg;
          try {
            // Try to get real-time data for this departure
            const realTimeData = await this.getRealTimeDeparture(
              transitLeg.from.name,
              transitLeg.line.number,
              new Date(transitLeg.departureTime)
            );
            
            if (realTimeData) {
              console.log(`REAL-TIME ENHANCED: ${transitLeg.line.number} from ${transitLeg.from.name}`);
              transitLeg.departureTime = realTimeData.expectedTime || realTimeData.plannedTime;
              transitLeg.isRealTime = true;
            }
          } catch (error) {
            console.log(`Real-time enhancement failed for ${transitLeg.line.number}: ${error}`);
            // Keep original ResRobot times
          }
        }
      }
    }
    
    return trips;
  }

  private async getRealTimeDeparture(stationName: string, lineNumber: string, scheduledTime: Date) {
    try {
      // First, find station ID by name
      const stationId = await this.findStationIdByName(stationName);
      if (!stationId) return null;
      
      // Get real-time departures
      const departures = await this.getRealDepartures(stationId, scheduledTime);
      
      // Find matching departure by line number and time
      const matchingDeparture = departures.find(dep => 
        dep.line.number === lineNumber &&
        Math.abs(new Date(dep.plannedTime).getTime() - scheduledTime.getTime()) < 15 * 60 * 1000 // Within 15 minutes
      );
      
      return matchingDeparture;
    } catch (error) {
      console.log(`Real-time lookup failed: ${error}`);
      return null;
    }
  }

  private async findStationIdByName(stationName: string): Promise<string | null> {
    // Try to map common Stockholm stations to Trafiklab IDs
    const stationMap: { [key: string]: string } = {
      'Stockholm Central': '740000001',
      'Stockholm Centralstation': '740000001',
      'T-Centralen': '740000001'
    };
    
    const normalizedName = stationName.replace(/,.*$/, '').trim(); // Remove city suffix
    return stationMap[normalizedName] || null;
  }

  private async getRealDepartures(stationId: string, dateTime?: Date): Promise<Departure[]> {
    try {
      const apiKey = process.env.TRAFIKLAB_API_KEY;
      if (!apiKey) {
        throw new Error("TRAFIKLAB_API_KEY required for real-time data");
      }

      let url = `${this.TRAFIKLAB_REALTIME_API}/departures/${stationId}`;
      
      if (dateTime) {
        const timeParam = dateTime.toISOString().slice(0, 16).replace('T', '/') + ':00';
        url += `/${timeParam}`;
      }
      
      url += `?key=${apiKey}`;
      
      console.log(`Trafiklab Real-time API: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Trafiklab API failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.errorCode) {
        throw new Error(`Trafiklab API error: ${data.errorCode} - ${data.errorDetail}`);
      }
      
      if (!data.departures || !Array.isArray(data.departures)) {
        return [];
      }
      
      console.log(`Trafiklab returned ${data.departures.length} real departures`);
      
      return data.departures.map((dep: any) => ({
        stopAreaId: stationId,
        line: {
          id: `TL_${dep.route?.designation || 'unknown'}`,
          number: dep.route?.designation || dep.route?.name || 'Unknown',
          mode: this.mapTrafilabTransportMode(dep.route?.transport_mode),
          name: `${this.getTransportTypeText({ catOutS: dep.route?.transport_mode })} ${dep.route?.designation || dep.route?.name || 'Unknown'}`,
          operatorId: dep.agency?.name || 'Unknown',
          color: this.getLineColor({ catOutS: dep.route?.transport_mode })
        },
        journeyId: `TL_${dep.trip?.trip_id || Date.now()}`,
        directionText: dep.route?.direction || dep.route?.destination?.name || 'Unknown Direction',
        plannedTime: dep.scheduled,
        expectedTime: dep.realtime,
        state: dep.delay > 0 ? "EXPECTED" : "NORMALPROGRESS",
        platform: dep.realtime_platform?.designation || dep.scheduled_platform?.designation,
        isRealTime: dep.is_realtime || false
      }));
      
    } catch (error) {
      console.error("Real departures fetch failed:", error);
      return [];
    }
  }

  private mapTrafilabTransportMode(mode: string): "METRO" | "BUS" | "TRAIN" | "TRAM" | "FERRY" {
    if (!mode) return "BUS";
    const modeStr = mode.toString().toUpperCase();
    if (modeStr === "METRO" || modeStr === "SUBWAY") return "METRO";
    if (modeStr === "TRAIN" || modeStr === "RAIL") return "TRAIN";
    if (modeStr === "TRAM" || modeStr === "LIGHT_RAIL") return "TRAM";
    if (modeStr === "FERRY" || modeStr === "BOAT") return "FERRY";
    return "BUS";
  }

  // Station search using real APIs - Stockholm region only
  async searchSites(query: string): Promise<StopArea[]> {
    return this.searchStopAreas(query);
  }

  async searchStopAreas(query: string): Promise<StopArea[]> {
    console.log(`REAL API SEARCH: Searching for stations matching "${query}"`);
    
    try {
      // Use ResRobot location.name API - THIS WORKS WITH YOUR KEY!
      const apiKey = process.env.RESROBOT_API_KEY;
      if (!apiKey) {
        throw new Error("RESROBOT_API_KEY required");
      }

      const params = new URLSearchParams({
        input: query,
        format: 'json',
        accessId: apiKey,
        maxNo: '30'
      });

      const url = `${this.RESROBOT_API_BASE}/location.name?${params}`;
      console.log(`Fetching real stations from ResRobot API...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ResRobot API failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errorCode) {
        throw new Error(`ResRobot error: ${data.errorText}`);
      }

      const locations: StopArea[] = [];
      
      if (data.stopLocationOrCoordLocation) {
        for (const item of data.stopLocationOrCoordLocation) {
          if (item.StopLocation) {
            const loc = item.StopLocation;
            // Filter for Stockholm region
            const lat = parseFloat(loc.lat);
            const lng = parseFloat(loc.lon);
            
            if (lat >= 59.0 && lat <= 60.0 && lng >= 17.5 && lng <= 19.0) {
              locations.push({
                id: loc.extId || loc.id,
                name: loc.name,
                lat: loc.lat.toString(),
                lng: loc.lon.toString()
              });
            }
          }
        }
      }
      
      console.log(`REAL API SUCCESS: Found ${locations.length} Stockholm stations`);
      
      // Save to database
      if (locations.length > 0) {
        await this.saveStationsToDatabase(locations);
      }
      
      return locations;
      
    } catch (error) {
      console.error("Station search failed:", error);
      throw new Error(`Station search unavailable: ${error}`);
    }
  }
  
  private async saveStationsToDatabase(stations: StopArea[]): Promise<void> {
    try {
      for (const station of stations) {
        // Try to insert, ignore if already exists
        await db.insert(stopAreas)
          .values(station)
          .onConflictDoNothing()
          .catch(() => {}); // Ignore duplicate key errors
      }
      console.log(`Saved ${stations.length} stations to database`);
    } catch (error) {
      console.log("Failed to save stations to database:", error);
    }
  }

  private async DEPRECATED_searchStationsUsingTripAPI(query: string): Promise<StopArea[]> {
    const apiKey = process.env.RESROBOT_API_KEY;
    if (!apiKey) {
      throw new Error("RESROBOT_API_KEY required for real station data");
    }

    // Use coordinate searches around Stockholm to discover stations
    const stockholmAreas = [
      { name: "Stockholm City", lat: 59.3293, lng: 18.0686 },
      { name: "Stockholm North", lat: 59.3500, lng: 18.0500 },
      { name: "Stockholm South", lat: 59.3000, lng: 18.0800 },
      { name: "Stockholm West", lat: 59.3300, lng: 17.9800 },
      { name: "Stockholm East", lat: 59.3300, lng: 18.1500 }
    ];

    const allStations: StopArea[] = [];
    const seenStations = new Set<string>();

    // Search each area to get comprehensive station coverage
    for (const area of stockholmAreas) {
      try {
        console.log(`Scanning ${area.name} for real transport stations...`);
        
        // Use trip search with nearby coordinates to discover stations
        const params = new URLSearchParams({
          originCoordLat: area.lat.toString(),
          originCoordLong: area.lng.toString(),
          destCoordLat: (area.lat + 0.01).toString(), // Small offset to trigger search
          destCoordLong: (area.lng + 0.01).toString(),
          format: 'json',
          accessId: apiKey,
          numTrips: '10'
        });

        const url = `${this.RESROBOT_API_BASE}/trip?${params}`;
        const response = await fetch(url);
        
        if (!response.ok) continue;
        
        const data = await response.json();
        if (data.errorCode || !data.Trip) continue;

        // Extract all stations from trip legs
        const trips = Array.isArray(data.Trip) ? data.Trip : [data.Trip];
        
        for (const trip of trips) {
          if (!trip.LegList?.Leg) continue;
          
          const legs = Array.isArray(trip.LegList.Leg) ? trip.LegList.Leg : [trip.LegList.Leg];
          
          for (const leg of legs) {
            // Extract origin station
            if (leg.Origin?.name && leg.Origin?.lat && leg.Origin?.lon) {
              const stationKey = `${leg.Origin.name}_${leg.Origin.lat}_${leg.Origin.lon}`;
              if (!seenStations.has(stationKey) && 
                  leg.Origin.name.toLowerCase().includes(query.toLowerCase())) {
                
                seenStations.add(stationKey);
                allStations.push({
                  id: leg.Origin.extId || leg.Origin.id || `station_${allStations.length}`,
                  name: leg.Origin.name,
                  lat: leg.Origin.lat.toString(),
                  lng: leg.Origin.lon.toString()
                });
              }
            }
            
            // Extract destination station  
            if (leg.Destination?.name && leg.Destination?.lat && leg.Destination?.lon) {
              const stationKey = `${leg.Destination.name}_${leg.Destination.lat}_${leg.Destination.lon}`;
              if (!seenStations.has(stationKey) && 
                  leg.Destination.name.toLowerCase().includes(query.toLowerCase())) {
                
                seenStations.add(stationKey);
                allStations.push({
                  id: leg.Destination.extId || leg.Destination.id || `station_${allStations.length}`,
                  name: leg.Destination.name,
                  lat: leg.Destination.lat.toString(),
                  lng: leg.Destination.lon.toString()
                });
              }
            }
          }
        }
        
        // Add small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`Failed to scan ${area.name}: ${error}`);
        continue;
      }
    }

    // Filter for Stockholm region coordinates
    const stockholmStations = allStations.filter(station => {
      const lat = parseFloat(station.lat);
      const lng = parseFloat(station.lng);
      return lat >= 59.0 && lat <= 60.0 && lng >= 17.5 && lng <= 18.5;
    });

    console.log(`REAL STATION DISCOVERY: Found ${stockholmStations.length} authentic Swedish transport stations`);
    
    return stockholmStations.slice(0, 20); // Limit results
  }

  // Remove all mock/fallback methods - REAL DATA ONLY
}

export const transitService = new TransitService();