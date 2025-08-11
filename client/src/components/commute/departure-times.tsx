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

interface Departure {
  time: string;
  realTime?: string;
  platform?: string;
  line: string;
  destination: string;
  delay: number;
  cancelled: boolean;
}

export function DepartureTimes({ route, onClose }: DepartureTimesProps) {
  const today = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[today.getDay()];

  // Get real-time departures for this route
  const { data: departures = [], isLoading } = useQuery({
    queryKey: ['/api/commute/departures', route.originAreaId, currentDay],
    enabled: !!route.originAreaId,
    refetchInterval: 60000, // Refresh every minute
  }) as { data: Departure[], isLoading: boolean };

  const getStatusBadge = (departure: Departure) => {
    if (departure.cancelled) {
      return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
    }
    if (departure.delay > 0) {
      return <Badge variant="destructive" className="text-xs">+{departure.delay}min</Badge>;
    }
    if (departure.delay < 0) {
      return <Badge variant="secondary" className="text-xs">{departure.delay}min</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">On time</Badge>;
  };

  const getTimeColor = (departure: Departure) => {
    if (departure.cancelled) return 'text-red-600 dark:text-red-400';
    if (departure.delay > 0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Train className="h-5 w-5" />
            Departures - {route.originName || route.originAreaId}
          </CardTitle>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            ×
          </button>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          To: {route.destinationName || route.destinationAreaId} • Preferred: {route.departureTime}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading departures...</span>
          </div>
        ) : departures.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No departures found for today</p>
            <p className="text-sm mt-1">Check if this route operates on {currentDay}s</p>
          </div>
        ) : (
          <div className="space-y-3">
            {departures.map((departure, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`text-lg font-bold ${getTimeColor(departure)}`}>
                      {departure.realTime || departure.time}
                    </div>
                    {departure.realTime && departure.realTime !== departure.time && (
                      <div className="text-xs text-gray-500 line-through">
                        {departure.time}
                      </div>
                    )}
                  </div>
                  
                  <Separator orientation="vertical" className="h-8" />
                  
                  <div className="flex flex-col">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {departure.line} to {departure.destination}
                    </div>
                    {departure.platform && (
                      <div className="text-sm text-gray-500">
                        Platform {departure.platform}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(departure)}
                  {departure.cancelled ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : departure.delay === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  )}
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