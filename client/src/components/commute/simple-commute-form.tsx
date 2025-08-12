import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StationSearch } from '@/components/ui/station-search';
import { Clock, Train, MapPin, Check, Edit, Plus, Trash2, Eye, Bell } from 'lucide-react';
import type { CommuteRoute } from '@shared/schema';

interface SimpleCommuteForm {
  // Step 1: Name
  name: string;
  // Step 2-3: From/To
  origin: { id: string; name: string } | null;
  destination: { id: string; name: string } | null;
  // Step 4-5: Time type and time
  timeType: 'depart' | 'arrive';
  departureTime: string;
  // Step 6: Active days
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  // Step 7-8: Journey selection
  selectedJourney: any | null;
  // Step 9: Edit journey
  editedJourney: any | null;
}

export function SimpleCommuteForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<SimpleCommuteForm>({
    name: '',
    origin: null,
    destination: null,
    timeType: 'depart',
    departureTime: '08:00',
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    selectedJourney: null,
    editedJourney: null,
  });

  // Fetch existing routes
  const { data: routes = [], isLoading: loadingRoutes, refetch } = useQuery({
    queryKey: ['/api/commute/routes'],
    enabled: !!user,
  }) as { data: CommuteRoute[], isLoading: boolean, refetch: () => void };

  // Fetch journey alternatives when form is complete
  const { data: journeyAlternatives = [], isLoading: loadingJourneys } = useQuery({
    queryKey: ['/api/commute/departure-options', formData.origin?.id, formData.destination?.id, formData.departureTime, formData.timeType],
    queryFn: async () => {
      if (!formData.origin || !formData.destination || !formData.departureTime) return [];
      return await fetch(`/api/commute/departure-options/${formData.origin.id}/${formData.destination.id}/${formData.departureTime}/${formData.timeType}`).then(r => r.json());
    },
    enabled: !!(formData.origin && formData.destination && formData.departureTime && showForm),
    staleTime: 2 * 60 * 1000,
  }) as { data: any[], isLoading: boolean };

  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const formatTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('sv-SE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return 'Invalid';
    }
  };

  const getDuration = (departure: string, arrival: string) => {
    try {
      const depTime = new Date(departure);
      const arrTime = new Date(arrival);
      const duration = Math.round((arrTime.getTime() - depTime.getTime()) / 60000);
      return `${duration} min`;
    } catch {
      return 'N/A';
    }
  };

  // Route validation logic for intelligent editing
  const validateRouteLogic = (legs: any[], legIndex: number, field: 'from' | 'to', station: any) => {
    if (!station) return;
    
    const stationName = station.name.toLowerCase();
    const currentLeg = legs[legIndex];
    
    // Transport mode compatibility validation
    const isMetroStation = stationName.includes('t-bana') || stationName.includes('tunnelbana');
    const isCommuterStation = stationName.includes('station') && !stationName.includes('t-bana');
    const isBusStop = stationName.includes('busstation') || stationName.includes('centrum');
    
    if (currentLeg.kind === 'TRANSIT') {
      const lineNumber = String(currentLeg.line?.number || currentLeg.line || '');
      
      // Metro line validation (10, 11, 13, 14, 17, 18, 19)
      if (['10', '11', '13', '14', '17', '18', '19'].includes(lineNumber)) {
        if (!isMetroStation && field === 'to') {
          toast({
            title: "Transport Mode Warning",
            description: `Line ${lineNumber} is metro - consider selecting a T-bana station`,
            variant: "default"
          });
        }
      }
      
      // Commuter train validation (40-48 series)
      if (['40', '41', '42', '43', '44', '45', '46', '47', '48'].includes(lineNumber)) {
        if (!isCommuterStation && field === 'to') {
          toast({
            title: "Transport Mode Warning", 
            description: `Line ${lineNumber} is commuter train - select a train station`,
            variant: "default"
          });
        }
      }
    }
    
    // Geographic routing validation
    const routingErrors = validateGeographicRouting(legs, legIndex, field, station);
    if (routingErrors.length > 0) {
      toast({
        title: "Routing Warning",
        description: routingErrors[0],
        variant: "default"
      });
    }
    
    // Auto-suggest transfer legs between disconnected stations
    if (field === 'to' && legIndex < legs.length - 1) {
      const nextLeg = legs[legIndex + 1];
      if (nextLeg?.from && nextLeg.from.name !== station.name) {
        const transferDistance = calculateStationDistance(station.name, nextLeg.from.name);
        if (transferDistance > 0.5) { // Need walking connection
          console.log(`Auto-suggesting transfer leg: ${station.name} → ${nextLeg.from.name}`);
        }
      }
    }
  };

  const validateGeographicRouting = (legs: any[], legIndex: number, field: 'from' | 'to', station: any): string[] => {
    const warnings: string[] = [];
    const stationName = station.name;
    
    // Define geographic zones for Stockholm region
    const centralStations = ['Stockholm City', 'T-Centralen', 'Slussen', 'Gamla Stan'];
    const northStations = ['Sundbyberg', 'Solna', 'Märsta', 'Arlanda'];
    const southStations = ['Tumba', 'Södertälje', 'Flemingsberg', 'Huddinge'];
    const westStations = ['Vällingby', 'Bromma', 'Hässelby'];
    const eastStations = ['Nacka', 'Värmdö', 'Östermalm'];
    
    const getZone = (name: string) => {
      if (centralStations.some(s => name.includes(s))) return 'central';
      if (northStations.some(s => name.includes(s))) return 'north';
      if (southStations.some(s => name.includes(s))) return 'south';
      if (westStations.some(s => name.includes(s))) return 'west';
      if (eastStations.some(s => name.includes(s))) return 'east';
      return 'unknown';
    };
    
    const currentZone = getZone(stationName);
    
    // Check for inefficient routing (going opposite direction)
    if (legs.length > 1) {
      const prevStation = legIndex > 0 ? legs[legIndex - 1].to?.name : null;
      const nextStation = legIndex < legs.length - 1 ? legs[legIndex + 1].from?.name : null;
      
      if (prevStation && nextStation) {
        const prevZone = getZone(prevStation);
        const nextZone = getZone(nextStation);
        
        // Detect backtracking (north → south → north pattern)
        if ((prevZone === 'north' && currentZone === 'south' && nextZone === 'north') ||
            (prevZone === 'south' && currentZone === 'north' && nextZone === 'south')) {
          warnings.push(`Inefficient routing detected - consider direct connection`);
        }
      }
    }
    
    return warnings;
  };

  const calculateStationDistance = (station1: string, station2: string): number => {
    // Stockholm transport system distance estimation
    const centralStations = ['Stockholm City', 'T-Centralen', 'Slussen'];
    const suburbanStations = ['Sundbyberg', 'Tumba', 'Märsta', 'Södertälje'];
    
    const isCentral1 = centralStations.some(s => station1.includes(s));
    const isCentral2 = centralStations.some(s => station2.includes(s));
    const isSuburban1 = suburbanStations.some(s => station1.includes(s));
    const isSuburban2 = suburbanStations.some(s => station2.includes(s));
    
    if (isCentral1 && isCentral2) return 0.3; // Central Stockholm stations
    if (isSuburban1 && isSuburban2) return 20; // Far suburban connections
    if ((isCentral1 && isSuburban2) || (isSuburban1 && isCentral2)) return 12; // Central to suburban
    
    return 3; // Default moderate distance
  };

  const getTransportMode = (lineNumber: string): string => {
    const line = String(lineNumber || '');
    if (['10', '11', '13', '14', '17', '18', '19'].includes(line)) return 'Metro';
    if (['40', '41', '42', '43', '44', '45', '46', '47', '48'].includes(line)) return 'Train';
    if (line.length <= 3 && !isNaN(Number(line))) return 'Bus';
    return 'Transport';
  };

  // Route validation indicator component
  const RouteValidationIndicator = ({ leg }: { leg: any }) => {
    const warnings = [];
    
    if (leg.kind === 'TRANSIT') {
      const fromName = leg.from?.name?.toLowerCase() || '';
      const toName = leg.to?.name?.toLowerCase() || '';
      const lineNumber = String(leg.line?.number || leg.line || '');
      
      // Check transport mode compatibility
      if (['10', '11', '13', '14', '17', '18', '19'].includes(lineNumber)) {
        if (!toName.includes('t-bana')) warnings.push('Metro line needs T-bana station');
      }
      if (['40', '41', '42', '43', '44', '45', '46', '47', '48'].includes(lineNumber)) {
        if (!toName.includes('station')) warnings.push('Train line needs train station');
      }
    }
    
    if (warnings.length > 0) {
      return (
        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
          ⚠️ {warnings[0]}
        </div>
      );
    }
    
    return null;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      origin: null,
      destination: null,
      timeType: 'depart',
      departureTime: '08:00',
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      selectedJourney: null,
      editedJourney: null,
    });
  };

  const saveRoute = useMutation({
    mutationFn: async () => {
      const routeData = {
        name: formData.name,
        originAreaId: formData.origin?.id || '',
        originName: formData.origin?.name || '',
        destinationAreaId: formData.destination?.id || '',
        destinationName: formData.destination?.name || '',
        departureTime: formData.departureTime,
        timeType: formData.timeType,
        monday: formData.monday,
        tuesday: formData.tuesday,
        wednesday: formData.wednesday,
        thursday: formData.thursday,
        friday: formData.friday,
        saturday: formData.saturday,
        sunday: formData.sunday,
        notificationsEnabled: true,
        selectedJourney: formData.editedJourney || formData.selectedJourney,
      };
      
      return await apiRequest('POST', '/api/commute/routes', routeData);
    },
    onSuccess: () => {
      toast({
        title: "Commute Route Created!",
        description: "Your route has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/commute/routes'] });
      setShowForm(false);
      resetForm();
    },
  });

  const deleteRoute = useMutation({
    mutationFn: async (routeId: string) => {
      return await apiRequest('DELETE', `/api/commute/routes/${routeId}`);
    },
    onSuccess: () => {
      toast({
        title: "Route Deleted",
        description: "Your commute route has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/commute/routes'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Commute Routes</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your daily commute routes with real-time updates</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Route
          </Button>
        )}
      </div>

      {/* Create Route Form */}
      {showForm && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Create New Commute Route</CardTitle>
            <CardDescription>Fill in all fields step by step to create your route</CardDescription>
          </CardHeader>
      
          <CardContent className="space-y-6">
            {/* Name */}
            <div>
              <Label>Route Name</Label>
              <Input
                placeholder="e.g. Home to Work"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* From/To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StationSearch
                label="From"
                placeholder="Stockholm Central"
                value={formData.origin}
                onChange={(station) => setFormData({ ...formData, origin: station })}
                required
                indicatorColor="bg-green-500"
              />
              <StationSearch
                label="To"
                placeholder="Arlanda Airport"
                value={formData.destination}
                onChange={(station) => setFormData({ ...formData, destination: station })}
                required
                indicatorColor="bg-red-500"
              />
            </div>

            {/* Time Type and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Time Preference</Label>
                <Select 
                  value={formData.timeType} 
                  onValueChange={(value: 'depart' | 'arrive') => setFormData({ ...formData, timeType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="depart">Leave at</SelectItem>
                    <SelectItem value="arrive">Arrive by</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{formData.timeType === 'arrive' ? 'Arrive by' : 'Leave at'}</Label>
                <Select 
                  value={formData.departureTime} 
                  onValueChange={(value) => setFormData({ ...formData, departureTime: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Days */}
            <div>
              <Label className="text-base font-medium mb-4 block">Active Days</Label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { key: 'monday', label: 'Mon' },
                  { key: 'tuesday', label: 'Tue' },
                  { key: 'wednesday', label: 'Wed' },
                  { key: 'thursday', label: 'Thu' },
                  { key: 'friday', label: 'Fri' },
                  { key: 'saturday', label: 'Sat' },
                  { key: 'sunday', label: 'Sun' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center space-y-2">
                    <Switch
                      id={key}
                      checked={formData[key as keyof SimpleCommuteForm] as boolean}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, [key]: checked })
                      }
                    />
                    <Label htmlFor={key} className="text-sm">{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Journey Alternatives */}
            {formData.origin && formData.destination && formData.departureTime && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Journey Alternatives</h3>
                {loadingJourneys ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Loading journey alternatives...</p>
                  </div>
                ) : journeyAlternatives.length > 0 ? (
                  <div className="space-y-3">
                    {journeyAlternatives.slice(0, 5).map((journey: any, index: number) => (
                      <Card 
                        key={journey.id || index} 
                        className={`p-4 cursor-pointer transition-colors ${
                          formData.selectedJourney?.id === journey.id 
                            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => setFormData({ ...formData, selectedJourney: journey })}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">
                                {formatTime(journey.plannedDeparture)} → {formatTime(journey.plannedArrival)}
                              </span>
                            </div>
                            <Badge variant="outline">{getDuration(journey.plannedDeparture, journey.plannedArrival)}</Badge>
                          </div>
                          {formData.selectedJourney?.id === journey.id && (
                            <Check className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="mt-2 flex gap-2">
                          {journey.legs?.map((leg: any, legIndex: number) => (
                            <Badge key={legIndex} variant="secondary">
                              {leg.line} {leg.kind}
                            </Badge>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    {formData.origin && formData.destination ? "No journey alternatives found" : "Complete all fields above to see journey options"}
                  </p>
                )}
              </div>
            )}

            {/* Custom Route Editor */}
            {formData.selectedJourney && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Custom Route Editor
                </h3>
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Customize your selected journey or keep it as is
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFormData({ 
                          ...formData, 
                          editedJourney: formData.editedJourney ? null : { ...formData.selectedJourney }
                        })}
                      >
                        {formData.editedJourney ? 'Cancel Edit' : 'Edit Journey'}
                      </Button>
                    </div>
                    
                    {formData.editedJourney ? (
                      <div className="border-2 border-dashed border-blue-300 p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                        <h4 className="font-medium mb-3">Custom Journey - Modify Your Route</h4>
                        <div className="space-y-3">
                          {formData.editedJourney.legs?.map((leg: any, index: number) => (
                            <div key={index} className="space-y-2 p-3 bg-white dark:bg-gray-800 rounded border">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium flex items-center gap-2">
                                    {leg.line?.number || leg.line} {leg.kind}
                                    {leg.kind === 'TRANSIT' && (
                                      <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                                        {getTransportMode(leg.line?.number || leg.line)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-300">
                                    {leg.from?.name} → {leg.to?.name}
                                  </div>
                                  <RouteValidationIndicator leg={leg} />
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      const newLegs = [...formData.editedJourney.legs];
                                      newLegs.splice(index, 1);
                                      setFormData({
                                        ...formData,
                                        editedJourney: {
                                          ...formData.editedJourney,
                                          legs: newLegs
                                        }
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Station modification controls */}
                              <div className="grid grid-cols-2 gap-3 mt-2">
                                <div>
                                  <Label className="text-xs">From Station</Label>
                                  <StationSearch
                                    label=""
                                    placeholder={leg.from?.name || 'Select station'}
                                    value={{ id: leg.from?.areaId || '', name: leg.from?.name || '' }}
                                    onChange={(station) => {
                                      const newLegs = [...formData.editedJourney.legs];
                                      newLegs[index] = {
                                        ...newLegs[index],
                                        from: { 
                                          areaId: station?.id || '', 
                                          name: station?.name || '' 
                                        }
                                      };
                                      
                                      // Auto-validate route after station change
                                      validateRouteLogic(newLegs, index, 'from', station);
                                      
                                      setFormData({
                                        ...formData,
                                        editedJourney: {
                                          ...formData.editedJourney,
                                          legs: newLegs
                                        }
                                      });
                                    }}
                                    className="h-8"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">To Station</Label>
                                  <StationSearch
                                    label=""
                                    placeholder={leg.to?.name || 'Select station'}
                                    value={{ id: leg.to?.areaId || '', name: leg.to?.name || '' }}
                                    onChange={(station) => {
                                      const newLegs = [...formData.editedJourney.legs];
                                      newLegs[index] = {
                                        ...newLegs[index],
                                        to: { 
                                          areaId: station?.id || '', 
                                          name: station?.name || '' 
                                        }
                                      };
                                      
                                      // Auto-validate route after station change
                                      validateRouteLogic(newLegs, index, 'to', station);
                                      
                                      setFormData({
                                        ...formData,
                                        editedJourney: {
                                          ...formData.editedJourney,
                                          legs: newLegs
                                        }
                                      });
                                    }}
                                    className="h-8"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const newLegs = [...(formData.editedJourney.legs || [])];
                                newLegs.push({
                                  kind: 'TRANSIT',
                                  line: { number: 'Custom', mode: 'BUS' },
                                  from: { name: 'Select station', areaId: '' },
                                  to: { name: 'Select station', areaId: '' }
                                });
                                setFormData({
                                  ...formData,
                                  editedJourney: {
                                    ...formData.editedJourney,
                                    legs: newLegs
                                  }
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Transport
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const newLegs = [...(formData.editedJourney.legs || [])];
                                newLegs.push({
                                  kind: 'WALK',
                                  from: { name: 'Select station', areaId: '' },
                                  to: { name: 'Select station', areaId: '' },
                                  durationMinutes: 5
                                });
                                setFormData({
                                  ...formData,
                                  editedJourney: {
                                    ...formData.editedJourney,
                                    legs: newLegs
                                  }
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Walk
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">Selected Journey</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {formatTime(formData.selectedJourney.plannedDeparture)} → {formatTime(formData.selectedJourney.plannedArrival)}
                        </div>
                        <div className="mt-2 flex gap-2">
                          {formData.selectedJourney.legs?.map((leg: any, legIndex: number) => (
                            <Badge key={legIndex} variant="secondary">
                              {leg.line} {leg.kind}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-between pt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              
              <Button 
                onClick={() => saveRoute.mutate()}
                disabled={saveRoute.isPending || !formData.selectedJourney}
              >
                {saveRoute.isPending ? 'Saving...' : 'Save Route'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Routes */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Commute Routes</h2>
        {loadingRoutes ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading your routes...</p>
          </div>
        ) : routes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Train className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No routes yet</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">Create your first commute route to get started</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Route
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <Card key={route.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium mb-2">{route.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{route.originName} → {route.destinationName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Leave at {route.departureTime}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => 
                          route[day as keyof typeof route] && (
                            <Badge key={day} variant="outline" className="text-xs">
                              {day.slice(0, 3)}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteRoute.mutate(route.id)}
                        disabled={deleteRoute.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}