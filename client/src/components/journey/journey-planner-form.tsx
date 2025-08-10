import { useState, useRef } from 'react';
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

interface Station {
  id: string;
  name: string;
  type: string;
}

export default function JourneyPlannerForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [leaveAt, setLeaveAt] = useState(true);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<JourneyPlannerRequest>({
    resolver: zodResolver(journeyPlannerSchema),
    defaultValues: {
      from: '',
      to: '',
      date: new Date().toISOString().split('T')[0],
      time: '08:30',
      leaveAt: true,
    },
  });

  const { data: savedRoutes = [] } = useQuery({
    queryKey: ['/api/routes'],
    enabled: !!user,
  }) as { data: any[] };

  // Station search queries
  const { data: fromStations = [] } = useQuery({
    queryKey: ['/api/sites/search', fromQuery],
    enabled: fromQuery.length >= 2,
    staleTime: 5000, // Cache for 5 seconds
  }) as { data: Station[] };

  const { data: toStations = [] } = useQuery({
    queryKey: ['/api/sites/search', toQuery],
    enabled: toQuery.length >= 2,
    staleTime: 5000,
  }) as { data: Station[] };

  const searchMutation = useMutation({
    mutationFn: async (data: JourneyPlannerRequest & { leaveAt: boolean }) => {
      // Ensure we're sending station objects with IDs, not strings
      const searchData = {
        ...data,
        from: typeof data.from === 'string' ? { id: data.from, name: data.from } : data.from,
        to: typeof data.to === 'string' ? { id: data.to, name: data.to } : data.to
      };
      
      console.log('Submitting search with:', searchData);
      
      const response = await apiRequest('POST', '/api/trips/search', searchData);
      return response.json();
    },
    onSuccess: (data) => {
      // Store search results in cache for other components to use
      queryClient.setQueryData(['trip-results'], data);
      toast({
        title: "Routes Found",
        description: `Found ${data.length || 0} route options`,
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
    // Also swap the query values
    const tempQuery = fromQuery;
    setFromQuery(toQuery);
    setToQuery(tempQuery);
  };

  const selectFromStation = (station: Station) => {
    // Store the station object with id and name
    form.setValue('from', { id: station.id, name: station.name });
    setFromQuery(station.name);
    setShowFromDropdown(false);
  };

  const selectToStation = (station: Station) => {
    // Store the station object with id and name
    form.setValue('to', { id: station.id, name: station.name });
    setToQuery(station.name);
    setShowToDropdown(false);
  };

  const selectSavedRoute = (route: any) => {
    form.setValue('from', route.originAreaId);
    form.setValue('to', route.destinationAreaId);
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
                          ref={fromInputRef}
                          placeholder="Stockholm Odenplan"
                          className="pl-8 pr-10"
                          value={typeof field.value === 'object' ? field.value.name : field.value}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            setFromQuery(e.target.value);
                            setShowFromDropdown(e.target.value.length >= 2);
                          }}
                          onFocus={() => {
                            if (fromQuery.length >= 2) {
                              setShowFromDropdown(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding to allow click on dropdown
                            setTimeout(() => setShowFromDropdown(false), 200);
                          }}
                        />
                        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        
                        {showFromDropdown && fromStations.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {fromStations.map((station: Station) => (
                              <button
                                key={station.id}
                                type="button"
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                onClick={() => selectFromStation(station)}
                              >
                                <div className="flex items-center">
                                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                                  <div>
                                    <div className="font-medium">{station.name}</div>
                                    <div className="text-sm text-gray-500">{station.type}</div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
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
                          ref={toInputRef}
                          placeholder="Arlanda Airport"
                          className="pl-8 pr-10"
                          value={typeof field.value === 'object' ? field.value.name : field.value}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            setToQuery(e.target.value);
                            setShowToDropdown(e.target.value.length >= 2);
                          }}
                          onFocus={() => {
                            if (toQuery.length >= 2) {
                              setShowToDropdown(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding to allow click on dropdown
                            setTimeout(() => setShowToDropdown(false), 200);
                          }}
                        />
                        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        
                        {showToDropdown && toStations.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {toStations.map((station: Station) => (
                              <button
                                key={station.id}
                                type="button"
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                onClick={() => selectToStation(station)}
                              >
                                <div className="flex items-center">
                                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                                  <div>
                                    <div className="font-medium">{station.name}</div>
                                    <div className="text-sm text-gray-500">{station.type}</div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
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
