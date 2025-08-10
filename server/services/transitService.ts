import { storage } from "../storage";
import type { Itinerary, Departure, Line, StopArea, Leg, TransitLeg, WalkLeg } from "@shared/schema";

// Mock transit data following SL structure
export class TransitService {
  private mockStopAreas: StopArea[] = [
    // Stockholm Metro (Tunnelbana)
    { id: "9001", name: "Stockholm Odenplan", lat: "59.3428", lon: "18.0484", type: "METROSTN" },
    { id: "9003", name: "Kungsträdgården", lat: "59.3312", lon: "18.0745", type: "METROSTN" },
    { id: "9004", name: "T-Centralen", lat: "59.3312", lon: "18.0592", type: "METROSTN" },
    { id: "9192", name: "Sundbyberg", lat: "59.3616", lon: "17.9706", type: "METROSTN" },
    { id: "9180", name: "Flemingsberg", lat: "59.2175", lon: "17.9447", type: "RAILWSTN" },
    { id: "9117", name: "Slussen", lat: "59.3199", lon: "18.0717", type: "METROSTN" },
    { id: "9189", name: "Södermalm", lat: "59.3165", lon: "18.0636", type: "METROSTN" },
    { id: "9170", name: "Gamla Stan", lat: "59.3238", lon: "18.0686", type: "METROSTN" },
    
    // Railway stations (Pendeltåg)
    { id: "9005", name: "Stockholm Central", lat: "59.3303", lon: "18.0591", type: "RAILWSTN" },
    { id: "9002", name: "Arlanda Airport", lat: "59.6519", lon: "17.9186", type: "RAILWSTN" },
    { id: "9181", name: "Södertälje Centrum", lat: "59.1958", lon: "17.6253", type: "RAILWSTN" },
    { id: "9182", name: "Märsta", lat: "59.6175", lon: "17.8544", type: "RAILWSTN" },
    { id: "9183", name: "Uppsala Centralstation", lat: "59.8586", lon: "17.6389", type: "RAILWSTN" },
    { id: "9184", name: "Nynäshamn", lat: "58.9034", lon: "17.9478", type: "RAILWSTN" },
    { id: "9185", name: "Bålsta", lat: "59.5697", lon: "17.5372", type: "RAILWSTN" },
    
    // Bus terminals
    { id: "1080", name: "Cityterminalen", lat: "59.3317", lon: "18.0576", type: "BUSTERM" },
    { id: "1081", name: "Slussen Bussterminalen", lat: "59.3199", lon: "18.0717", type: "BUSTERM" },
    { id: "1082", name: "Tekniska Högskolan", lat: "59.3472", lon: "18.0728", type: "BUSTERM" },
    
    // Popular areas
    { id: "9186", name: "Östermalm", lat: "59.3369", lon: "18.0895", type: "METROSTN" },
    { id: "9187", name: "Vasastan", lat: "59.3439", lon: "18.0636", type: "METROSTN" },
    { id: "9188", name: "Södermalm", lat: "59.3165", lon: "18.0636", type: "METROSTN" },
    { id: "9190", name: "Norrmalm", lat: "59.3293", lon: "18.0686", type: "METROSTN" },
    { id: "9191", name: "Gamla Stan", lat: "59.3238", lon: "18.0686", type: "METROSTN" },
  ];

  private mockLines: Line[] = [
    { id: "L1", number: "10", mode: "METRO", name: "Blue Line", operatorId: "SL" },
    { id: "L2", number: "11", mode: "METRO", name: "Blue Line", operatorId: "SL" },
    { id: "L3", number: "13", mode: "METRO", name: "Red Line", operatorId: "SL" },
    { id: "L4", number: "14", mode: "METRO", name: "Red Line", operatorId: "SL" },
    { id: "L5", number: "17", mode: "METRO", name: "Green Line", operatorId: "SL" },
    { id: "L6", number: "18", mode: "METRO", name: "Green Line", operatorId: "SL" },
    { id: "L7", number: "19", mode: "METRO", name: "Green Line", operatorId: "SL" },
    { id: "L8", number: "35", mode: "TRAIN", name: "Commuter Train", operatorId: "SL" },
    { id: "L9", number: "36", mode: "TRAIN", name: "Commuter Train", operatorId: "SL" },
    { id: "L10", number: "38", mode: "TRAIN", name: "Commuter Train", operatorId: "SL" },
    { id: "L11", number: "AE", mode: "TRAIN", name: "Arlanda Express", operatorId: "AE" },
    { id: "L12", number: "43", mode: "BUS", name: "Bus 43", operatorId: "SL" },
    { id: "L13", number: "583", mode: "BUS", name: "Airport Bus 583", operatorId: "SL" },
  ];

