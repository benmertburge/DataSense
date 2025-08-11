import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Train } from 'lucide-react';

interface Station {
  id: string;
  name: string;
}

interface DepartureOption {
  id: string;
  plannedDeparture: string;
  plannedArrival: string;
  duration: number;
  legs: Array<{
    kind: string;
    line?: string;
    from: { name: string };
    to: { name: string };
  }>;
}

interface DepartureTimeSelectProps {
  origin: Station | null;
  destination: Station | null;
  value: string;
  onChange: (time: string) => void;
}

export default function DepartureTimeSelect({ origin, destination, value, onChange }: DepartureTimeSelectProps) {
  const [baseTime, setBaseTime] = useState(() => {
    const now = new Date();
    const minutes = Math.ceil(now.getMinutes() / 15) * 15; // Round to next 15 minutes
    now.setMinutes(minutes, 0, 0);
    return now.toTimeString().slice(0, 5); // HH:MM format
  });

  // Fetch departure options when origin and destination are selected
  const { data: departureOptions = [], isLoading } = useQuery({
    queryKey: [`/api/commute/departure-options/${origin?.id}/${destination?.id}/${baseTime}`],
    enabled: !!origin?.id && !!destination?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  }) as { data: DepartureOption[], isLoading: boolean };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('sv-SE', { 
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

  const getRouteDescription = (legs: DepartureOption['legs']) => {
    const transitLegs = legs.filter(leg => leg.kind === 'TRANSIT');
    if (transitLegs.length === 0) return '';
    if (transitLegs.length === 1) {
      return `${transitLegs[0].line}`;
    }
    return `${transitLegs.length} transfers`;
  };

  if (!origin || !destination) {
    return (
      <Select disabled>
        <SelectTrigger className="bg-gray-100 dark:bg-gray-800">
          <SelectValue placeholder="Select origin and destination first" />
        </SelectTrigger>
      </Select>
    );
  }

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading departure times...</span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  if (departureOptions.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <SelectValue placeholder="No departures found for this route" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choose departure time">
          {value && (
            <div className="flex items-center gap-2">
              <Train className="h-4 w-4" />
              <span>{value}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {departureOptions.map((option) => {
          const departureTime = formatTime(option.plannedDeparture);
          const arrivalTime = formatTime(option.plannedArrival);
          const duration = formatDuration(option.duration);
          const routeDesc = getRouteDescription(option.legs);
          
          return (
            <SelectItem key={option.id} value={departureTime}>
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col">
                    <div className="font-medium text-sm">
                      {departureTime} → {arrivalTime}
                    </div>
                    <div className="text-xs text-gray-500">
                      {duration} • {routeDesc}
                    </div>
                  </div>
                </div>
                <Clock className="h-3 w-3 text-gray-400 flex-shrink-0 ml-2" />
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}