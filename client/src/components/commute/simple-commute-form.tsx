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
import { Clock, Train, MapPin, Check, Edit } from 'lucide-react';

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
  
  const [step, setStep] = useState(1);
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

  // Step 7: Fetch journey alternatives when form is complete
  const { data: journeyAlternatives = [], isLoading: loadingJourneys } = useQuery({
    queryKey: ['/api/commute/departure-options', formData.origin?.id, formData.destination?.id, formData.departureTime],
    enabled: !!(formData.origin && formData.destination && formData.departureTime && step >= 7),
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

  const canProceedToStep = (stepNumber: number) => {
    switch (stepNumber) {
      case 2: return formData.name.trim().length > 0;
      case 3: return formData.origin !== null;
      case 4: return formData.destination !== null;
      case 5: return formData.timeType !== null;
      case 6: return formData.departureTime !== '';
      case 7: return Object.values(formData).slice(4, 11).some(Boolean); // At least one day selected
      case 8: return journeyAlternatives.length > 0;
      case 9: return formData.selectedJourney !== null;
      default: return true;
    }
  };

  const nextStep = () => {
    if (canProceedToStep(step + 1)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const saveRoute = useMutation({
    mutationFn: async () => {
      const routeData = {
        name: formData.name,
        originAreaId: formData.origin?.id || '',
        originAreaName: formData.origin?.name || '',
        destinationAreaId: formData.destination?.id || '',
        destinationAreaName: formData.destination?.name || '',
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
      // Reset form
      setStep(1);
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
    },
  });

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Create Commute Route - Step {step} of 9</CardTitle>
        <CardDescription>
          {step === 1 && "Choose a name for your commute route"}
          {step === 2 && "Select your starting station"}
          {step === 3 && "Select your destination station"}
          {step === 4 && "Choose departure or arrival time preference"}
          {step === 5 && "Set your preferred time"}
          {step === 6 && "Select which days this route is active"}
          {step === 7 && "Choose from available journey alternatives"}
          {step === 8 && "Select your preferred journey"}
          {step === 9 && "Edit your journey if needed"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Step 1: Name */}
        {step === 1 && (
          <div>
            <Label>Route Name</Label>
            <Input
              placeholder="e.g. Home to Work"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
        )}

        {/* Step 2: From */}
        {step === 2 && (
          <StationSearch
            label="From"
            placeholder="Stockholm Central"
            value={formData.origin}
            onChange={(station) => setFormData({ ...formData, origin: station })}
            required
            indicatorColor="bg-green-500"
          />
        )}

        {/* Step 3: To */}
        {step === 3 && (
          <StationSearch
            label="To"
            placeholder="Arlanda Airport"
            value={formData.destination}
            onChange={(station) => setFormData({ ...formData, destination: station })}
            required
            indicatorColor="bg-red-500"
          />
        )}

        {/* Step 4: Time Type */}
        {step === 4 && (
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
        )}

        {/* Step 5: Time */}
        {step === 5 && (
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
        )}

        {/* Step 6: Active Days */}
        {step === 6 && (
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
        )}

        {/* Step 7: Journey Alternatives */}
        {step === 7 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">5 Journey Alternatives</h3>
            {loadingJourneys ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Loading journey alternatives...</p>
              </div>
            ) : journeyAlternatives.length > 0 ? (
              <div className="space-y-3">
                {journeyAlternatives.slice(0, 5).map((journey: any, index: number) => (
                  <Card 
                    key={journey.id} 
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
              <p className="text-center text-gray-500 py-8">No journey alternatives found</p>
            )}
          </div>
        )}

        {/* Step 8: Selected Journey */}
        {step === 8 && formData.selectedJourney && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Selected Journey</h3>
            <Card className="p-4 bg-green-50 dark:bg-green-950">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">
                    {formatTime(formData.selectedJourney.plannedDeparture)} → {formatTime(formData.selectedJourney.plannedArrival)}
                  </span>
                </div>
                <Badge>{getDuration(formData.selectedJourney.plannedDeparture, formData.selectedJourney.plannedArrival)}</Badge>
              </div>
              <div className="space-y-2">
                {formData.selectedJourney.legs?.map((leg: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <Train className="h-4 w-4" />
                    <span>{leg.from?.name} → {leg.to?.name}</span>
                    <Badge variant="outline">{leg.line}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Step 9: Edit Journey */}
        {step === 9 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Edit Journey (Optional)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Journey editing is coming soon. For now, your selected journey will be saved as-is.
            </p>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">
                    {formData.selectedJourney && formatTime(formData.selectedJourney.plannedDeparture)} → {formData.selectedJourney && formatTime(formData.selectedJourney.plannedArrival)}
                  </span>
                </div>
                <Badge>{formData.selectedJourney && getDuration(formData.selectedJourney.plannedDeparture, formData.selectedJourney.plannedArrival)}</Badge>
              </div>
              <Button variant="outline" size="sm" className="mt-2" disabled>
                <Edit className="h-4 w-4 mr-2" />
                Edit Journey (Coming Soon)
              </Button>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6">
          <Button 
            variant="outline" 
            onClick={prevStep}
            disabled={step === 1}
          >
            Previous
          </Button>
          
          <div className="flex gap-2">
            {step < 9 ? (
              <Button 
                onClick={nextStep}
                disabled={!canProceedToStep(step + 1)}
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={() => saveRoute.mutate()}
                disabled={saveRoute.isPending}
              >
                {saveRoute.isPending ? 'Saving...' : 'Save Route'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}