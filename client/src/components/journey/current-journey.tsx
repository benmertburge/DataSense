import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Clock, AlertTriangle, MoreHorizontal, Route, DollarSign, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AlternativeRoutes from './alternative-routes';

export default function CurrentJourney() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAlternatives, setShowAlternatives] = useState(false);
  
  const handleViewAlternatives = async () => {
    if (!activeJourney || !activeJourney.legs || activeJourney.legs.length === 0) return;
    
    try {
      // Get origin and destination from the first and last leg
      const firstLeg = activeJourney.legs[0];
      const lastLeg = activeJourney.legs[activeJourney.legs.length - 1];
      
      if (firstLeg.kind === 'TRANSIT' && lastLeg.kind === 'TRANSIT') {
        const searchData = {
          from: { id: firstLeg.from.siteId, name: firstLeg.from.name },
          to: { id: lastLeg.to.siteId, name: lastLeg.to.name },
          date: new Date().toISOString().split('T')[0], // Today
          time: "08:00", // Start from 8 AM for alternatives
          leaveAt: true
        };
        
        // Fetch alternatives and cache them
        const alternatives = await apiRequest('POST', '/api/trips/search', searchData);
        queryClient.setQueryData(['trip-results'], alternatives);
        
        setShowAlternatives(!showAlternatives);
      }
    } catch (error) {
      console.error('Error fetching alternatives:', error);
      toast({
        title: "Error",
        description: "Failed to load alternative routes. Please try again.",
        variant: "destructive"
      });
    }
  };

  const { data: activeJourney, isLoading } = useQuery({
    queryKey: ['/api/journeys/active'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const cancelJourneyMutation = useMutation({
    mutationFn: (journeyId: string) => apiRequest('PUT', `/api/journeys/${journeyId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/journeys/active'] });
      toast({
        title: "Journey Cancelled",
        description: "Your journey has been successfully cancelled.",
        variant: "default"
      });
    },
    onError: (error: any) => {
      console.error('Error cancelling journey:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to cancel journey. Please try again.",
        variant: "destructive"
      });
    },
  });

  const handleCancelJourney = () => {
    if (activeJourney?.id) {
      cancelJourneyMutation.mutate(activeJourney.id);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6 bg-white dark:bg-gray-800">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeJourney) {
    return (
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6 bg-white dark:bg-gray-800">
        <CardContent className="p-6 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2 text-gray-900 dark:text-white">No Active Journey</h3>
            <p className="text-sm">Plan a journey to start monitoring delays and receive alerts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const legs = activeJourney.legs || [];
  const delayMinutes = activeJourney.delayMinutes || 0;
  
  // Parse times without timezone conversion since ResRobot already returns Swedish local time
  const parseSwedishTime = (timeString: string) => {
    if (!timeString) return new Date();
    // Remove timezone info and parse as local time
    const cleanTimeString = timeString.replace(/[TZ]/g, ' ').trim();
    return new Date(cleanTimeString);
  };

  const plannedDeparture = parseSwedishTime(activeJourney.plannedDeparture);
  const plannedArrival = parseSwedishTime(activeJourney.plannedArrival);
  const expectedArrival = activeJourney.expectedArrival ? parseSwedishTime(activeJourney.expectedArrival) : plannedArrival;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const getTotalDuration = () => {
    const duration = Math.round((expectedArrival.getTime() - plannedDeparture.getTime()) / 60000);
    return `${duration} min`;
  };

  const getOriginName = () => {
    if (legs.length === 0) return 'Origin';
    const firstLeg = legs[0];
    if (firstLeg.kind === 'TRANSIT') {
      return firstLeg.from?.name || 'Origin';
    }
    return 'Origin';
  };

  const getDestinationName = () => {
    if (legs.length === 0) return 'Destination';
    const lastLeg = legs[legs.length - 1];
    if (lastLeg.kind === 'TRANSIT') {
      return lastLeg.to?.name || 'Destination';
    }
    return 'Destination';
  };


  return (
    <>
    <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6 bg-white dark:bg-gray-800">
      <CardHeader className="border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <CardTitle>Current Journey</CardTitle>
          <div className="flex items-center space-x-2">
            {delayMinutes > 0 && (
              <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Delayed {delayMinutes} min
              </Badge>
            )}
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Journey Overview */}
        <div className="flex items-center justify-between text-sm mb-4">
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">{getOriginName()}</p>
            <p className="text-gray-600 dark:text-gray-400">{formatTime(plannedDeparture)}</p>
          </div>
          <div className="flex-1 mx-4 border-t-2 border-dashed border-gray-300 relative">
            <span className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-2 text-xs text-gray-500">
              {getTotalDuration()}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">{getDestinationName()}</p>
            <p className="text-gray-600 dark:text-gray-400">{formatTime(expectedArrival)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Journey Legs */}
        <div className="space-y-6">
          {legs.map((leg: any, index: number) => (
            <div key={index}>
              {leg.kind === 'TRANSIT' ? (
                <div className="flex items-start space-x-4">
                  <div className="flex flex-col items-center">
                    <div 
                      className="w-8 h-8 rounded text-white text-sm font-bold flex items-center justify-center"
                      style={{ backgroundColor: leg.line.color || '#666666' }}
                    >
                      {leg.line.number}
                    </div>
                    {index < legs.length - 1 && (
                      <div className="w-px bg-gray-300 h-16 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div>
                          <p className="font-semibold text-lg">{leg.line.name}</p>
                          <p className="text-sm text-gray-600">
                            {leg.from.name} → {leg.to.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Platform {leg.from.platform} • Direction: {leg.directionText}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatTime(parseSwedishTime(leg.plannedDeparture))} - 
                          {formatTime(parseSwedishTime(leg.plannedArrival))}
                        </p>
                        {leg.expectedDeparture && parseSwedishTime(leg.expectedDeparture) > parseSwedishTime(leg.plannedDeparture) && (
                          <p className="text-xs text-amber-600">
                            +{Math.round((parseSwedishTime(leg.expectedDeparture).getTime() - parseSwedishTime(leg.plannedDeparture).getTime()) / 60000)} min delay
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {Math.round((parseSwedishTime(leg.plannedArrival).getTime() - parseSwedishTime(leg.plannedDeparture).getTime()) / 60000)} min
                      </Badge>
                      {leg.platformChange && (
                        <Badge variant="destructive" className="bg-amber-500 text-xs">
                          Platform change: {leg.to.platform}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2L3 7v11a2 2 0 002 2h10a2 2 0 002-2V7l-7-5zM8 15a1 1 0 100-2 1 1 0 000 2zm4 0a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {index < legs.length - 1 && (
                      <div className="w-px bg-gray-300 h-8 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Walk to next stop</p>
                    <Badge variant="secondary" className="text-xs">
                      {leg.durationMinutes} min walk
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Action Buttons */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div className="flex space-x-3">
          <Button 
            onClick={handleViewAlternatives}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            data-testid="button-view-alternatives"
          >
            <Route className="mr-2 h-4 w-4" />
            {showAlternatives ? 'Hide Alternatives' : 'View Alternatives'}
          </Button>
          {delayMinutes >= 20 && (
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid="button-request-compensation"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Request Compensation
            </Button>
          )}
          <Button 
            onClick={handleCancelJourney}
            disabled={cancelJourneyMutation.isPending}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50"
            data-testid="button-cancel-journey"
          >
            <X className="mr-2 h-4 w-4" />
            {cancelJourneyMutation.isPending ? 'Cancelling...' : 'Cancel Journey'}
          </Button>
        </div>
      </div>
    </Card>
    
    {/* Show Alternative Routes */}
    {showAlternatives && <AlternativeRoutes />}
  </>
  );
}
