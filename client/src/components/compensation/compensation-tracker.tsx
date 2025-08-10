import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Plus, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import CompensationModal from './compensation-modal';

export default function CompensationTracker() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const { data: compensationCases, isLoading } = useQuery({
    queryKey: ['/api/compensation/cases'],
    enabled: !!user,
  });

  const { data: activeJourney } = useQuery({
    queryKey: ['/api/journeys/active'],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-gray-200 mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDelay = activeJourney?.delayMinutes || 0;
  const threshold = 20;
  const progressPercentage = Math.min((currentDelay / threshold) * 100, 100);
  const remainingMinutes = Math.max(threshold - currentDelay, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'detected': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAmount = (amount: string | number) => {
    return `${amount} SEK`;
  };

  const totalApprovedAmount = compensationCases
    ?.filter((c: any) => c.status === 'approved')
    .reduce((sum: number, c: any) => sum + parseFloat(c.actualAmount || '0'), 0) || 0;

  return (
    <>
      <Card className="shadow-sm border border-gray-200 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="text-green-600 mr-2" />
            Compensation Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          
          {/* Current Delay Progress */}
          {activeJourney && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-lg mb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm opacity-90">Current delay</p>
                  <p className="text-2xl font-bold">{currentDelay} min</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Threshold</p>
                  <p className="text-lg font-semibold">{threshold} min</p>
                </div>
              </div>
              <Progress 
                value={progressPercentage} 
                className="mb-2 bg-white/20"
              />
              {currentDelay >= threshold ? (
                <p className="text-xs opacity-90">Eligible for compensation!</p>
              ) : (
                <p className="text-xs opacity-90">
                  {remainingMinutes} more minutes for compensation eligibility
                </p>
              )}
            </div>
          )}

          {/* Statistics */}
          {compensationCases && compensationCases.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-sm text-gray-600">Total Earned</p>
                <p className="text-lg font-bold text-green-600">
                  {formatAmount(totalApprovedAmount)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <p className="text-sm text-gray-600">Total Claims</p>
                <p className="text-lg font-bold text-blue-600">
                  {compensationCases.length}
                </p>
              </div>
            </div>
          )}

          {/* Recent Claims */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">Recent Claims</h4>
            
            {compensationCases && compensationCases.length > 0 ? (
              compensationCases.slice(0, 3).map((claim: any) => (
                <div key={claim.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium">Delay Compensation</p>
                      <p className="text-xs text-gray-600">
                        {new Date(claim.createdAt).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <Badge className={getStatusColor(claim.status)}>
                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">
                      +{claim.delayMinutes} min delay
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {formatAmount(claim.estimatedAmount || claim.actualAmount)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No compensation cases yet</p>
                <p className="text-xs">Claims will appear automatically when delays occur</p>
              </div>
            )}
          </div>

          <Button 
            className="w-full mt-4 bg-green-600 hover:bg-green-700"
            onClick={() => setShowModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            File New Claim
          </Button>
        </CardContent>
      </Card>

      {/* Quick Settings */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <svg className="h-5 w-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Quick Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Push Notifications</span>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition"></span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Delay Alerts</span>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition"></span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Timing</label>
              <select className="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-transparent">
                <option>15 minutes before departure</option>
                <option>10 minutes before departure</option>
                <option>5 minutes before departure</option>
              </select>
            </div>

            <hr className="border-gray-200" />

            <div className="space-y-2">
              <button className="w-full text-left text-sm text-gray-700 hover:text-blue-600 py-2">
                <svg className="inline h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
                Personal Information
              </button>
              <button className="w-full text-left text-sm text-gray-700 hover:text-blue-600 py-2">
                <svg className="inline h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
                Payment Methods
              </button>
              <button className="w-full text-left text-sm text-gray-700 hover:text-blue-600 py-2">
                <svg className="inline h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                </svg>
                Privacy Settings
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <CompensationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          currentDelay={currentDelay}
          activeJourney={activeJourney}
        />
      )}
    </>
  );
}