  async searchRoutes(from: string, to: string, via?: string, dateTime?: Date): Promise<{
    best: Itinerary;
    alternatives: Itinerary[];
  }> {
    // Find stop areas
    const fromArea = this.mockStopAreas.find(area => 
      area.name.toLowerCase().includes(from.toLowerCase()) || area.id === from
    );
    const toArea = this.mockStopAreas.find(area => 
      area.name.toLowerCase().includes(to.toLowerCase()) || area.id === to
    );

    if (!fromArea || !toArea) {
      throw new Error("Stop areas not found");
    }

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
        plannedArrival: new Date(currentTime.getTime() + (route.firstLegTime + timeOffset) * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + (timeOffset + route.delay) * 60000).toISOString(),
        expectedArrival: new Date(currentTime.getTime() + (route.firstLegTime + timeOffset + route.delay) * 60000).toISOString(),
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
      currentTime = new Date(currentTime.getTime() + (route.firstLegTime + route.transferWalk + timeOffset + route.delay) * 60000);
      const secondLeg: TransitLeg = {
        kind: "TRANSIT",
        line: route.secondLine!,
        journeyId: `J_${Date.now()}_${route.secondLine!.number}`,
        directionText: to.name,
        from: { areaId: route.hubId!, name: route.viaHub!, platform: this.getPlatform({ id: route.hubId! } as StopArea, route.secondLine!) },
        to: { areaId: to.id, name: to.name, platform: this.getPlatform(to, route.secondLine!) },
        plannedDeparture: new Date(currentTime.getTime() + 2 * 60000).toISOString(), // 2 min connection time
        plannedArrival: new Date(currentTime.getTime() + (route.secondLegTime + 2) * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + 2 * 60000).toISOString(), // On time for second leg
        expectedArrival: new Date(currentTime.getTime() + (route.secondLegTime + 2) * 60000).toISOString(),
      };
      legs.push(secondLeg);
    }

    const plannedDeparture = legs[0].kind === "TRANSIT" ? legs[0].plannedDeparture : baseTime.toISOString();
    const plannedArrival = legs[legs.length - 1].kind === "TRANSIT" ? 
      legs[legs.length - 1].plannedArrival : 
      new Date(baseTime.getTime() + 42 * 60000).toISOString();

    const expectedDeparture = legs[0].kind === "TRANSIT" && legs[0].expectedDeparture ? 
      legs[0].expectedDeparture : plannedDeparture;
    const expectedArrival = legs[legs.length - 1].kind === "TRANSIT" && legs[legs.length - 1].expectedArrival ? 
      legs[legs.length - 1].expectedArrival : plannedArrival;

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
    // For Sundbyberg → Flemingsberg (your example)
    if (from.name.includes("Sundbyberg") && to.name.includes("Flemingsberg")) {
      return {
        direct: false,
        viaHub: "T-Centralen",
        hubId: "9004",
        firstLine: this.mockLines.find(l => l.number === "11")!, // Blue line to T-Centralen
        secondLine: this.mockLines.find(l => l.number === "35")!, // Commuter train to Flemingsberg
        travelTime: 55,
        firstLegTime: 15,
        secondLegTime: 35,
        transferWalk: 5,
        delay: Math.floor(Math.random() * 10), // Random delay 0-10 min
      };
    }
    
    // For routes involving T-Centralen
    if (from.name.includes("T-Centralen") || to.name.includes("T-Centralen")) {
      const otherStation = from.name.includes("T-Centralen") ? to : from;
      const line = otherStation.type === "RAILWSTN" ? 
        this.mockLines.find(l => l.mode === "TRAIN")! : 
        this.mockLines.find(l => l.mode === "METRO")!;
      
      return {
        direct: true,
        line,
        travelTime: 25,
        transferWalk: 0,
        delay: Math.floor(Math.random() * 5), // Random delay 0-5 min
      };
    }

    // Default: route via T-Centralen (most common for Stockholm)
    return {
      direct: false,
      viaHub: "T-Centralen", 
      hubId: "9004",
      firstLine: this.mockLines.find(l => l.mode === "METRO" && l.number === "11")!,
      secondLine: from.type === "RAILWSTN" || to.type === "RAILWSTN" ? 
        this.mockLines.find(l => l.mode === "TRAIN")! : 
        this.mockLines.find(l => l.mode === "METRO" && l.number === "13")!,
      travelTime: 45,
      firstLegTime: 20,
      secondLegTime: 20,
      transferWalk: 5,
      delay: Math.floor(Math.random() * 8), // Random delay 0-8 min
    };
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
    
    const filtered = this.mockStopAreas.filter(stop =>
      stop.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Return filtered results instead of throwing error
    return filtered.slice(0, 10);
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

  getStopAreas(): StopArea[] {
    return this.mockStopAreas;
  }

  getLines(): Line[] {
    return this.mockLines;
  }
}

export const transitService = new TransitService();
