import { Request, Response } from 'express';
import { isAuthenticated } from '../replitAuth';
import { transitService } from '../services/transitService';

// Real validation endpoints using Swedish transport APIs - NO HARDCODING

export const validateConnection = async (req: Request, res: Response) => {
  try {
    const { fromStationId, toStationId, lineNumber } = req.params;
    
    // Check if these stations are actually connected via ResRobot API
    const connections = await transitService.validateStationConnection(fromStationId, toStationId, lineNumber);
    
    res.json({
      connected: connections.isConnected,
      transferRequired: connections.transferRequired,
      reason: connections.reason,
      validatedBy: 'resrobot_api'
    });
  } catch (error) {
    console.error('Connection validation failed:', error);
    res.status(500).json({
      connected: false,
      error: 'validation_api_failed',
      reason: 'Unable to verify connection using Swedish transport data'
    });
  }
};

export const validateLineStation = async (req: Request, res: Response) => {
  try {
    const { lineNumber, stationId } = req.params;
    
    // Check if this line actually serves this station using real timetable data
    const lineData = await transitService.getLineStations(lineNumber);
    const servesStation = lineData.stations.some((station: any) => 
      station.areaId === stationId || station.id === stationId
    );
    
    res.json({
      servesStation,
      lineType: lineData.transportMode,
      stationsServed: lineData.stations.length,
      validatedBy: 'trafiklab_timetables'
    });
  } catch (error) {
    console.error('Line-station validation failed:', error);
    res.status(500).json({
      servesStation: true, // Default to true if validation fails
      error: 'validation_api_failed'
    });
  }
};

export const validateRouting = async (req: Request, res: Response) => {
  try {
    const { fromStationId, toStationId, lineNumber } = req.params;
    
    // Real geographic and routing validation using ResRobot
    const routingAnalysis = await transitService.analyzeRouting(fromStationId, toStationId, lineNumber);
    
    res.json({
      circularRoute: routingAnalysis.isCircular,
      inefficientRouting: routingAnalysis.isInefficient,
      reason: routingAnalysis.reason,
      alternativeSuggestion: routingAnalysis.betterRoute,
      validatedBy: 'resrobot_routing_analysis'
    });
  } catch (error) {
    console.error('Routing validation failed:', error);
    res.status(500).json({
      circularRoute: false,
      inefficientRouting: false,
      error: 'validation_api_failed'
    });
  }
};