import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AlternativeRoutes() {
  const { data: tripResults } = useQuery({
    queryKey: ['trip-results'],
    enabled: true, // Enable to show cached search results
  }) as { data: any[] | undefined };

  // Check if we have an array of routes from the API
  if (!tripResults || !Array.isArray(tripResults) || tripResults.length === 0) {
    return null;
  }

  // API returns an array of itineraries directly
  const allRoutes = tripResults.map((route, index) => ({
    ...route,
    label: index === 0 ? 'Best Route' : `Alternative ${index}`
  }));

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A';
    try {
      // Handle both ISO format and simple time format
      let date: Date;
      if (timeString.includes('T')) {
        // Local format: "2025-08-11T08:32:00" (already Swedish local time)
        date = new Date(timeString);
      } else if (timeString.includes(':')) {
        // Simple time format: "08:32:00"
        const [hours, minutes] = timeString.split(':');
        date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        date = new Date(timeString);
      }
      
      if (isNaN(date.getTime())) return 'Invalid';
      
      // Return time in Swedish format HH:mm
      return date.toLocaleTimeString('sv-SE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return 'Invalid';
    }
  };

  const getTotalDuration = (departure: string, arrival: string) => {
    try {
      const depTime = new Date(departure);
      const arrTime = new Date(arrival);
      if (isNaN(depTime.getTime()) || isNaN(arrTime.getTime())) {
        return 'N/A';
      }
      const duration = Math.round((arrTime.getTime() - depTime.getTime()) / 60000);
      return `${duration} min`;
    } catch {
      return 'N/A';
    }
  };

  const getModeDisplay = (line: any) => {
    const modeColors = {
      METRO: 'bg-blue-600',
      TRAIN: 'bg-green-600',
      BUS: 'bg-orange-500',
      TRAM: 'bg-purple-600',
    };
    
    const colorClass = modeColors[line.mode as keyof typeof modeColors] || 'bg-gray-500';
    
    return (
      <span className={`${colorClass} text-white px-2 py-1 rounded text-xs font-bold`}>
        {line.number}
      </span>
    );
  };

  const getRouteLabel = (legs: any[]) => {
    const transitLegs = legs.filter(leg => leg.kind === 'TRANSIT');
    if (transitLegs.length === 1) {
      return 'Direct';
    }
    return 'With transfer';
  };

  const getRouteStatus = (legs: any[]) => {
    const hasDelays = legs.some(leg => 
      leg.kind === 'TRANSIT' && 
      leg.expectedDeparture && 
      new Date(leg.expectedDeparture) > new Date(leg.plannedDeparture)
    );
    
    return hasDelays ? 'Delayed' : 'On time';
  };

  return (
    <Card className="shadow-sm border border-gray-200 mb-6">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center">
          <ArrowRight className="text-blue-600 mr-2" />
          Journey Options ({allRoutes.length} found)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {allRoutes.map((route: any, index: number) => (
          <div 
            key={route.id || index}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className={index === 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>
                  {route.label}
                </Badge>
                <span className="text-sm font-medium">
                  {getTotalDuration(route.plannedDeparture, route.plannedArrival)} total
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatTime(route.plannedDeparture)} - {formatTime(route.plannedArrival)}
                </p>
                <p className="text-xs text-green-600">{getRouteStatus(route.legs)}</p>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              {route.legs.filter((leg: any) => leg.kind === 'TRANSIT').map((leg: any, legIndex: number, transitLegs: any[]) => (
                <div key={legIndex} className="flex items-center justify-between border-l-4 pl-3" style={{ borderColor: leg.line.color || '#666666' }}>
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded text-white text-xs font-bold flex items-center justify-center"
                      style={{ backgroundColor: leg.line.color || '#666666' }}
                    >
                      {leg.line.number}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{leg.line.name}</span>
                      <span className="text-xs text-gray-500">
                        {leg.from?.name || 'Unknown'} → {leg.to?.name || 'Unknown'}
                      </span>
                      {(leg.from?.platform || leg.to?.platform) && (
                        <span className="text-xs text-blue-600">
                          {leg.from?.platform && `Platform ${leg.from.platform}`}
                          {leg.from?.platform && leg.to?.platform && ' → '}
                          {leg.to?.platform && `Platform ${leg.to.platform}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-medium">{formatTime(leg.plannedDeparture)} - {formatTime(leg.plannedArrival)}</div>
                    <div className="text-gray-500">{getTotalDuration(leg.plannedDeparture, leg.plannedArrival)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Show walking legs */}
            {route.legs.some((leg: any) => leg.kind === 'WALK') && (
              <div className="mt-2 text-xs text-gray-500">
                Includes walking segments
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}