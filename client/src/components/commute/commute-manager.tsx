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
  Route
} from 'lucide-react';
import type { CommuteRoute } from '@shared/schema';

interface CommuteRouteForm {
  name: string;
  originAreaId: string;
  destinationAreaId: string;
  departureTime: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  notificationsEnabled: boolean;
  alertMinutesBefore: number;
  delayThresholdMinutes: number;
}

export function CommuteManager() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CommuteRoute | null>(null);
  const [formData, setFormData] = useState<CommuteRouteForm>({
    name: '',
    originAreaId: '',
    destinationAreaId: '',
    departureTime: '',
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
    notificationsEnabled: true,
    alertMinutesBefore: 15,
    delayThresholdMinutes: 20,
  });

  // Fetch commute routes
  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/commute/routes'],
    enabled: !!user,
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
    }
  });

  // Create commute route mutation
  const createRouteMutation = useMutation({
    mutationFn: async (data: CommuteRouteForm) => {
      const response = await apiRequest('POST', '/api/commute/routes', data);
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
      originAreaId: '',
      destinationAreaId: '',
      departureTime: '',
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
      notificationsEnabled: true,
      alertMinutesBefore: 15,
      delayThresholdMinutes: 20,
    });
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
      originAreaId: route.originAreaId,
      destinationAreaId: route.destinationAreaId,
      departureTime: route.departureTime,
      monday: route.monday,
      tuesday: route.tuesday,
      wednesday: route.wednesday,
      thursday: route.thursday,
      friday: route.friday,
      saturday: route.saturday,
      sunday: route.sunday,
      notificationsEnabled: route.notificationsEnabled,
      alertMinutesBefore: route.alertMinutesBefore,
      delayThresholdMinutes: route.delayThresholdMinutes,
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
                  <Label htmlFor="departureTime">Departure Time</Label>
                  <Input
                    id="departureTime"
                    type="time"
                    value={formData.departureTime}
                    onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin">From</Label>
                  <Input
                    id="origin"
                    placeholder="Origin station (e.g., 1002 for Stockholm Central)"
                    value={formData.originAreaId}
                    onChange={(e) => setFormData({ ...formData, originAreaId: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Use station ID (numeric)</p>
                </div>
                <div>
                  <Label htmlFor="destination">To</Label>
                  <Input
                    id="destination"
                    placeholder="Destination station (e.g., 9001 for Södermalm)"
                    value={formData.destinationAreaId}
                    onChange={(e) => setFormData({ ...formData, destinationAreaId: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Use station ID (numeric)</p>
                </div>
              </div>

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="alertBefore">Alert Before Departure</Label>
                    <Select
                      value={formData.alertMinutesBefore.toString()}
                      onValueChange={(value) => 
                        setFormData({ ...formData, alertMinutesBefore: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="delayThreshold">Delay Alert Threshold</Label>
                    <Select
                      value={formData.delayThresholdMinutes.toString()}
                      onValueChange={(value) => 
                        setFormData({ ...formData, delayThresholdMinutes: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                            {route.originAreaId} → {route.destinationAreaId}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">{route.departureTime}</span>
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
                              ? `Alert ${route.alertMinutesBefore}min before`
                              : 'No alerts'
                            }
                          </span>
                        </div>
                        {route.notificationsEnabled && (
                          <div>
                            Delay threshold: {route.delayThresholdMinutes}min
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(route)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(route.id)}
                        disabled={deleteRouteMutation.isPending}
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