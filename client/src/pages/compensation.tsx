import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/layout/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, FileText, Download, Eye } from 'lucide-react';

export default function Compensation() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: compensationCases, isLoading: casesLoading } = useQuery({
    queryKey: ['/api/compensation/cases'],
    enabled: !!user,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'detected': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAmount = (amount: string | number) => {
    return `${amount} SEK`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading || casesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-transit-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Loading compensation data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const totalApproved = compensationCases?.filter((c: any) => c.status === 'approved').length || 0;
  const totalAmount = compensationCases?.filter((c: any) => c.status === 'approved')
    .reduce((sum: number, c: any) => sum + parseFloat(c.actualAmount || '0'), 0) || 0;
  const pending = compensationCases?.filter((c: any) => ['submitted', 'processing'].includes(c.status)).length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Compensation Center</h1>
          <p className="text-gray-600">Track and manage your delay compensation claims</p>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
              <DollarSign className="h-4 w-4 text-success-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success-green">{formatAmount(totalAmount)}</div>
              <p className="text-xs text-muted-foreground">{totalApproved} approved claims</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
              <FileText className="h-4 w-4 text-warning-amber" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning-amber">{pending}</div>
              <p className="text-xs text-muted-foreground">Under review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              <FileText className="h-4 w-4 text-transit-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-transit-blue">{compensationCases?.length || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* SL Form Demo */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-orange-600">SL</span>
              Form Automation Demo
            </CardTitle>
            <p className="text-sm text-gray-600">
              Interactive walkthrough of SL's 6-page dynamic compensation form with real Swedish transport data
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button 
                onClick={() => window.open('/sl-form-demo', '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Try SL Form Demo
              </Button>
              <p className="text-xs text-gray-500 flex items-center">
                Example: Tumba → Stockholm City with 35-minute delay
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Claims List */}
        <Card>
          <CardHeader>
            <CardTitle>Compensation Claims</CardTitle>
          </CardHeader>
          <CardContent>
            {compensationCases && compensationCases.length > 0 ? (
              <div className="space-y-4">
                {compensationCases.map((claim: any) => (
                  <div key={claim.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">Delay Compensation Claim</h3>
                        <p className="text-sm text-gray-600">
                          Filed: {formatDate(claim.createdAt)}
                        </p>
                        {claim.submittedAt && (
                          <p className="text-xs text-gray-500">
                            Submitted: {formatDate(claim.submittedAt)}
                          </p>
                        )}
                      </div>
                      <Badge className={getStatusColor(claim.status)}>
                        {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Delay Duration</p>
                        <p className="font-medium">{claim.delayMinutes} minutes</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="font-medium text-success-green">
                          {formatAmount(claim.actualAmount || claim.estimatedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Threshold</p>
                        <p className="font-medium">{claim.eligibilityThreshold} minutes</p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      {claim.pdfUrl && (
                        <>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View PDF
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </>
                      )}
                      {claim.status === 'detected' && (
                        <Button size="sm" className="bg-transit-blue hover:bg-blue-700">
                          Complete Claim
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Compensation Claims</h3>
                <p className="text-sm">
                  Claims will appear automatically when you experience eligible delays during your journeys.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
