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
      
      // Get real-time departures for this route
      const departures = await transitService.getStationDepartures(route.originAreaId, now);
      
      // Find departures around the user's preferred time
      const relevantDepartures = this.findRelevantDepartures(departures, route.departureTime);
      
      if (relevantDepartures.length > 0) {
        const currentDelay = this.calculateMaxDelay(relevantDepartures);
        const lastMonitoring = this.activeMonitorings.get(monitoringKey);
        
        // Check if delay status has changed
        if (!lastMonitoring || lastMonitoring.lastDelayStatus !== currentDelay) {
          if (currentDelay > 0) {
            await this.sendDelayAlert(route, currentDelay, relevantDepartures);
          } else if (lastMonitoring?.lastDelayStatus && lastMonitoring.lastDelayStatus > 0 && currentDelay === 0) {
            await this.sendDelayResolvedAlert(route);
          }

          // Update monitoring status
          this.activeMonitorings.set(monitoringKey, {
            routeId: route.id,
            userId: route.userId,
            isActive: true,
            alertTime: new Date(departureTime.getTime() - (route.alertMinutesBefore || 15) * 60000),
            departureTime,
            lastChecked: now,
            lastDelayStatus: currentDelay
          });
        }
      }
    } catch (error) {
      console.error(`Error monitoring route ${route.id}:`, error);
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

  private async sendDelayAlert(route: CommuteRoute, delayMinutes: number, departures: any[]) {
    console.log(`Sending delay alert for route ${route.name}: ${delayMinutes} minutes delay`);
    
    const affectedLines = departures
      .filter(dep => dep.delay && dep.delay > 0)
      .map(dep => dep.line?.number || 'Unknown')
      .filter((line, index, arr) => arr.indexOf(line) === index)
      .join(', ');

    await this.sendNotification(route.userId, {
      type: 'delay',
      title: `${route.name} - Delay Alert`,
      message: `${delayMinutes} minute delay on ${affectedLines}. Monitor for updates.`,
      routeId: route.id,
      severity: delayMinutes > 10 ? 'high' : 'medium'
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