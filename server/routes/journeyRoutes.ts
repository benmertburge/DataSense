import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { TransitService } from "../services/transitService";

const transitService = new TransitService();

export function registerJourneyRoutes(app: Express) {
  // Plan a journey with proper leg validation
  app.post('/api/journey/plan', isAuthenticated, async (req, res) => {
    try {
      const { origin, destination, timeType, time, day } = req.body;
      
      if (!origin || !destination || !timeType || !time || !day) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      console.log(`JOURNEY PLANNING: ${origin} to ${destination}, ${timeType} at ${time} on ${day}`);

      // Create date object for the selected day and time
      const now = new Date();
      const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day.toLowerCase());
      const daysUntilTarget = (dayIndex - now.getDay() + 7) % 7;
      
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysUntilTarget);
      const [hours, minutes] = time.split(':').map(Number);
      targetDate.setHours(hours, minutes, 0, 0);

      // Use ResRobot Trip API for proper journey planning
      const journeys = await transitService.searchTrips(origin, destination, targetDate, timeType === 'depart');
      
      if (journeys.length === 0) {
        // Try alternative approach - search for any connections and suggest intermediate stops
        console.log(`NO DIRECT ROUTE: Attempting to find alternative connections for ${origin} to ${destination}`);
        
        // Try searching common intermediate stations (Stockholm Central, Södra, etc.)
        const commonStops = ['740000001', '740000003', '740000002']; // Stockholm Central, Södra, Uppsala
        
        for (const intermediateStop of commonStops) {
          try {
            const leg1 = await transitService.searchTrips(origin, intermediateStop, targetDate, timeType === 'depart');
            if (leg1.length > 0) {
              // Found connection to intermediate stop, suggest this route
              const suggestedJourney = {
                id: `suggested-${Date.now()}`,
                legs: [{
                  id: 'leg-0',
                  from: { id: origin, name: 'Origin', type: 'station' },
                  to: { id: intermediateStop, name: 'Intermediate Stop', type: 'station' },
                  departureTime: new Date(leg1[0].plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                  arrivalTime: new Date(leg1[0].plannedArrival).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                  duration: Math.round((new Date(leg1[0].plannedArrival).getTime() - new Date(leg1[0].plannedDeparture).getTime()) / 60000),
                  line: leg1[0].legs[0].kind === 'TRANSIT' ? (leg1[0].legs[0] as any).line?.name : 'Multiple',
                  isValid: true
                }, {
                  id: 'leg-1',
                  from: { id: intermediateStop, name: 'Intermediate Stop', type: 'station' },
                  to: { id: destination, name: 'Destination', type: 'station' },
                  isValid: false,
                  validationError: 'Please validate this connection'
                }],
                totalDuration: Math.round((new Date(leg1[0].plannedArrival).getTime() - new Date(leg1[0].plannedDeparture).getTime()) / 60000),
                departureTime: new Date(leg1[0].plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: 'Unknown',
                isValid: false,
                needsValidation: true
              };
              
              return res.json(suggestedJourney);
            }
          } catch (error) {
            continue; // Try next intermediate stop
          }
        }
        
        return res.status(404).json({ 
          message: 'No direct route found. Try adding intermediate stops like Stockholm Central or Södra.',
          suggestions: ['Stockholm Central', 'Södra station', 'Uppsala Central']
        });
      }

      // Take the best journey and convert to modular leg format
      const bestJourney = journeys[0];
      
      const legs = bestJourney.legs.map((leg, index) => {
        if (leg.kind === 'TRANSIT') {
          const transitLeg = leg as any;
          return {
            id: `leg-${index}`,
            from: {
              id: transitLeg.from?.id || `stop-${index}`,
              name: transitLeg.from?.name || 'Unknown',
              type: transitLeg.from?.type || 'station'
            },
            to: {
              id: transitLeg.to?.id || `stop-${index + 1}`,
              name: transitLeg.to?.name || 'Unknown',
              type: transitLeg.to?.type || 'station'
            },
            departureTime: new Date(transitLeg.plannedDeparture || Date.now()).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
            arrivalTime: new Date(transitLeg.plannedArrival || Date.now()).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
            duration: Math.round((new Date(transitLeg.plannedArrival || Date.now()).getTime() - new Date(transitLeg.plannedDeparture || Date.now()).getTime()) / 60000),
            line: transitLeg.line?.name || 'Unknown Line',
            isValid: true
          };
        } else {
          // Walking leg
          return {
            id: `leg-${index}`,
            from: {
              id: `walk-${index}`,
              name: 'Walking',
              type: 'walk'
            },
            to: {
              id: `walk-${index + 1}`,
              name: 'Walking',
              type: 'walk'
            },
            departureTime: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
            arrivalTime: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
            duration: 5, // Estimate 5 minutes for walking
            line: 'Walking',
            isValid: true
          };
        }
      });

      const journey = {
        id: `journey-${Date.now()}`,
        legs,
        totalDuration: Math.round((new Date(bestJourney.plannedArrival).getTime() - new Date(bestJourney.plannedDeparture).getTime()) / 60000),
        departureTime: new Date(bestJourney.plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
        arrivalTime: new Date(bestJourney.plannedArrival).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
        isValid: true
      };

      console.log(`JOURNEY SUCCESS: Planned ${legs.length} legs, ${journey.totalDuration} minutes total`);
      res.json(journey);
    } catch (error) {
      console.error('Journey planning error:', error);
      res.status(500).json({ message: 'Failed to plan journey', error: (error as Error).message });
    }
  });

  // Validate individual leg
  app.post('/api/journey/validate-leg', isAuthenticated, async (req, res) => {
    try {
      const { fromId, toId, day, time } = req.body;
      
      if (!fromId || !toId || !day || !time) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      console.log(`LEG VALIDATION: ${fromId} to ${toId} on ${day} at ${time}`);

      // Create date object for validation
      const now = new Date();
      const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day.toLowerCase());
      const daysUntilTarget = (dayIndex - now.getDay() + 7) % 7;
      
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysUntilTarget);
      const [hours, minutes] = time.split(':').map(Number);
      targetDate.setHours(hours, minutes, 0, 0);

      try {
        // Try to find a direct connection
        const journeys = await transitService.searchTrips(fromId, toId, targetDate, true);
        
        if (journeys.length === 0) {
          // Check if we can suggest a better intermediate stop
          const commonStops = [
            { id: '740000001', name: 'Stockholm Central' },
            { id: '740000003', name: 'Södra station' },
            { id: '740000002', name: 'Uppsala Central' }
          ];
          
          for (const stop of commonStops) {
            try {
              const testJourney = await transitService.searchTrips(fromId, stop.id, targetDate, true);
              if (testJourney.length > 0) {
                return res.json({
                  isValid: false,
                  validationError: `No direct connection found. Try connecting via ${stop.name}`,
                  suggestedIntermediate: stop
                });
              }
            } catch (error) {
              continue;
            }
          }
          
          return res.json({
            isValid: false,
            validationError: `No connection found between these stations on ${day}s at ${time}. Check station names or try different intermediate stops.`
          });
        }

        const bestJourney = journeys[0];
        const firstLeg = bestJourney.legs[0];

        return res.json({
          isValid: true,
          departureTime: new Date(bestJourney.plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
          arrivalTime: new Date(bestJourney.plannedArrival).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
          duration: Math.round((new Date(bestJourney.plannedArrival).getTime() - new Date(bestJourney.plannedDeparture).getTime()) / 60000),
          line: firstLeg.kind === 'TRANSIT' ? (firstLeg as any).line?.name : 'Multiple connections',
          validationError: null
        });

      } catch (error) {
        console.error(`LEG VALIDATION ERROR: ${fromId} to ${toId}:`, error);
        return res.json({
          isValid: false,
          validationError: `Connection validation failed: ${(error as Error).message}`
        });
      }
    } catch (error) {
      console.error('Leg validation error:', error);
      res.status(500).json({ message: 'Failed to validate leg', error: (error as Error).message });
    }
  });

  // Get optimal times for a specific leg
  app.post('/api/journey/optimize-leg', isAuthenticated, async (req, res) => {
    try {
      const { fromId, toId, day, timeRange } = req.body;
      
      if (!fromId || !toId || !day) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      console.log(`LEG OPTIMIZATION: Finding best times for ${fromId} to ${toId} on ${day}`);

      const now = new Date();
      const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day.toLowerCase());
      const daysUntilTarget = (dayIndex - now.getDay() + 7) % 7;
      
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysUntilTarget);

      const options = [];
      
      // Check multiple times throughout the day
      for (let hour = 6; hour <= 22; hour += 2) {
        try {
          const testDate = new Date(targetDate);
          testDate.setHours(hour, 0, 0, 0);
          
          const journeys = await transitService.searchTrips(fromId, toId, testDate, true);
          
          if (journeys.length > 0) {
            const journey = journeys[0];
            options.push({
              departureTime: new Date(journey.plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
              arrivalTime: new Date(journey.plannedArrival).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
              duration: Math.round((new Date(journey.plannedArrival).getTime() - new Date(journey.plannedDeparture).getTime()) / 60000),
              line: journey.legs[0].kind === 'TRANSIT' ? (journey.legs[0] as any).line?.name : 'Multiple'
            });
          }
        } catch (error) {
          // Skip this time slot if no connection
          continue;
        }
      }

      console.log(`LEG OPTIMIZATION SUCCESS: Found ${options.length} time options`);
      res.json({ options });
    } catch (error) {
      console.error('Leg optimization error:', error);
      res.status(500).json({ message: 'Failed to optimize leg', error: (error as Error).message });
    }
  });
}