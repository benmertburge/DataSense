import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Clock, MapPin, Train, Bus, Calendar, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Station {
  id: string;
  name: string;
  type?: string;
}

interface JourneyLeg {
  id: string;
  from: Station;
  to: Station;
  departureTime?: string;
  arrivalTime?: string;
  duration?: number;
  line?: string;
  isValid?: boolean;
  validationError?: string;
}

interface Journey {
  id: string;
  legs: JourneyLeg[];
  totalDuration: number;
  departureTime: string;
  arrivalTime: string;
  isValid: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

// Station selector component for inline editing
function StationSelector({ value, onChange, placeholder }: { 
  value: string; 
  onChange: (station: Station) => void; 
  placeholder: string; 
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: stations = [] } = useQuery({
    queryKey: ['/api/sites/search', query],
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  }) as { data: Station[] };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {isOpen && stations.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-40 overflow-y-auto">
          {stations.slice(0, 10).map(station => (
            <div
              key={station.id}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => {
                onChange(station);
                setQuery(station.name);
                setIsOpen(false);
              }}
            >
              {station.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JourneyPlanner() {
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<Station | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Station | null>(null);
  const [timeType, setTimeType] = useState<'depart' | 'arrive'>('depart');
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  const [selectedDay, setSelectedDay] = useState('monday');
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([]);
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search for origin stations
  const { data: originStations = [] } = useQuery({
    queryKey: ['/api/sites/search', originQuery],
    enabled: originQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  }) as { data: Station[] };

  // Search for destination stations
  const { data: destinationStations = [] } = useQuery({
    queryKey: ['/api/sites/search', destinationQuery],
    enabled: destinationQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  }) as { data: Station[] };

  // Plan journey mutation
  const planJourneyMutation = useMutation({
    mutationFn: async (params: {
      origin: string;
      destination: string;
      timeType: string;
      time: string;
      day: string;
    }): Promise<Journey> => {
      const response = await apiRequest('/api/journey/plan', 'POST', params);
      return response as unknown as Journey;
    },
    onSuccess: (journey: Journey) => {
      setCurrentJourney(journey);
      setJourneyLegs(journey.legs);
      toast({
        title: "Journey Planned",
        description: `Found route with ${journey.legs.length} legs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Planning Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validate leg mutation
  const validateLegMutation = useMutation({
    mutationFn: async (leg: JourneyLeg) => {
      return await apiRequest('/api/journey/validate-leg', 'POST', {
        fromId: leg.from.id,
        toId: leg.to.id,
        day: selectedDay,
        time: leg.departureTime || selectedTime
      });
    },
    onSuccess: (validationResult, leg) => {
      setJourneyLegs(prev => prev.map(l => 
        l.id === leg.id 
          ? { ...l, ...validationResult }
          : l
      ));
    },
  });

  const handlePlanJourney = () => {
    if (!selectedOrigin || !selectedDestination) {
      toast({
        title: "Missing Information",
        description: "Please select both origin and destination",
        variant: "destructive",
      });
      return;
    }

    planJourneyMutation.mutate({
      origin: selectedOrigin.id,
      destination: selectedDestination.id,
      timeType,
      time: selectedTime,
      day: selectedDay
    });
  };

  const addIntermediateStop = () => {
    if (journeyLegs.length === 0) return;
    
    // Insert a new leg before the final destination
    const lastLeg = journeyLegs[journeyLegs.length - 1];
    const secondLastLeg = journeyLegs.length > 1 ? journeyLegs[journeyLegs.length - 2] : null;
    
    const newLeg: JourneyLeg = {
      id: `leg-${Date.now()}`,
      from: secondLastLeg ? secondLastLeg.to : journeyLegs[0].from,
      to: { id: '', name: 'Select intermediate station', type: 'station' },
      isValid: false
    };
    
    // Update the last leg to start from the new intermediate stop
    const updatedLastLeg = {
      ...lastLeg,
      from: newLeg.to
    };
    
    setJourneyLegs(prev => [...prev.slice(0, -1), newLeg, updatedLastLeg]);
  };

  const removeLeg = (legId: string) => {
    setJourneyLegs(prev => prev.filter(leg => leg.id !== legId));
  };

  const updateLegDestination = (legId: string, newDestination: Station) => {
    setJourneyLegs(prev => {
      const legIndex = prev.findIndex(leg => leg.id === legId);
      if (legIndex === -1) return prev;
      
      const updatedLegs = [...prev];
      updatedLegs[legIndex] = { ...updatedLegs[legIndex], to: newDestination, isValid: false };
      
      // Update the next leg's origin if it exists
      if (legIndex + 1 < updatedLegs.length) {
        updatedLegs[legIndex + 1] = { ...updatedLegs[legIndex + 1], from: newDestination, isValid: false };
      }
      
      return updatedLegs;
    });
  };

  const updateLegOrigin = (legId: string, newOrigin: Station) => {
    setJourneyLegs(prev => {
      const legIndex = prev.findIndex(leg => leg.id === legId);
      if (legIndex === -1) return prev;
      
      const updatedLegs = [...prev];
      updatedLegs[legIndex] = { ...updatedLegs[legIndex], from: newOrigin, isValid: false };
      
      // Update the previous leg's destination if it exists
      if (legIndex > 0) {
        updatedLegs[legIndex - 1] = { ...updatedLegs[legIndex - 1], to: newOrigin, isValid: false };
      }
      
      return updatedLegs;
    });
  };

  const validateAllLegs = () => {
    journeyLegs.forEach(leg => {
      validateLegMutation.mutate(leg);
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Journey Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Origin Selection */}
          <div className="space-y-2">
            <Label>From</Label>
            <Input
              value={originQuery}
              onChange={(e) => setOriginQuery(e.target.value)}
              placeholder="Search origin station..."
            />
            {originStations.length > 0 && !selectedOrigin && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {originStations.slice(0, 10).map(station => (
                  <div
                    key={station.id}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => {
                      setSelectedOrigin(station);
                      setOriginQuery(station.name);
                    }}
                  >
                    {station.name}
                  </div>
                ))}
              </div>
            )}
            {selectedOrigin && (
              <Badge variant="secondary" className="w-fit">
                {selectedOrigin.name}
              </Badge>
            )}
          </div>

          {/* Destination Selection */}
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              value={destinationQuery}
              onChange={(e) => setDestinationQuery(e.target.value)}
              placeholder="Search destination station..."
            />
            {destinationStations.length > 0 && !selectedDestination && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {destinationStations.slice(0, 10).map(station => (
                  <div
                    key={station.id}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => {
                      setSelectedDestination(station);
                      setDestinationQuery(station.name);
                    }}
                  >
                    {station.name}
                  </div>
                ))}
              </div>
            )}
            {selectedDestination && (
              <Badge variant="secondary" className="w-fit">
                {selectedDestination.name}
              </Badge>
            )}
          </div>

          {/* Time and Day Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Travel Type</Label>
              <Select value={timeType} onValueChange={(value: 'depart' | 'arrive') => setTimeType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depart">Leave at</SelectItem>
                  <SelectItem value="arrive">Arrive by</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handlePlanJourney}
            disabled={!selectedOrigin || !selectedDestination || planJourneyMutation.isPending}
            className="w-full"
          >
            {planJourneyMutation.isPending ? 'Planning...' : 'Plan Journey'}
          </Button>
        </CardContent>
      </Card>

      {/* Journey Legs */}
      {journeyLegs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Train className="h-5 w-5" />
              Journey Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {journeyLegs.map((leg, index) => (
              <div key={leg.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={leg.isValid ? "default" : "destructive"}>
                      Leg {index + 1}
                    </Badge>
                    {leg.line && (
                      <Badge variant="outline">
                        {leg.line}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => validateLegMutation.mutate(leg)}
                      disabled={validateLegMutation.isPending}
                    >
                      Validate
                    </Button>
                    {journeyLegs.length > 1 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeLeg(leg.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">From</Label>
                    {leg.from.name === 'Select intermediate station' ? (
                      <StationSelector
                        value=""
                        onChange={(station) => updateLegOrigin(leg.id, station)}
                        placeholder="Select origin station..."
                      />
                    ) : (
                      <div className="font-medium">{leg.from.name}</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">To</Label>
                    {leg.to.name === 'Select intermediate station' ? (
                      <StationSelector
                        value=""
                        onChange={(station) => updateLegDestination(leg.id, station)}
                        placeholder="Select destination station..."
                      />
                    ) : (
                      <div className="font-medium">{leg.to.name}</div>
                    )}
                  </div>
                </div>

                {leg.departureTime && leg.arrivalTime && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Departure</Label>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {leg.departureTime}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Arrival</Label>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {leg.arrivalTime}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Duration</Label>
                      <div>{leg.duration} min</div>
                    </div>
                  </div>
                )}

                {leg.validationError && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Error: {leg.validationError}
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <Button onClick={addIntermediateStop} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
              <Button onClick={validateAllLegs} variant="outline">
                Validate All Legs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Journey Summary */}
      {currentJourney && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Journey Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Departure</Label>
                <div className="text-lg font-semibold">{currentJourney.departureTime}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Arrival</Label>
                <div className="text-lg font-semibold">{currentJourney.arrivalTime}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Total Duration</Label>
                <div className="text-lg font-semibold">{currentJourney.totalDuration} min</div>
              </div>
            </div>
            <div className="mt-4">
              <Badge variant={currentJourney.isValid ? "default" : "destructive"}>
                {currentJourney.isValid ? "Valid Journey" : "Needs Validation"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}