import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Train, AlertTriangle, CheckCircle } from 'lucide-react';
import type { CommuteRoute } from '@shared/schema';

interface DepartureTimesProps {
  route: CommuteRoute;
  onClose: () => void;
}

interface JourneyOption {
  id: string;
  legs: JourneyLeg[];
  plannedDeparture: string;
  plannedArrival: string;
  expectedDeparture?: string;
  expectedArrival?: string;
  duration: number;
  totalDelay: number;
  hasCancellations: boolean;
}

interface JourneyLeg {
  kind: 'TRANSIT' | 'WALK';
  line?: string;
  from: { name: string; platform?: string };
  to: { name: string; platform?: string };
  plannedDeparture: string;
  plannedArrival: string;
  expectedDeparture?: string;
  expectedArrival?: string;
  delay: number;
  cancelled: boolean;
  mode?: string;
}

export function DepartureTimes({ route, onClose }: DepartureTimesProps) {
  const today = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[today.getDay()];

  // Get journey options for this commute route
  const { data: journeyOptions = [], isLoading } = useQuery({
    queryKey: ['/api/commute/journeys', route.originAreaId, route.destinationAreaId, route.departureTime],
    enabled: !!route.originAreaId && !!route.destinationAreaId,
    refetchInterval: 60000, // Refresh every minute
  }) as { data: JourneyOption[], isLoading: boolean };

  const getJourneyStatusBadge = (journey: JourneyOption) => {
    if (journey.hasCancellations) {
      return <Badge variant="destructive" className="text-xs">Disrupted</Badge>;
    }
    if (journey.totalDelay > 10) {
      return <Badge variant="destructive" className="text-xs">+{journey.totalDelay}min</Badge>;
    }
    if (journey.totalDelay > 0) {
      return <Badge variant="secondary" className="text-xs">+{journey.totalDelay}min</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">On time</Badge>;
  };

  const getJourneyTimeColor = (journey: JourneyOption) => {
    if (journey.hasCancellations) return 'text-red-600 dark:text-red-400';
    if (journey.totalDelay > 10) return 'text-red-600 dark:text-red-400';
    if (journey.totalDelay > 0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Train className="h-5 w-5" />
            Journey Options - {route.name}
          </CardTitle>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            ×
          </button>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          From: {route.originName} • To: {route.destinationName} • Leave at: {route.departureTime}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading journey options...</span>
          </div>
        ) : journeyOptions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No journey options found</p>
            <p className="text-sm mt-1">Check if this route operates on {currentDay}s</p>
          </div>
        ) : (
          <div className="space-y-4">
            {journeyOptions.map((journey, index) => (
              <div key={index} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {/* Journey overview */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className={`text-lg font-bold ${getJourneyTimeColor(journey)}`}>
                        {formatTime(journey.expectedDeparture || journey.plannedDeparture)} → {formatTime(journey.expectedArrival || journey.plannedArrival)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDuration(journey.duration + journey.totalDelay)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getJourneyStatusBadge(journey)}
                    {journey.hasCancellations ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : journey.totalDelay === 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>

                {/* Journey legs */}
                <div className="space-y-2">
                  {journey.legs.filter(leg => leg.kind === 'TRANSIT').map((leg, legIndex) => (
                    <div key={legIndex} className="flex items-center gap-3 text-sm">
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0"></div>
                      <div className="flex-grow">
                        <div className="font-medium">
                          {leg.line} from {leg.from.name} to {leg.to.name}
                        </div>
                        <div className="text-gray-500 flex items-center gap-2">
                          <span>{formatTime(leg.expectedDeparture || leg.plannedDeparture)} - {formatTime(leg.expectedArrival || leg.plannedArrival)}</span>
                          {leg.from.platform && <span>Platform {leg.from.platform}</span>}
                          {leg.delay > 0 && <span className="text-yellow-600">+{leg.delay}min</span>}
                          {leg.cancelled && <span className="text-red-600">Cancelled</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Last updated: {new Date().toLocaleTimeString()}
            <br />
            Updates automatically every minute
          </div>
        </div>
      </CardContent>
    </Card>
  );
}