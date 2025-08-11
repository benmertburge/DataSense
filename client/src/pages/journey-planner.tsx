import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import Navbar from '@/components/layout/navbar';
import JourneyPlannerForm from '@/components/journey/journey-planner-form';
import AlternativeRoutes from '@/components/journey/alternative-routes';

export default function JourneyPlanner() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-transit-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Loading journey planner...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journey Planner</h1>
          <p className="text-gray-600 dark:text-gray-300">Plan your route and get real-time updates</p>
        </div>

        <div className="lg:flex lg:gap-8">
          {/* Journey Planner Form */}
          <div className="lg:w-80 mb-6 lg:mb-0">
            <JourneyPlannerForm />
          </div>

          {/* Results */}
          <div className="flex-1">
            <AlternativeRoutes />
          </div>
        </div>
      </div>
    </div>
  );
}
