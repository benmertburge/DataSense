import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, MapPin, Calendar, Edit2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CommuteRoute {
  id: string;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommuteFormData {
  name: string;
  originAreaId: string;
  destinationAreaId: string;
  departureTime: string;
  weekdays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  alertMinutesBefore: number;
  delayThresholdMinutes: number;
}

export function CommuteManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CommuteRoute | null>(null);
  const [formData, setFormData] = useState<CommuteFormData>({
    name: "",
    originAreaId: "",
    destinationAreaId: "",
    departureTime: "08:00",
    weekdays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    alertMinutesBefore: 15,
    delayThresholdMinutes: 20,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["/api/commute-routes"],
  });

  const { data: todayRoutes = [] } = useQuery({
    queryKey: ["/api/commute-routes/today"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/commute-routes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commute-routes"] });
      toast({ title: "Daily commute saved successfully!" });
      setShowForm(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Failed to save commute route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/commute-routes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commute-routes"] });
      toast({ title: "Daily commute updated successfully!" });
      setEditingRoute(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Failed to update commute route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/commute-routes/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commute-routes"] });
      toast({ title: "Daily commute deleted successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete commute route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      originAreaId: "",
      destinationAreaId: "",
      departureTime: "08:00",
      weekdays: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
      alertMinutesBefore: 15,
      delayThresholdMinutes: 20,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      ...formData.weekdays,
    };
    
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const startEditing = (route: CommuteRoute) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      originAreaId: route.originAreaId,
      destinationAreaId: route.destinationAreaId,
      departureTime: route.departureTime,
      weekdays: {
        monday: route.monday,
        tuesday: route.tuesday,
        wednesday: route.wednesday,
        thursday: route.thursday,
        friday: route.friday,
        saturday: route.saturday,
        sunday: route.sunday,
      },
      alertMinutesBefore: route.alertMinutesBefore,
      delayThresholdMinutes: route.delayThresholdMinutes,
    });
    setShowForm(true);
  };

  const getActiveDays = (route: CommuteRoute) => {
    const days = [];
    if (route.monday) days.push("Mon");
    if (route.tuesday) days.push("Tue");
    if (route.wednesday) days.push("Wed");
    if (route.thursday) days.push("Thu");
    if (route.friday) days.push("Fri");
    if (route.saturday) days.push("Sat");
    if (route.sunday) days.push("Sun");
    return days;
  };

  if (isLoading) {
    return <div className="p-4">Loading your daily commutes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Daily Commutes</h2>
          <p className="text-muted-foreground">
            Track your regular journeys with automatic delay alerts
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingRoute(null);
            resetForm();
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Daily Commute
        </Button>
      </div>

      {/* Today's Active Routes */}
      {todayRoutes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Commutes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayRoutes.map((route: CommuteRoute) => (
                <div
                  key={route.id}
                  className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg"
                >
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{route.departureTime}</span>
                  <span>{route.name}</span>
                  <Badge variant="secondary">
                    Alert: {route.alertMinutesBefore}min before
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingRoute ? "Edit Daily Commute" : "Add Daily Commute"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Commute Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Home to Work"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="originAreaId">From Station</Label>
                  <Input
                    id="originAreaId"
                    value={formData.originAreaId}
                    onChange={(e) =>
                      setFormData({ ...formData, originAreaId: e.target.value })
                    }
                    placeholder="Station ID"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="destinationAreaId">To Station</Label>
                  <Input
                    id="destinationAreaId"
                    value={formData.destinationAreaId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destinationAreaId: e.target.value,
                      })
                    }
                    placeholder="Station ID"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="departureTime">Departure Time</Label>
                <Input
                  id="departureTime"
                  type="time"
                  value={formData.departureTime}
                  onChange={(e) =>
                    setFormData({ ...formData, departureTime: e.target.value })
                  }
                  required
                />
              </div>

              {/* Weekday Selection */}
              <div>
                <Label>Active Days</Label>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2 mt-2">
                  {Object.entries(formData.weekdays).map(([day, checked]) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={day}
                        checked={checked}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            weekdays: {
                              ...formData.weekdays,
                              [day]: !!checked,
                            },
                          })
                        }
                      />
                      <Label htmlFor={day} className="text-sm capitalize">
                        {day.slice(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="alertMinutesBefore">Alert Before (minutes)</Label>
                  <Input
                    id="alertMinutesBefore"
                    type="number"
                    min="5"
                    max="60"
                    value={formData.alertMinutesBefore}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        alertMinutesBefore: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="delayThresholdMinutes">
                    Delay Threshold (minutes)
                  </Label>
                  <Input
                    id="delayThresholdMinutes"
                    type="number"
                    min="10"
                    max="120"
                    value={formData.delayThresholdMinutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delayThresholdMinutes: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {editingRoute ? "Update" : "Save"} Commute
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRoute(null);
                    resetForm();
                  }}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Routes */}
      <div className="space-y-4">
        {routes.map((route: CommuteRoute) => (
          <Card key={route.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{route.name}</h3>
                    <Badge variant={route.isActive ? "default" : "secondary"}>
                      {route.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {route.departureTime}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {route.originAreaId} → {route.destinationAreaId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Days:</span>
                    {getActiveDays(route).map((day) => (
                      <Badge key={day} variant="outline" className="text-xs">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(route)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(route.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {routes.length === 0 && !showForm && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No daily commutes set up</h3>
            <p className="text-muted-foreground mb-4">
              Add your regular journeys to get proactive delay alerts and automatic
              compensation tracking.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Commute
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}