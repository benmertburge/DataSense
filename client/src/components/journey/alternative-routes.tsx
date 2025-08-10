import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AlternativeRoutes() {
  const { data: tripResults } = useQuery({
    queryKey: ['trip-results'],
    enabled: false, // Only get cached data
  }) as { data: { best?: any; alternatives?: any[] } | undefined };

  if (!tripResults?.alternatives || tripResults.alternatives.length === 0) {
    return null;
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const getTotalDuration = (departure: string, arrival: string) => {
    const duration = Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / 60000);
    return `${duration} min`;
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
    if (transitLegs.every(leg => new Date(leg.expectedArrival || leg.plannedArrival) <= new Date(leg.plannedArrival))) {
      return 'Faster';
    }
    return 'Alternative';
  };

  const getRouteStatus = (legs: any[]) => {
    const hasDelays = legs.some(leg => 
      leg.kind === 'TRANSIT' && 
      leg.expectedDeparture && 
      new Date(leg.expectedDeparture) > new Date(leg.plannedDeparture)
    );
    
    return hasDelays ? 'On time' : 'On time';
  };

  return (
    <Card className="shadow-sm border border-gray-200 mb-6">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center">
          <ArrowRight className="text-blue-600 mr-2" />
          Alternative Routes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {tripResults.alternatives.map((route: any, index: number) => (
          <div 
            key={index}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 cursor-pointer transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {getRouteLabel(route.legs)}
                </Badge>
                <span className="text-sm font-medium">
                  {getTotalDuration(route.plannedDeparture, route.expectedArrival || route.plannedArrival)} total
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatTime(route.plannedDeparture)} - {formatTime(route.expectedArrival || route.plannedArrival)}
                </p>
                <p className="text-xs text-green-600">{getRouteStatus(route.legs)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              {route.legs.filter((leg: any) => leg.kind === 'TRANSIT').map((leg: any, legIndex: number, transitLegs: any[]) => (
                <div key={legIndex} className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center"
                      style={{ backgroundColor: leg.line.color || '#666666' }}
                    >
                      {leg.line.number}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{leg.line.name}</span>
                      <span className="text-xs text-gray-500">
                        {leg.from?.name || 'Unknown'} → {leg.to?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  {legIndex < transitLegs.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              ))}
            </div>

            {/* Delay information */}
            {route.delayMinutes > 0 && (
              <div className="mt-2">
                <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                  +{route.delayMinutes} min delay
                </Badge>
              </div>
            )}
          </div>
        ))}
        
        {/* Show main route option */}
        {tripResults.best && (
          <div className="border-2 border-blue-600 rounded-lg p-4 bg-blue-50">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <Badge className="bg-blue-600">
                  Recommended
                </Badge>
                <span className="text-sm font-medium">
                  {getTotalDuration(tripResults.best.plannedDeparture, tripResults.best.expectedArrival || tripResults.best.plannedArrival)} total
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatTime(tripResults.best.plannedDeparture)} - {formatTime(tripResults.best.expectedArrival || tripResults.best.plannedArrival)}
                </p>
                {tripResults.best.delayMinutes > 0 ? (
                  <p className="text-xs text-amber-600">+{tripResults.best.delayMinutes} min delay</p>
                ) : (
                  <p className="text-xs text-green-600">On time</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              {tripResults.best.legs.filter((leg: any) => leg.kind === 'TRANSIT').map((leg: any, legIndex: number, transitLegs: any[]) => (
                <div key={legIndex} className="flex items-center space-x-2">
                  {getModeDisplay(leg.line)}
                  <span className="text-gray-600">{leg.line.name || `${leg.line.mode} ${leg.line.number}`}</span>
                  {legIndex < transitLegs.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
