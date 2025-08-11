import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StationSearch } from '@/components/ui/station-search';
import DepartureTimeSelect from './departure-time-select';
import { 
  Plus, 
  Train, 
  Clock, 
  MapPin, 
  Calendar, 
  Bell, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Settings,
  Route,
  Eye
} from 'lucide-react';
import type { CommuteRoute } from '@shared/schema';

interface JourneyLeg {
  id: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  departureTime?: string;
  arrivalTime?: string;
  duration?: number;
  line?: string;
  isValid?: boolean;
  validationError?: string;
}

interface CommuteRouteForm {
  name: string;
  origin: { id: string; name: string } | null;
  destination: { id: string; name: string } | null;
  departureTime: string;
  timeType: 'depart' | 'arrive';
  selectedDay: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  notificationsEnabled: boolean;
  journeyLegs: JourneyLeg[];
  isModular: boolean;
}

export function CommuteManager() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CommuteRoute | null>(null);
  const [showDepartures, setShowDepartures] = useState<CommuteRoute | null>(null);
  const [formData, setFormData] = useState<CommuteRouteForm>({
    name: '',
    origin: null,
    destination: null,
    departureTime: '',
    timeType: 'depart',
    selectedDay: 'monday',
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
    notificationsEnabled: true,
    journeyLegs: [],
    isModular: false,
  });

  // Fetch commute routes
  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/commute/routes'],
    enabled: !!user,
  }) as { data: CommuteRoute[], isLoading: boolean, refetch: () => void };

  // Create commute route mutation
  const createRouteMutation = useMutation({
    mutationFn: async (data: CommuteRouteForm) => {
      // Transform form data to match API expectations
      const apiData = {
        name: data.name,
        originAreaId: data.origin?.id || '',
        originName: data.origin?.name || '',
        destinationAreaId: data.destination?.id || '',
        destinationName: data.destination?.name || '',
        departureTime: data.departureTime,
        monday: data.monday,
        tuesday: data.tuesday,
        wednesday: data.wednesday,
        thursday: data.thursday,
        friday: data.friday,
        saturday: data.saturday,
        sunday: data.sunday,
        notificationsEnabled: data.notificationsEnabled,

      };
      const response = await apiRequest('POST', '/api/commute/routes', apiData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Commute Route Created",
        description: "Your daily commute route has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/commute/routes'] });
      setShowForm(false);
      resetForm();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Create Route",
        description: "Could not save your commute route. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update commute route mutation
  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CommuteRouteForm> }) => {
      const response = await apiRequest('PUT', `/api/commute/routes/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Route Updated",
        description: "Your commute route has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/commute/routes'] });
      setEditingRoute(null);
      setShowForm(false);
      resetForm();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Update Route",
        description: "Could not update your commute route. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete commute route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/commute/routes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Route Deleted",
        description: "Your commute route has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/commute/routes'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Delete Route",
        description: "Could not delete your commute route. Please try again.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      origin: null,
      destination: null,
      departureTime: '',
      timeType: 'depart',
      selectedDay: 'monday',
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
      notificationsEnabled: true,
      journeyLegs: [],
      isModular: false,
    });
  };

  // Modular journey functions
  const createJourney = async () => {
    if (!formData.origin || !formData.destination) {
      toast({
        title: "Missing Information",
        description: "Please select both origin and destination stations",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('STARTING JOURNEY CREATION:', {
        origin: formData.origin.id,
        destination: formData.destination.id,
        time: formData.departureTime,
        timeType: formData.timeType,
        day: formData.selectedDay
      });

      const journeyData = {
        origin: formData.origin.id,
        destination: formData.destination.id,
        time: formData.departureTime,
        timeType: formData.timeType,
        day: formData.selectedDay
      };

      const response = await fetch('/api/journey/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(journeyData),
        credentials: 'include'
      });
      
      console.log('JOURNEY API RESPONSE STATUS:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('JOURNEY API ERROR:', errorText);
        throw new Error(`Journey planning failed: ${response.status} - ${errorText}`);
      }
      
      const journey = await response.json();
      console.log('JOURNEY API SUCCESS:', journey);

      if (!journey.legs || journey.legs.length === 0) {
        throw new Error('No journey legs returned from API');
      }

      setFormData(prev => ({
        ...prev,
        journeyLegs: journey.legs,
        isModular: true
      }));

      toast({
        title: "Modular Journey Created!",
        description: `Route broken into ${journey.legs.length} editable legs. You can now modify each leg individually.`,
      });
    } catch (error) {
      console.error('JOURNEY CREATION ERROR:', error);
      toast({
        title: "Journey Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create journey",
        variant: "destructive",
      });
    }
  };

  const addIntermediateStop = () => {
    const newLeg: JourneyLeg = {
      id: `leg-${Date.now()}`,
      from: { id: '', name: 'Select station' },
      to: { id: '', name: 'Select station' },
      isValid: false
    };
    
    setFormData(prev => ({
      ...prev,
      journeyLegs: [...prev.journeyLegs, newLeg]
    }));
  };

  const removeLeg = (legId: string) => {
    setFormData(prev => ({
      ...prev,
      journeyLegs: prev.journeyLegs.filter(leg => leg.id !== legId)
    }));
  };

  const updateLegStation = (legId: string, type: 'from' | 'to', station: { id: string; name: string }) => {
    setFormData(prev => ({
      ...prev,
      journeyLegs: prev.journeyLegs.map(leg => 
        leg.id === legId 
          ? { ...leg, [type]: station, isValid: false }
          : leg
      )
    }));
  };

  const validateLeg = async (legId: string) => {
    const leg = formData.journeyLegs.find(l => l.id === legId);
    if (!leg || !leg.from.id || !leg.to.id) return;

    try {
      const response = await fetch('/api/journey/validate-leg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromId: leg.from.id,
          toId: leg.to.id,
          time: formData.departureTime,
          day: formData.selectedDay
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }
      
      const validation = await response.json();

      setFormData(prev => ({
        ...prev,
        journeyLegs: prev.journeyLegs.map(l => 
          l.id === legId 
            ? { 
                ...l, 
                isValid: validation.isValid,
                validationError: validation.validationError,
                departureTime: validation.departureTime,
                arrivalTime: validation.arrivalTime,
                duration: validation.duration,
                line: validation.line
              }
            : l
        )
      }));

      toast({
        title: validation.isValid ? "Leg Valid" : "Leg Invalid",
        description: validation.isValid 
          ? `${leg.from.name} → ${leg.to.name} is valid`
          : validation.validationError,
        variant: validation.isValid ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Validation Failed",
        description: "Could not validate this leg",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRoute) {
      updateRouteMutation.mutate({ id: editingRoute.id, data: formData });
    } else {
      createRouteMutation.mutate(formData);
    }
  };

  const handleEdit = (route: CommuteRoute) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      origin: { id: route.originAreaId, name: route.originName || route.originAreaId },
      destination: { id: route.destinationAreaId, name: route.destinationName || route.destinationAreaId },
      departureTime: route.departureTime,
      timeType: 'depart',
      selectedDay: 'monday',
      monday: route.monday || false,
      tuesday: route.tuesday || false,
      wednesday: route.wednesday || false,
      thursday: route.thursday || false,
      friday: route.friday || false,
      saturday: route.saturday || false,
      sunday: route.sunday || false,
      notificationsEnabled: route.notificationsEnabled || true,
      journeyLegs: [],
      isModular: false,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this commute route?')) {
      deleteRouteMutation.mutate(id);
    }
  };

  const getActiveWeekdays = (route: CommuteRoute) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activeDays = [
      route.monday && 'Mon',
      route.tuesday && 'Tue', 
      route.wednesday && 'Wed',
      route.thursday && 'Thu',
      route.friday && 'Fri',
      route.saturday && 'Sat',
      route.sunday && 'Sun'
    ].filter(Boolean);
    return activeDays.join(', ');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Daily Commute
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your regular transit routes with intelligent notifications
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRoute(null);
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Route
        </Button>
      </div>

      {/* Add/Edit Route Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              {editingRoute ? 'Edit Commute Route' : 'Create New Commute Route'}
            </CardTitle>
            <CardDescription>
              Set up automated monitoring and notifications for your daily transit routes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic route info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Route Name</Label>
                  <Input
                    id="name"
                    placeholder="Home to Office"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="departureTime">Time</Label>
                  <Input
                    id="departureTime"
                    type="time"
                    value={formData.departureTime}
                    onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Time type and planning day - SEPARATE from weekly schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Time Type</Label>
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
                  <Label>Planning Day (for timetables)</Label>
                  <Select 
                    value={formData.selectedDay} 
                    onValueChange={(value) => setFormData({ ...formData, selectedDay: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

              {/* Journey Creation Button */}
              {formData.origin && formData.destination && formData.departureTime && !formData.isModular && (
                <div className="flex justify-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Button 
                    type="button"
                    onClick={() => {
                      console.log('CREATE JOURNEY CLICKED:', { 
                        origin: formData.origin, 
                        destination: formData.destination, 
                        time: formData.departureTime,
                        timeType: formData.timeType 
                      });
                      createJourney();
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <Route className="h-5 w-5" />
                    Create Modular Journey ({formData.timeType === 'arrive' ? 'Arrive by' : 'Leave at'} {formData.departureTime})
                  </Button>
                </div>
              )}

              {/* Modular Journey Legs */}
              {formData.isModular && formData.journeyLegs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Journey Legs</h3>
                    <Button 
                      type="button"
                      onClick={addIntermediateStop}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Stop
                    </Button>
                  </div>

                  {formData.journeyLegs.map((leg, index) => (
                    <Card key={leg.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Train className="h-4 w-4" />
                          <span className="font-medium">Leg {index + 1}</span>
                          {leg.isValid === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {leg.isValid === false && <XCircle className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => validateLeg(leg.id)}
                            variant="outline"
                            size="sm"
                          >
                            Validate
                          </Button>
                          {formData.journeyLegs.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => removeLeg(leg.id)}
                              variant="outline"
                              size="sm"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <StationSearch
                          label="From"
                          placeholder="Select station"
                          value={leg.from.id ? leg.from : null}
                          onChange={(station) => station && updateLegStation(leg.id, 'from', station)}
                          required
                          indicatorColor="bg-blue-500"
                        />
                        <StationSearch
                          label="To"
                          placeholder="Select station"
                          value={leg.to.id ? leg.to : null}
                          onChange={(station) => station && updateLegStation(leg.id, 'to', station)}
                          required
                          indicatorColor="bg-purple-500"
                        />
                      </div>

                      {leg.isValid && leg.departureTime && (
                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {leg.departureTime} → {leg.arrivalTime}
                            </div>
                            {leg.duration && (
                              <div>{Math.round(leg.duration / 60)} min</div>
                            )}
                            {leg.line && (
                              <Badge variant="outline">{leg.line}</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {leg.isValid === false && leg.validationError && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {leg.validationError}
                          </p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              <Separator />

              {/* Weekday selection */}
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
                    <div key={key} className="flex items-center space-x-2">
                      <Switch
                        id={key}
                        checked={formData[key as keyof CommuteRouteForm] as boolean}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, [key]: checked })
                        }
                      />
                      <Label htmlFor={key} className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Notification settings */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Notification Settings</Label>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Notifications</Label>
                    <p className="text-sm text-gray-500">Get alerted about delays and departures</p>
                  </div>
                  <Switch
                    checked={formData.notificationsEnabled}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, notificationsEnabled: checked })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="departureTime">Time to Leave</Label>
                  <DepartureTimeSelect
                    origin={formData.origin || undefined}
                    destination={formData.destination || undefined}
                    value={formData.departureTime}
                    onChange={(time) => setFormData({ ...formData, departureTime: time })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose from 20 real departure times fetched from Swedish transport API
                  </p>
                </div>
              </div>

              {/* Form actions */}
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRoute(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRouteMutation.isPending || updateRouteMutation.isPending}
                >
                  {createRouteMutation.isPending || updateRouteMutation.isPending
                    ? 'Saving...'
                    : editingRoute
                    ? 'Update Route'
                    : 'Create Route'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Routes */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading your commute routes...</p>
          </div>
        ) : routes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Train className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Commute Routes Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Create your first daily route to get intelligent notifications and delay alerts.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Route
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {routes.map((route: CommuteRoute) => (
              <Card key={route.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {route.name}
                        </h3>
                        {route.isActive ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm">
                            {route.originName || route.originAreaId} → {route.destinationName || route.destinationAreaId}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">Leave at {route.departureTime}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">{getActiveWeekdays(route)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          <span>
                            {route.notificationsEnabled 
                              ? 'Smart alerts enabled'
                              : 'No alerts'
                            }
                          </span>
                        </div>
                        {route.notificationsEnabled && (
                          <div>
                            Live monitoring between alert and departure
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(route)}
                        title="Edit route"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(route.id)}
                        disabled={deleteRouteMutation.isPending}
                        title="Delete route"
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