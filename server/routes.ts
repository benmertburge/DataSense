import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { transitService } from "./services/transitService";
import { compensationService } from "./services/compensationService";
import { 
  journeyPlannerSchema, 
  compensationClaimSchema,
  insertSavedRouteSchema,
  insertJourneySchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    
    if (userId) {
      clients.set(userId, ws);
      console.log(`WebSocket client connected: ${userId}`);
    }

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
        console.log(`WebSocket client disconnected: ${userId}`);
      }
    });
  });

  // Broadcast real-time updates
  function broadcastToUser(userId: string, data: any) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Transit data routes
  app.get('/api/sites/search', isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const sites = await transitService.searchSites(query);
      res.json(sites);
    } catch (error) {
      console.error("Error searching sites:", error);
      res.status(500).json({ message: "Failed to search sites" });
    }
  });

  // Journey planning routes
  app.post('/api/trips/search', isAuthenticated, async (req: any, res) => {
    try {
      const data = journeyPlannerSchema.parse(req.body);
      // ABSOLUTE FIX: Create Stockholm local time WITHOUT timezone conversion
      // Parse user input as Stockholm local time directly - NO UTC conversion
      const [year, month, day] = data.date.split('-').map(Number);
      const [hour, minute] = data.time.split(':').map(Number);
      
      // Create date in Stockholm timezone using proper constructor
      const stockholmDateTime = new Date();
      stockholmDateTime.setFullYear(year, month - 1, day); // month is 0-indexed
      stockholmDateTime.setHours(hour, minute, 0, 0);
      
      console.log(`ROUTES DEBUG: Raw user input: ${data.date} ${data.time}`);
      console.log(`ROUTES DEBUG: Created dateTime object: ${stockholmDateTime.toString()}`);
      console.log(`ROUTES DEBUG: Hours/Minutes: ${stockholmDateTime.getHours()}:${stockholmDateTime.getMinutes()}`);
      console.log(`ROUTES DEBUG: Search type: ${data.leaveAt ? 'departure' : 'arrival'}`);
      
      // Get station details - ensure we have valid station IDs
      const fromId = typeof data.from === 'string' ? data.from : data.from?.id;
      const toId = typeof data.to === 'string' ? data.to : data.to?.id;
      
      // Validate that we have numeric station IDs, not station names
      if (!fromId || !toId) {
        throw new Error("Missing station IDs in request");
      }
      
      // Check if we received station names instead of IDs
      if (fromId.includes(' ') || toId.includes(' ')) {
        throw new Error("Station names received instead of station IDs. Form should submit station objects with numeric IDs.");
      }
      
      // Debug the actual data being sent
      console.log(`ROUTE DEBUG: fromId type: ${typeof fromId}, value: "${fromId}"`);
      console.log(`ROUTE DEBUG: toId type: ${typeof toId}, value: "${toId}"`);
      console.log(`ROUTE DEBUG: from data:`, data.from);
      console.log(`ROUTE DEBUG: to data:`, data.to);
      
      console.log(`Searching trips directly with station IDs: ${fromId} -> ${toId}`);
      
      // Search trips using station IDs directly - no coordinates needed
      const routes = await transitService.searchTrips(
        fromId,
        toId,
        stockholmDateTime,
        data.leaveAt  // Pass the leaveAt parameter from form
      );
      
      res.json(routes);
    } catch (error) {
      console.error("Error searching trips:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.get('/api/departures/:areaId', isAuthenticated, async (req, res) => {
    try {
      const { areaId } = req.params;
      const departures = await transitService.getRealDepartures(areaId);
      res.json(departures);
    } catch (error) {
      console.error("Error fetching departures:", error);
      res.status(500).json({ message: "Failed to fetch departures" });
    }
  });

  // Saved routes
  app.get('/api/routes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const routes = await storage.getUserSavedRoutes(userId);
      res.json(routes);
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ message: "Failed to fetch routes" });
    }
  });

  app.post('/api/routes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertSavedRouteSchema.parse({ ...req.body, userId });
      const route = await storage.createSavedRoute(data);
      res.json(route);
    } catch (error) {
      console.error("Error creating route:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.delete('/api/routes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      await storage.deleteSavedRoute(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route:", error);
      res.status(500).json({ message: "Failed to delete route" });
    }
  });

  // Journey monitoring
  app.get('/api/journeys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const journeys = await storage.getUserJourneys(userId);
      res.json(journeys);
    } catch (error) {
      console.error("Error fetching journeys:", error);
      res.status(500).json({ message: "Failed to fetch journeys" });
    }
  });

  app.get('/api/journeys/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const journey = await storage.getActiveJourney(userId);
      res.json(journey || null);
    } catch (error) {
      console.error("Error fetching active journey:", error);
      res.status(500).json({ message: "Failed to fetch active journey" });
    }
  });

  app.post('/api/journeys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertJourneySchema.parse({ ...req.body, userId });
      const journey = await storage.createJourney(data);
      
      // Start real-time monitoring
      setTimeout(async () => {
        const updates = await transitService.updateJourneyRealtime(journey.id);
        const updatedJourney = await storage.updateJourney(journey.id, updates);
        
        broadcastToUser(userId, {
          type: 'journey_update',
          journey: updatedJourney
        });

        // Check for compensation eligibility
        if (updatedJourney.delayMinutes >= 20) {
          const compensationCase = await compensationService.detectEligibility(userId, journey.id);
          if (compensationCase) {
            broadcastToUser(userId, {
              type: 'compensation_eligible',
              case: compensationCase
            });
          }
        }
      }, 5000); // Simulate delay after 5 seconds
      
      res.json(journey);
    } catch (error) {
      console.error("Error creating journey:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Compensation routes
  app.get('/api/compensation/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cases = await storage.getUserCompensationCases(userId);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching compensation cases:", error);
      res.status(500).json({ message: "Failed to fetch compensation cases" });
    }
  });

  app.post('/api/compensation/cases/detect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { journeyId } = req.body;
      
      const compensationCase = await compensationService.detectEligibility(userId, journeyId);
      res.json({ case: compensationCase });
    } catch (error) {
      console.error("Error detecting compensation eligibility:", error);
      res.status(500).json({ message: "Failed to detect compensation eligibility" });
    }
  });

  app.post('/api/compensation/submit', isAuthenticated, async (req: any, res) => {
    try {
      const { caseId, claimData } = req.body;
      const validatedClaimData = compensationClaimSchema.parse(claimData);
      
      const result = await compensationService.submitClaim(caseId, validatedClaimData);
      res.json(result);
    } catch (error) {
      console.error("Error submitting compensation claim:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  app.post('/api/compensation/submit-to-sl', isAuthenticated, async (req: any, res) => {
    try {
      const { caseId, claimData, journeyData } = req.body;
      const validatedClaimData = compensationClaimSchema.parse(claimData);
      
      // Submit directly to SL web form with authentic journey data
      const result = await compensationService.submitToSLWebForm(caseId, validatedClaimData, journeyData);
      res.json(result);
    } catch (error) {
      console.error("Error submitting to SL web form:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to submit to SL" });
    }
  });

  app.get('/api/compensation/cases/:id/pdf', async (req, res) => {
    try {
      const { id } = req.params;
      // In production, serve from cloud storage
      res.status(404).json({ message: "PDF not found" });
    } catch (error) {
      console.error("Error fetching PDF:", error);
      res.status(500).json({ message: "Failed to fetch PDF" });
    }
  });

  // Deviations and service alerts
  app.get('/api/deviations', async (req, res) => {
    try {
      const deviations = await storage.getActiveDeviations();
      res.json(deviations);
    } catch (error) {
      console.error("Error fetching deviations:", error);
      res.status(500).json({ message: "Failed to fetch deviations" });
    }
  });

  // User Settings Routes
  app.get("/api/user/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const settings = {
        notificationsEnabled: user.notificationsEnabled,
        delayAlertsEnabled: user.delayAlertsEnabled,
        alertTimingMinutes: user.alertTimingMinutes,
        preferredLanguage: user.preferredLanguage,
        theme: user.theme,
        pushNotifications: user.pushNotifications,
        emailNotifications: user.emailNotifications,
        smsNotifications: user.smsNotifications,
        phone: user.phone,
        address: user.address,
        emergencyContact: user.emergencyContact,
      };
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updates = req.body;
      
      // Validate the updates
      const allowedFields = [
        'notificationsEnabled', 'delayAlertsEnabled', 'alertTimingMinutes',
        'preferredLanguage', 'theme', 'pushNotifications', 'emailNotifications',
        'smsNotifications', 'phone', 'address', 'emergencyContact'
      ];
      
      const validUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updatedUser = await storage.updateUserSettings(userId, validUpdates);
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Notifications Routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notificationId = req.params.id;
      
      const notification = await storage.markNotificationAsRead(userId, notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.post("/api/notifications/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Create a test notification
      const testNotification = {
        userId,
        title: "Test Notification",
        message: "This is a test notification from TransitPro. Your notification system is working correctly!",
        type: "maintenance" as const,
        severity: "low" as const,
      };
      
      const notification = await storage.createNotification(testNotification);
      
      // If WebSocket is connected, send real-time notification
      const client = clients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
      }
      
      res.json({ success: true, notification });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  // Service Alerts Routes
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getActiveServiceAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching service alerts:", error);
      res.status(500).json({ error: "Failed to fetch service alerts" });
    }
  });

  // Push Subscription Routes
  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { endpoint, p256dh, auth } = req.body;
      
      const subscription = await storage.createPushSubscription({
        userId,
        endpoint,
        p256dh,
        auth,
      });
      
      res.json(subscription);
    } catch (error) {
      console.error("Error creating push subscription:", error);
      res.status(500).json({ error: "Failed to create push subscription" });
    }
  });

  app.delete("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { endpoint } = req.body;
      
      const deleted = await storage.deletePushSubscription(userId, endpoint);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      res.status(500).json({ error: "Failed to delete push subscription" });
    }
  });

  // Commute Routes
  app.get("/api/commute/routes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const routes = await storage.getCommuteRoutes(userId);
      res.json(routes);
    } catch (error) {
      console.error("Error fetching commute routes:", error);
      res.status(500).json({ error: "Failed to fetch commute routes" });
    }
  });

  app.post("/api/commute/routes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const routeData = { ...req.body, userId };
      const route = await storage.createCommuteRoute(routeData);
      res.json(route);
    } catch (error) {
      console.error("Error creating commute route:", error);
      res.status(500).json({ error: "Failed to create commute route" });
    }
  });

  app.put("/api/commute/routes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const routeId = req.params.id;
      const updates = req.body;
      
      const route = await storage.updateCommuteRoute(userId, routeId, updates);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.json(route);
    } catch (error) {
      console.error("Error updating commute route:", error);
      res.status(500).json({ error: "Failed to update commute route" });
    }
  });

  app.delete("/api/commute/routes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const routeId = req.params.id;
      
      const deleted = await storage.deleteCommuteRoute(userId, routeId);
      if (!deleted) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting commute route:", error);
      res.status(500).json({ error: "Failed to delete commute route" });
    }
  });

  // Today's commute routes
  app.get('/api/commute/routes/today', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const today = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[today.getDay()];
      
      const routes = await storage.getActiveCommuteRoutesForDay(userId, dayOfWeek);
      res.json(routes);
    } catch (error) {
      console.error("Error fetching today's commute routes:", error);
      res.status(500).json({ error: "Failed to fetch today's commute routes" });
    }
  });

  // Background job to process automatic compensation detection
  setInterval(async () => {
    try {
      // Get all users with active journeys
      const users = await storage.getUsersWithActiveJourneys?.() || [];
      
      for (const user of users) {
        const detectedCases = await compensationService.processAutomaticDetection(user.id);
        
        if (detectedCases.length > 0) {
          broadcastToUser(user.id, {
            type: 'compensation_detected',
            cases: detectedCases
          });
        }
      }
    } catch (error) {
      console.error("Error in background compensation detection:", error);
    }
  }, 60000); // Run every minute

  return httpServer;
}
