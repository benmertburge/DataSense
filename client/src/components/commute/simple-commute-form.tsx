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
    queryKey: ['/api/commute/departure-options', formData.origin?.id, formData.destination?.id, formData.departureTime],
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