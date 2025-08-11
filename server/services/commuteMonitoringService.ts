import { storage } from "../storage";
import { TransitService } from "./transitService";
import type { CommuteRoute } from "@shared/schema";

const transitService = new TransitService();

interface CommuteMonitoring {
  routeId: string;
  userId: string;
  isActive: boolean;
  alertTime: Date;
  departureTime: Date;
  lastChecked?: Date;
  lastDelayStatus?: number;
}

export class CommuteMonitoringService {
  private activeMonitorings: Map<string, CommuteMonitoring> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring() {
    // Check every minute for commute alerts and delays
    this.monitoringInterval = setInterval(async () => {
      await this.checkCommuteRoutes();
    }, 60000); // 60 seconds

    console.log("Commute monitoring service started - checking every minute");
  }

  private async checkCommuteRoutes() {
    try {
      const now = new Date();
      const today = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[today.getDay()];

      // Get all active commute routes for today
      const allActiveRoutes = await this.getAllActiveRoutesForToday(currentDay);
      
      for (const route of allActiveRoutes) {
        const monitoringKey = `${route.userId}_${route.id}`;
        
        // Calculate alert time and departure time for today
        const [hours, minutes] = route.departureTime.split(':').map(Number);
        const departureTime = new Date(today);
        departureTime.setHours(hours, minutes, 0, 0);
        
        const alertTime = new Date(departureTime);
        alertTime.setMinutes(alertTime.getMinutes() - (route.alertMinutesBefore || 15));

        // Check if we should be monitoring this route
        if (now >= alertTime && now <= departureTime && route.notificationsEnabled) {
          await this.monitorRouteForDelays(route, now, departureTime);
        }

        // Send initial alert at alert time
        if (this.isTimeForAlert(now, alertTime, monitoringKey)) {
          await this.sendDepartureAlert(route, departureTime);
        }
      }
    } catch (error) {
      console.error("Error in commute monitoring:", error);
    }
  }

  private async getAllActiveRoutesForToday(day: string): Promise<CommuteRoute[]> {
    try {
      // Get all users' active commute routes for today
      const routes = await storage.getAllActiveCommuteRoutesForDay(day);
      return routes;
    } catch (error) {
      console.error("Failed to get active routes:", error);
      return [];
    }
  }

  private async monitorRouteForDelays(route: CommuteRoute, now: Date, departureTime: Date) {
    try {
      const monitoringKey = `${route.userId}_${route.id}`;
      
      // Get the current best journey option for this route
      const bestJourney = await this.getBestJourneyOption(route, now);
      
      if (bestJourney) {
        const lastMonitoring = this.activeMonitorings.get(monitoringKey);
        
        // Check if delay status has changed significantly
        const delayChanged = !lastMonitoring || 
          Math.abs((lastMonitoring.lastDelayStatus || 0) - bestJourney.totalDelay) >= 5; // 5+ minute change
        
        if (delayChanged) {
          if (bestJourney.totalDelay > 0 || bestJourney.hasCancellations) {
            await this.sendJourneyDelayAlert(route, bestJourney);
          } else if (lastMonitoring?.lastDelayStatus && lastMonitoring.lastDelayStatus > 0) {
            await this.sendDelayResolvedAlert(route);
          }

          // Check for missed connections and alternative routes
          if (bestJourney.totalDelay > 15 || bestJourney.hasCancellations) {
            await this.checkForAlternativeRoutes(route, bestJourney, now);
          }

          // Update monitoring status
          this.activeMonitorings.set(monitoringKey, {
            routeId: route.id,
            userId: route.userId,
            isActive: true,
            alertTime: new Date(departureTime.getTime() - (route.alertMinutesBefore || 15) * 60000),
            departureTime,
            lastChecked: now,
            lastDelayStatus: bestJourney.totalDelay
          });
        }
      }
    } catch (error) {
      console.error(`Error monitoring route ${route.id}:`, error);
    }
  }

