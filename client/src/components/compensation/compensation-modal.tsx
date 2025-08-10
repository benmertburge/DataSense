import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { compensationClaimSchema, type CompensationClaimRequest } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';

interface CompensationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDelay?: number;
  activeJourney?: any;
}

export default function CompensationModal({ 
  isOpen, 
  onClose, 
  currentDelay = 0,
  activeJourney 
}: CompensationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [submittedCase, setSubmittedCase] = useState<any>(null);

  const form = useForm<CompensationClaimRequest>({
    resolver: zodResolver(compensationClaimSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      paymentMethod: 'swish',
      paymentDetails: '',
      ticketType: '30-day',
      consent: false,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: CompensationClaimRequest) => {
      // First detect/create compensation case if needed
      let caseId = null;
      if (activeJourney) {
        const detectResponse = await apiRequest('POST', '/api/compensation/cases/detect', {
          journeyId: activeJourney.id,
        });
        const detectResult = await detectResponse.json();
        caseId = detectResult.case?.id;
      }

      if (!caseId) {
        throw new Error('No eligible compensation case found');
      }

      // Submit the claim
      const response = await apiRequest('POST', '/api/compensation/submit', {
        caseId,
        claimData: data,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSubmittedCase(data.case);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['/api/compensation/cases'] });
      toast({
        title: "Claim Submitted",
        description: "Your compensation claim has been submitted successfully.",
      });
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
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompensationClaimRequest) => {
    submitMutation.mutate(data);
  };

  const handleClose = () => {
    setStep('form');
    setSubmittedCase(null);
    form.reset();
    onClose();
  };

  const calculateEstimatedAmount = () => {
    const delayMinutes = Math.max(currentDelay, 20);
    const baseRate = 6.5; // SEK per minute
    const ticketMultiplier = form.watch('ticketType') === 'single' ? 0.5 : 1.0;
    return Math.round(delayMinutes * baseRate * ticketMultiplier);
  };

  if (step === 'success') {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <CheckCircle className="h-6 w-6 text-success-green mr-2" />
              Claim Submitted Successfully
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center py-6">
              <FileText className="h-16 w-16 text-success-green mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Your claim is being processed</h3>
              <p className="text-sm text-gray-600 mb-4">
                We'll notify you when there are updates on your compensation claim.
              </p>
              
              {submittedCase && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Claim ID</p>
                  <p className="font-mono text-sm">{submittedCase.id}</p>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Delay</p>
                      <p className="font-medium">{submittedCase.delayMinutes} minutes</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Amount</p>
                      <p className="font-medium text-success-green">
                        {submittedCase.actualAmount} SEK
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Close
              </Button>
              {submittedCase?.pdfUrl && (
                <Button className="flex-1 bg-transit-blue hover:bg-blue-700">
                  <FileText className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compensation Claim</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Journey Summary */}
          {activeJourney && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Journey Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Date & Time</p>
                  <p className="font-medium">
                    {new Date(activeJourney.plannedDeparture).toLocaleDateString('sv-SE')} - {new Date(activeJourney.plannedDeparture).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Planned Duration</p>
                  <p className="font-medium">
                    {Math.round((new Date(activeJourney.plannedArrival).getTime() - new Date(activeJourney.plannedDeparture).getTime()) / 60000)} minutes
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Actual Delay</p>
                  <p className="font-medium text-error-red">+{currentDelay} minutes</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <Badge variant={currentDelay >= 20 ? "default" : "secondary"} className={currentDelay >= 20 ? "bg-success-green" : ""}>
                    {currentDelay >= 20 ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Personal Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Anna" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Andersson" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="anna.andersson@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+46 70 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Payment Method *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-3 gap-3"
                      >
                        <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-3 hover:bg-gray-50">
                          <RadioGroupItem value="swish" id="swish" />
                          <Label htmlFor="swish" className="cursor-pointer">Swish</Label>
                        </div>
                        <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-3 hover:bg-gray-50">
                          <RadioGroupItem value="bank" id="bank" />
                          <Label htmlFor="bank" className="cursor-pointer">Bank Transfer</Label>
                        </div>
                        <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-3 hover:bg-gray-50">
                          <RadioGroupItem value="voucher" id="voucher" />
                          <Label htmlFor="voucher" className="cursor-pointer">Travel Voucher</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch('paymentMethod') === 'swish' && 'Swish Number *'}
                      {form.watch('paymentMethod') === 'bank' && 'Bank Account Number *'}
                      {form.watch('paymentMethod') === 'voucher' && 'Voucher Preference *'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={
                          form.watch('paymentMethod') === 'swish' ? '+46 70 123 4567' :
                          form.watch('paymentMethod') === 'bank' ? 'SE89 3000 0000 0054 910 12' :
                          'Monthly travel card credit'
                        }
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ticketType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ticket type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30-day">30-day period pass</SelectItem>
                        <SelectItem value="single">Single journey ticket</SelectItem>
                        <SelectItem value="7-day">7-day period pass</SelectItem>
                        <SelectItem value="annual">Annual pass</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Evidence Upload */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Supporting Evidence (Optional)
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Upload screenshots, receipts, or other evidence</p>
                  <Button type="button" variant="outline" size="sm">
                    Choose Files
                  </Button>
                </div>
              </div>

              {/* Consent */}
              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        I consent to the processing of my personal data for compensation purposes and have read the{' '}
                        <button type="button" className="text-transit-blue hover:underline">
                          privacy policy
                        </button>
                        .
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* Estimated Compensation */}
              <div className="bg-success-green bg-opacity-10 border border-success-green border-opacity-30 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Estimated Compensation:</span>
                  <span className="text-xl font-bold text-success-green">
                    {calculateEstimatedAmount()} SEK
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Based on {currentDelay}-minute delay with {form.watch('ticketType')} pass
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-success-green hover:bg-emerald-700"
                  disabled={submitMutation.isPending || !form.watch('consent')}
                >
                  {submitMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Claim (PDF)
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
