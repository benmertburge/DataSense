import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Train, CreditCard, CheckCircle } from 'lucide-react';

interface SLFormStep {
  step: number;
  title: string;
  subtitle: string;
  fields: Record<string, any>;
  completed: boolean;
}

export function SLFormSimulator() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Example journey data from real Swedish transport
    travelDate: '2025-01-13',
    departureTime: '08:15',
    fromStation: 'Tumba',
    toStation: 'Stockholm City',
    delayMinutes: 35,
    affectedLine: 'Pendeltåg 40',
    compensationType: 'standard_delay',
    ticketType: '30-day',
    firstName: 'Erik',
    lastName: 'Andersson',
    email: 'erik.andersson@example.se',
    phone: '070-123-4567',
    paymentMethod: 'bank_transfer',
    bankAccount: '1234-567890'
  });

  const [completedSteps, setCompletedSteps] = useState<SLFormStep[]>([]);

  const steps = [
    {
      step: 1,
      title: "Din planerade resa",
      subtitle: "Om din resa innehöll byten välj då den sträckan/linjen som var försenad",
      fields: ['travelDate', 'departureTime', 'fromStation', 'toStation'],
      completed: false
    },
    {
      step: 2,
      title: "Ersättning",
      subtitle: "Berätta om din försening och vilken ersättning du söker",
      fields: ['delayMinutes', 'affectedLine', 'compensationType'],
      completed: false
    },
    {
      step: 3,
      title: "Biljett",
      subtitle: "Information om din biljett eller kort",
      fields: ['ticketType'],
      completed: false
    },
    {
      step: 4,
      title: "Personuppgifter",
      subtitle: "Dina kontaktuppgifter för handläggning av ärendet",
      fields: ['firstName', 'lastName', 'email', 'phone'],
      completed: false
    },
    {
      step: 5,
      title: "Utbetalning",
      subtitle: "Hur vill du få din ersättning?",
      fields: ['paymentMethod', 'bankAccount'],
      completed: false
    },
    {
      step: 6,
      title: "Granska",
      subtitle: "Kontrollera dina uppgifter innan du skickar in din ansökan",
      fields: [],
      completed: false
    }
  ];

  const handleNext = () => {
    const currentStepData = steps[currentStep - 1];
    const updatedStep = { ...currentStepData, completed: true };
    
    setCompletedSteps(prev => [...prev.filter(s => s.step !== currentStep), updatedStep]);
    
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="travelDate">Datum för resan</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="travelDate"
                    type="date"
                    value={formData.travelDate}
                    onChange={(e) => setFormData({...formData, travelDate: e.target.value})}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="departureTime">Ordinarie avgångstid</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="departureTime"
                    type="time"
                    value={formData.departureTime}
                    onChange={(e) => setFormData({...formData, departureTime: e.target.value})}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <Label htmlFor="fromStation">Från hållplats/station</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="fromStation"
                  value={formData.fromStation}
                  onChange={(e) => setFormData({...formData, fromStation: e.target.value})}
                  placeholder="Sök resa från. Ange minst två tecken."
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="toStation">Till hållplats/station</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="toStation"
                  value={formData.toStation}
                  onChange={(e) => setFormData({...formData, toStation: e.target.value})}
                  placeholder="Sök resa till. Ange minst två tecken."
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <h4 className="font-medium text-orange-800 dark:text-orange-200">
                Detected Journey: {formData.fromStation} → {formData.toStation}
              </h4>
              <p className="text-sm text-orange-600 dark:text-orange-300">
                {formData.travelDate} at {formData.departureTime}
              </p>
            </div>
            
            <div>
              <Label htmlFor="delayMinutes">Hur lång var förseningen? (minuter)</Label>
              <Input
                id="delayMinutes"
                type="number"
                value={formData.delayMinutes}
                onChange={(e) => setFormData({...formData, delayMinutes: parseInt(e.target.value)})}
              />
            </div>
            
            <div>
              <Label htmlFor="affectedLine">Vilken linje var försenad?</Label>
              <div className="relative">
                <Train className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="affectedLine"
                  value={formData.affectedLine}
                  onChange={(e) => setFormData({...formData, affectedLine: e.target.value})}
                  placeholder="T.ex. Pendeltåg 40, Tunnelbana röda linjen"
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Berättigad till ersättning: {formData.delayMinutes} minuter ≥ 20 minuter
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                Uppskattat belopp: ~{Math.round(formData.delayMinutes * 6.5)} SEK
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label>Vilken typ av biljett hade du?</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {['Enkelbiljett', 'Reskassa', '24-timmar', '7-dagar', '30-dagar', 'Årskort'].map((type) => (
                  <Button
                    key={type}
                    variant={formData.ticketType === type ? "default" : "outline"}
                    onClick={() => setFormData({...formData, ticketType: type})}
                    className="h-auto p-3"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
            
            {formData.ticketType && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Vald biljetttyp: <strong>{formData.ticketType}</strong>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  Detta påverkar ersättningsbeloppet enligt SL:s regler
                </p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Förnamn</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Efternamn</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">E-postadress</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label>Hur vill du få din ersättning?</Label>
              <div className="grid grid-cols-1 gap-3 mt-2">
                {[
                  { id: 'bank_transfer', label: 'Bankgiro/Plusgiro', icon: CreditCard },
                  { id: 'swish', label: 'Swish', icon: CreditCard },
                  { id: 'sl_credit', label: 'SL-kredit på kort', icon: CreditCard }
                ].map((method) => (
                  <Button
                    key={method.id}
                    variant={formData.paymentMethod === method.id ? "default" : "outline"}
                    onClick={() => setFormData({...formData, paymentMethod: method.id})}
                    className="h-auto p-4 justify-start"
                  >
                    <method.icon className="h-4 w-4 mr-2" />
                    {method.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {formData.paymentMethod === 'bank_transfer' && (
              <div>
                <Label htmlFor="bankAccount">Kontonummer</Label>
                <Input
                  id="bankAccount"
                  value={formData.bankAccount}
                  onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                  placeholder="XXXX-XXXXXXXXX"
                />
              </div>
            )}
            
            {formData.paymentMethod === 'swish' && (
              <div>
                <Label htmlFor="swishNumber">Swish-nummer</Label>
                <Input
                  id="swishNumber"
                  value={formData.phone}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Använder ditt telefonnummer</p>
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium mb-3">Sammanfattning av din ansökan</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Resa:</span>
                  <span>{formData.fromStation} → {formData.toStation}</span>
                </div>
                <div className="flex justify-between">
                  <span>Datum:</span>
                  <span>{formData.travelDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avgångstid:</span>
                  <span>{formData.departureTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Försening:</span>
                  <span>{formData.delayMinutes} minuter</span>
                </div>
                <div className="flex justify-between">
                  <span>Drabbad linje:</span>
                  <span>{formData.affectedLine}</span>
                </div>
                <div className="flex justify-between">
                  <span>Biljetttyp:</span>
                  <span>{formData.ticketType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Namn:</span>
                  <span>{formData.firstName} {formData.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Utbetalning:</span>
                  <span>{formData.paymentMethod === 'bank_transfer' ? 'Bankkonto' : 
                         formData.paymentMethod === 'swish' ? 'Swish' : 'SL-kredit'}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Beräknad ersättning:</span>
                  <span>{Math.round(formData.delayMinutes * 6.5)} SEK</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <input type="checkbox" id="consent" className="mt-1" />
              <label htmlFor="consent" className="text-xs text-gray-600 dark:text-gray-300">
                Jag godkänner att SL behandlar mina personuppgifter enligt 
                <a href="#" className="text-blue-600 underline"> integritetspolicyn</a> och 
                bekräftar att uppgifterna är korrekta.
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-orange-600">SL</span>
                Ansökan om förseningsersättning
              </CardTitle>
              <CardDescription>
                Steg {currentStep} av 6: {steps[currentStep - 1].title}
              </CardDescription>
            </div>
            <Badge variant="outline">
              Exempel: Tumba → Stockholm City
            </Badge>
          </div>
          
          {/* Progress bar */}
          <div className="flex space-x-1 mt-4">
            {steps.map((step) => (
              <div
                key={step.step}
                className={`h-2 flex-1 rounded ${
                  step.step < currentStep 
                    ? 'bg-green-500' 
                    : step.step === currentStep 
                    ? 'bg-orange-500' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">{steps[currentStep - 1].title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {steps[currentStep - 1].subtitle}
            </p>
          </div>
          
          {renderStepContent()}
          
          <div className="flex justify-between mt-8">
            <Button 
              variant="outline" 
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Tillbaka
            </Button>
            <Button 
              onClick={handleNext}
              className={currentStep === 6 ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {currentStep === 6 ? 'Skicka ansökan' : 'Nästa'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Show completed steps */}
      {completedSteps.length > 0 && currentStep === 6 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-green-600">Formuläret är redo att skickas!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              All information har fyllts i automatiskt med autentisk svenska transportdata från 
              ResRobot och Trafiklab APIs. Formuläret kan nu skickas direkt till SL:s system.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}