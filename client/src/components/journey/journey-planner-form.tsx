import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, MapPin, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { journeyPlannerSchema, type JourneyPlannerRequest } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function JourneyPlannerForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [leaveAt, setLeaveAt] = useState(true);

  const form = useForm<JourneyPlannerRequest>({
    resolver: zodResolver(journeyPlannerSchema),
    defaultValues: {
      from: '',
      to: '',
      via: '',
      date: new Date().toISOString().split('T')[0],
      time: '08:30',
      leaveAt: true,
    },
  });

  const { data: savedRoutes } = useQuery({
    queryKey: ['/api/routes'],
    enabled: !!user,
  });

  const searchMutation = useMutation({
    mutationFn: async (data: JourneyPlannerRequest) => {
      const response = await apiRequest('POST', '/api/trips/search', data);
      return response.json();
    },
    onSuccess: (data) => {
      // Store search results in cache for other components to use
      queryClient.setQueryData(['trip-results'], data);
      toast({
        title: "Routes Found",
        description: `Found ${data.alternatives?.length + 1 || 1} route options`,
      });
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JourneyPlannerRequest) => {
    searchMutation.mutate({ ...data, leaveAt });
  };

  const swapLocations = () => {
    const fromValue = form.getValues('from');
    const toValue = form.getValues('to');
    form.setValue('from', toValue);
    form.setValue('to', fromValue);
  };

  const selectSavedRoute = (route: any) => {
    form.setValue('from', route.originAreaId);
    form.setValue('to', route.destinationAreaId);
    if (route.viaAreaId) {
      form.setValue('via', route.viaAreaId);
    }
    if (route.preferredDepartureTime) {
      form.setValue('time', route.preferredDepartureTime);
    }
  };

  return (
    <>
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="text-blue-600 mr-2" />
            Plan Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              <FormField
                control={form.control}
                name="from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <Input
                          {...field}
                          placeholder="Stockholm Odenplan"
                          className="pl-8 pr-10"
                        />
                        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={swapLocations}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <ArrowUpDown className="h-4 w-4 text-gray-600" />
                </Button>
              </div>

              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        </div>
                        <Input
                          {...field}
                          placeholder="Arlanda Airport"
                          className="pl-8 pr-10"
                        />
                        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="via"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Via (optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Plus className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          {...field}
                          placeholder="Add via stop"
                          className="pl-8"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <Button
                  type="button"
                  variant={leaveAt ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setLeaveAt(true)}
                >
                  Leave at
                </Button>
                <Button
                  type="button"
                  variant={!leaveAt ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setLeaveAt(false)}
                >
                  Arrive by
                </Button>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Routes
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Saved Routes */}
      {savedRoutes && savedRoutes.length > 0 && (
        <Card className="shadow-sm border border-gray-200 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
              Saved Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savedRoutes.map((route: any) => (
                <div 
                  key={route.id}
                  className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => selectSavedRoute(route)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{route.name}</p>
                      <p className="text-xs text-gray-600">
                        {route.originAreaId} → {route.destinationAreaId}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        On time
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