  private async getBestJourneyOption(route: CommuteRoute, now: Date): Promise<any | null> {
    try {
      // Get real-time journey from the same API endpoint
      const [hours, minutes] = route.departureTime.split(':').map(Number);
      const preferredDateTime = new Date(now);
      preferredDateTime.setHours(hours, minutes, 0, 0);
      
      // If we're past preferred time, search for next available departure
      if (now > preferredDateTime) {
        preferredDateTime.setTime(now.getTime() + 5 * 60000); // 5 minutes from now
      }
      
      const itineraries = await transitService.searchTrips(
        route.originAreaId, 
        route.destinationAreaId, 
        preferredDateTime, 
        true
      );
      
      if (itineraries.length > 0) {
        const bestItinerary = itineraries[0];
        
        // Calculate total delay and check for cancellations
        let totalDelay = 0;
        let hasCancellations = false;
        let missedConnections = false;
        
        for (const leg of bestItinerary.legs) {
          if (leg.kind === 'TRANSIT') {
            const delay = leg.expectedDeparture && leg.plannedDeparture
              ? Math.round((new Date(leg.expectedDeparture).getTime() - new Date(leg.plannedDeparture).getTime()) / 60000)
              : 0;
            totalDelay += Math.max(0, delay);
            if (leg.cancelled) hasCancellations = true;
          }
        }
        
        // Check for missed connections (if delay > 10 minutes on multi-leg journey)
        if (bestItinerary.legs.filter(leg => leg.kind === 'TRANSIT').length > 1 && totalDelay > 10) {
          missedConnections = true;
        }
        
        return {
          ...bestItinerary,
          totalDelay,
          hasCancellations,
          missedConnections
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting best journey option:', error);
      return null;
    }
  }

  private async checkForAlternativeRoutes(route: CommuteRoute, currentJourney: any, now: Date) {
    try {
      // Search for alternative routes departing in the next 30 minutes
      const alternatives = [];
      
      for (let i = 1; i <= 6; i++) { // Check every 5 minutes for next 30 minutes
        const searchTime = new Date(now.getTime() + (i * 5 * 60000));
        
        try {
          const altItineraries = await transitService.searchTrips(
            route.originAreaId, 
            route.destinationAreaId, 
            searchTime, 
            true
          );
          
          if (altItineraries.length > 0) {
            const altItinerary = altItineraries[0];
            
            // Calculate if this alternative is significantly better
            const altDelay = altItinerary.delayMinutes || 0;
            const timeDifferenceMinutes = Math.round((new Date(altItinerary.plannedArrival).getTime() - new Date(currentJourney.plannedArrival).getTime()) / 60000);
            const totalTimeDifference = timeDifferenceMinutes + altDelay - currentJourney.totalDelay;
            
            if (totalTimeDifference < currentJourney.totalDelay && totalTimeDifference < 30) {
              alternatives.push({
                ...altItinerary,
                timeSaved: currentJourney.totalDelay - totalTimeDifference,
                newArrivalTime: new Date(altItinerary.plannedArrival).getTime() + (altDelay * 60000)
              });
            }
          }
        } catch (altError) {
          console.error(`Error searching alternative at ${searchTime}:`, altError);
        }
      }
      
      if (alternatives.length > 0) {
        const bestAlternative = alternatives.sort((a, b) => b.timeSaved - a.timeSaved)[0];
        await this.sendAlternativeRouteAlert(route, currentJourney, bestAlternative);
      }
    } catch (error) {
      console.error('Error checking alternative routes:', error);
    }
  }

  private findRelevantDepartures(departures: any[], preferredTime: string): any[] {
    const [prefHours, prefMinutes] = preferredTime.split(':').map(Number);
    const preferredMinutesFromMidnight = prefHours * 60 + prefMinutes;
    
    // Find departures within 30 minutes of preferred time
    return departures.filter(dep => {
      const depTime = new Date(dep.plannedTime);
      const depMinutesFromMidnight = depTime.getHours() * 60 + depTime.getMinutes();
      const timeDiff = Math.abs(depMinutesFromMidnight - preferredMinutesFromMidnight);
      return timeDiff <= 30; // Within 30 minutes of preferred time
    });
  }

  private calculateMaxDelay(departures: any[]): number {
    return Math.max(0, ...departures.map(dep => 
      dep.expectedTime && dep.plannedTime 
        ? Math.round((new Date(dep.expectedTime).getTime() - new Date(dep.plannedTime).getTime()) / 60000)
        : 0
    ));
  }

  private isTimeForAlert(now: Date, alertTime: Date, monitoringKey: string): boolean {
    const timeDiff = Math.abs(now.getTime() - alertTime.getTime());
    const isWithinOneMinute = timeDiff <= 60000; // Within 1 minute
    
    const lastMonitoring = this.activeMonitorings.get(monitoringKey);
    const hasNotSentInitialAlert = !lastMonitoring || !lastMonitoring.isActive;
    
    return isWithinOneMinute && hasNotSentInitialAlert;
  }

  private async sendDepartureAlert(route: CommuteRoute, departureTime: Date) {
    console.log(`Sending departure alert for route ${route.name} at ${departureTime.toLocaleTimeString()}`);
    
    // Send notification via WebSocket or push notification
    await this.sendNotification(route.userId, {
      type: 'departure_alert',
      title: `${route.name} - Departure Alert`,
      message: `Your ${route.name} commute departs at ${route.departureTime}`,
      routeId: route.id,
      severity: 'medium'
    });
  }

  private async sendJourneyDelayAlert(route: CommuteRoute, journey: any) {
    console.log(`Sending journey delay alert for route ${route.name}: ${journey.totalDelay} minutes delay`);
    
    const transitLegs = journey.legs.filter((leg: any) => leg.kind === 'TRANSIT');
    const affectedLines = transitLegs
      .filter((leg: any) => leg.delay && leg.delay > 0)
      .map((leg: any) => leg.line?.number || 'Unknown')
      .filter((line: string, index: number, arr: string[]) => arr.indexOf(line) === index)
      .join(', ');

    let message = `${journey.totalDelay} minute delay on your journey`;
    if (affectedLines) {
      message += ` (${affectedLines})`;
    }
    if (journey.hasCancellations) {
      message += '. Some services cancelled.';
    }
    if (journey.missedConnections) {
      message += '. You may miss connections.';
    }

    await this.sendNotification(route.userId, {
      type: 'journey_delay',
      title: `${route.name} - Journey Delayed`,
      message,
      routeId: route.id,
      severity: journey.totalDelay > 15 || journey.hasCancellations ? 'high' : 'medium'
    });
  }

  private async sendAlternativeRouteAlert(route: CommuteRoute, currentJourney: any, alternative: any) {
    console.log(`Sending alternative route alert for route ${route.name}`);
    
    const currentArrival = new Date(currentJourney.plannedArrival).getTime() + (currentJourney.totalDelay * 60000);
    const altArrival = alternative.newArrivalTime;
    const timeSaved = Math.round((currentArrival - altArrival) / 60000);
    
    await this.sendNotification(route.userId, {
      type: 'alternative_route',
      title: `${route.name} - Better Route Available`,
      message: `Alternative route arriving ${timeSaved} minutes earlier. Departs ${new Date(alternative.plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}.`,
      routeId: route.id,
      severity: 'medium'
    });
  }

  private async sendDelayResolvedAlert(route: CommuteRoute) {
    console.log(`Sending delay resolved alert for route ${route.name}`);
    
    await this.sendNotification(route.userId, {
      type: 'delay_resolved',
      title: `${route.name} - Back on Time`,
      message: `Your commute is now running on schedule`,
      routeId: route.id,
      severity: 'low'
    });
  }

  private async sendNotification(userId: string, notification: any) {
    try {
      // Store notification in database
      await storage.createUserNotification({
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        severity: notification.severity,
        routeId: notification.routeId
      });

      // Send via WebSocket if available (this would need to be implemented in routes.ts)
      console.log(`Notification sent to user ${userId}: ${notification.title}`);
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }

  // Clean up monitoring for routes that are no longer active
  public cleanupInactiveMonitorings() {
    const now = new Date();
    for (const [key, monitoring] of this.activeMonitorings.entries()) {
      if (now > monitoring.departureTime) {
        this.activeMonitorings.delete(key);
      }
    }
  }

  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("Commute monitoring service stopped");
    }
  }
}

export const commuteMonitoringService = new CommuteMonitoringService();