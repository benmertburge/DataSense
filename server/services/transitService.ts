import { storage } from "../storage";
import type { Itinerary, Departure, Line, StopArea, Leg, TransitLeg, WalkLeg } from "@shared/schema";

// Mock transit data following SL structure
export class TransitService {
  private mockStopAreas: StopArea[] = [
    { id: "9001", name: "Stockholm Odenplan", lat: "59.3428", lon: "18.0484", type: "METROSTN" },
    { id: "9002", name: "Arlanda Airport", lat: "59.6519", lon: "17.9186", type: "RAILWSTN" },
    { id: "9003", name: "Kungsträdgården", lat: "59.3312", lon: "18.0745", type: "METROSTN" },
    { id: "9004", name: "T-Centralen", lat: "59.3312", lon: "18.0592", type: "METROSTN" },
    { id: "9005", name: "Stockholm Central", lat: "59.3303", lon: "18.0591", type: "RAILWSTN" },
  ];

  private mockLines: Line[] = [
    { id: "L1", number: "10", mode: "METRO", name: "Blue Line", operatorId: "SL" },
    { id: "L2", number: "AE", mode: "TRAIN", name: "Arlanda Express", operatorId: "AE" },
    { id: "L3", number: "43", mode: "BUS", name: "Bus 43", operatorId: "SL" },
    { id: "L4", number: "583", mode: "BUS", name: "Airport Bus 583", operatorId: "SL" },
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

    if (type === "direct" && to.name.includes("Arlanda")) {
      // Direct bus route
      const transitLeg: TransitLeg = {
        kind: "TRANSIT",
        line: this.mockLines.find(l => l.number === "583")!,
        journeyId: `J_${Date.now()}_583`,
        directionText: "Arlanda Airport",
        from: { areaId: from.id, name: from.name, platform: "C" },
        to: { areaId: to.id, name: to.name, platform: "Terminal 5" },
        plannedDeparture: currentTime.toISOString(),
        plannedArrival: new Date(currentTime.getTime() + 45 * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + 2 * 60000).toISOString(), // 2 min delay
        expectedArrival: new Date(currentTime.getTime() + 47 * 60000).toISOString(),
      };
      legs.push(transitLeg);
    } else {
      // Multi-leg journey
      // First leg: Metro
      const metroLeg: TransitLeg = {
        kind: "TRANSIT",
        line: this.mockLines.find(l => l.number === "10")!,
        journeyId: `J_${Date.now()}_METRO`,
        directionText: "Kungsträdgården",
        from: { areaId: from.id, name: from.name, platform: "2" },
        to: { areaId: "9003", name: "Kungsträdgården", platform: type === "main" ? "3" : "2" },
        plannedDeparture: currentTime.toISOString(),
        plannedArrival: new Date(currentTime.getTime() + 15 * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + 5 * 60000).toISOString(), // 5 min delay
        expectedArrival: new Date(currentTime.getTime() + 20 * 60000).toISOString(),
        platformChange: type === "main", // Platform change for main route
      };
      legs.push(metroLeg);

      // Transfer walk
      currentTime = new Date(currentTime.getTime() + 20 * 60000);
      const walkLeg: WalkLeg = {
        kind: "WALK",
        fromAreaId: "9003",
        toAreaId: "9005",
        durationMinutes: 3,
        meters: 200,
      };
      legs.push(walkLeg);

      // Second leg: Train to airport
      currentTime = new Date(currentTime.getTime() + 3 * 60000);
      const trainLeg: TransitLeg = {
        kind: "TRANSIT",
        line: this.mockLines.find(l => l.number === "AE")!,
        journeyId: `J_${Date.now()}_AE`,
        directionText: "Arlanda Airport",
        from: { areaId: "9005", name: "Stockholm Central", platform: "1" },
        to: { areaId: to.id, name: to.name, platform: "Terminal 5" },
        plannedDeparture: new Date(currentTime.getTime() + 12 * 60000).toISOString(),
        plannedArrival: new Date(currentTime.getTime() + 32 * 60000).toISOString(),
        expectedDeparture: new Date(currentTime.getTime() + 12 * 60000).toISOString(), // On time
        expectedArrival: new Date(currentTime.getTime() + 32 * 60000).toISOString(),
      };
      legs.push(trainLeg);
    }

    const plannedDeparture = legs[0].kind === "TRANSIT" ? legs[0].plannedDeparture : baseTime.toISOString();
    const plannedArrival = legs[legs.length - 1].kind === "TRANSIT" ? 
      legs[legs.length - 1].plannedArrival : 
      new Date(baseTime.getTime() + 42 * 60000).toISOString();

    const expectedDeparture = legs[0].kind === "TRANSIT" && legs[0].expectedDeparture ? 
      legs[0].expectedDeparture : plannedDeparture;
    const expectedArrival = legs[legs.length - 1].kind === "TRANSIT" && legs[legs.length - 1].expectedArrival ? 
      legs[legs.length - 1].expectedArrival : 
      new Date(baseTime.getTime() + 47 * 60000).toISOString();

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
