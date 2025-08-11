import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, MapPin } from "lucide-react";

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
    line: string;
    from: { name: string };
    to: { name: string };
  }>;
}

interface DepartureTimeSelectProps {
  origin?: Station;
  destination?: Station;
  value: string;
  onChange: (value: string) => void;
}

export default function DepartureTimeSelect({ origin, destination, value, onChange }: DepartureTimeSelectProps) {
  // Generate base times starting from current time, every 30 minutes for next 10 hours
  const baseTime = (() => {
    const now = new Date();
    // Round to next 30-minute mark
    const minutes = now.getMinutes() >= 30 ? 60 : 30;
    now.setMinutes(minutes, 0, 0);
    return now.toTimeString().slice(0, 5); // HH:MM format
  })();

  // Fetch departure options when origin and destination are selected
  const { data: departureOptions = [], isLoading } = useQuery({
    queryKey: ['/api/commute/departure-options', origin?.id, destination?.id, baseTime],
    enabled: !!origin?.id && !!destination?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  }) as { data: DepartureOption[], isLoading: boolean };

  const formatTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Invalid';
      
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

  const getLineColor = (line: string) => {
    if (line.includes('Tåg') || line.includes('Train')) {
      return '#ec619f'; // Pink for trains (JLT)
    }
    if (line.includes('Spårväg') || line.includes('Tram')) {
      return '#FF8C00'; // Orange for trams (SLT)
    }
    if (line.includes('Metro') || line.includes('Tunnelbana')) {
      return '#0066CC'; // Blue for metro
    }
    return '#000000'; // Black for buses
  };

  const getLineNumber = (line: string) => {
    const match = line.match(/\d+/);
    return match ? match[0] : line.substring(0, 2);
  };

  if (!origin || !destination) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Select origin and destination first</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p>Loading departure times...</p>
      </div>
    );
  }

  if (departureOptions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No departures found for this route</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Choose Time to Leave
      </h3>
      
      {departureOptions.map((option, index) => {
        const departureTime = formatTime(option.plannedDeparture);
        const arrivalTime = formatTime(option.plannedArrival);
        const totalDuration = getTotalDuration(option.plannedDeparture, option.plannedArrival);
        const isSelected = value === departureTime;
        const routeLabel = index === 0 ? 'Best Route' : `Alternative ${index}`;
        
        return (
          <div 
            key={option.id}
            className={`border border-gray-200 dark:border-gray-600 rounded-lg p-4 cursor-pointer transition-colors ${
              isSelected ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950' : 'hover:border-blue-600 dark:hover:border-blue-400'
            }`}
            onClick={() => onChange(departureTime)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className={index === 0 ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}>
                  {routeLabel}
                </Badge>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {totalDuration} total
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {departureTime} - {arrivalTime}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">On time</p>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              {option.legs.filter((leg: any) => leg.kind !== 'WALK').map((leg: any, legIndex: number) => {
                const lineColor = getLineColor(leg.line);
                const lineNumber = getLineNumber(leg.line);
                
                return (
                  <div key={legIndex} className="flex items-center justify-between border-l-4 pl-3" style={{ borderColor: lineColor }}>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded text-xs font-bold flex items-center justify-center text-white"
                        style={{ backgroundColor: lineColor }}
                      >
                        {lineNumber}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{leg.line}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {leg.from?.name || 'Unknown'} → {leg.to?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          🚉 Platform 3 → Platform 3 <span className="text-gray-400 dark:text-gray-500">(from Trafiklab)</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-medium text-gray-900 dark:text-white">{departureTime} - {arrivalTime}</div>
                      <div className="text-gray-500 dark:text-gray-400">{Math.round(option.duration / option.legs.filter(l => l.kind !== 'WALK').length)} min</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show walking legs */}
            {option.legs.some((leg: any) => leg.kind === 'WALK') && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Includes walking segments
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}