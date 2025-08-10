import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/layout/navbar';
import JourneyPlannerForm from '@/components/journey/journey-planner-form';
import CurrentJourney from '@/components/journey/current-journey';
import AlternativeRoutes from '@/components/journey/alternative-routes';
import CompensationTracker from '@/components/compensation/compensation-tracker';
import ServiceAlerts from '@/components/alerts/service-alerts';
import NotificationToast from '@/components/common/notification-toast';

export default function Home() {
  const { user, isLoading } = useAuth();
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'journey_update':
        toast({
          title: "Journey Updated",
          description: `Your journey has been updated with new delay information.`,
        });
        break;
      
      case 'compensation_eligible':
        toast({
          title: "Compensation Available",
          description: `You may be eligible for compensation due to delays.`,
          variant: "default",
        });
        break;
      
      case 'compensation_detected':
        toast({
          title: "New Compensation Case",
          description: `We've detected a delay that qualifies for compensation.`,
        });
        break;

      default:
        break;
    }
  }, [lastMessage, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your transit dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // This should be handled by the router
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto">
        <div className="lg:flex lg:gap-8 p-4">
          
          {/* Left Sidebar - Journey Planner */}
          <div className="lg:w-80 mb-6 lg:mb-0">
            <JourneyPlannerForm />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <CurrentJourney />
            <AlternativeRoutes />
            <ServiceAlerts />
          </div>

          {/* Right Sidebar - Compensation & Settings */}
          <div className="lg:w-80">
            <CompensationTracker />
          </div>

        </div>
      </div>

      <NotificationToast />
    </div>
  );
}
